import express from 'express';
import dotenv from 'dotenv';
import { CronJob } from 'cron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

// Импортируем утилиты
import logger from '../utils/logger.js';
import { initBot, sendMessage, sendStatusReport } from '../utils/telegram.js';
import { checkAllServices, getSystemStatus, generateStatusReport } from '../utils/health-check.js';
import { analyzeLogs } from '../utils/log-analyzer.js';

// Инициализируем переменные окружения
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Настройки сервера
const PORT = process.env.PORT || 3006;
const app = express();

// Переменные для хранения последнего статуса
let lastReport = null;
let healthCheckInterval = null;
let reportInterval = null;

// Настраиваем middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Маршрут для проверки состояния самого сервиса мониторинга
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Маршрут для получения статуса всех микросервисов
app.get('/api/status', async (req, res) => {
  try {
    const report = await generateStatusReport();
    res.status(200).json(report);
  } catch (error) {
    logger.error(`Ошибка при получении статуса: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Маршрут для получения результатов анализа логов
app.get('/api/logs', async (req, res) => {
  try {
    const logAnalysis = await analyzeLogs();
    res.status(200).json(logAnalysis);
  } catch (error) {
    logger.error(`Ошибка при анализе логов: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Маршрут для принудительной отправки отчета в Telegram
app.post('/api/send-report', async (req, res) => {
  try {
    const report = await generateStatusReport();
    await sendStatusReport(report);
    res.status(200).json({ success: true, message: 'Отчет отправлен в Telegram' });
  } catch (error) {
    logger.error(`Ошибка при отправке отчета: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Запуск проверки состояния всех микросервисов по интервалу
const startHealthCheck = () => {
  const interval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000', 10);
  
  // Проверяем состояние сервисов при запуске
  runHealthCheck();
  
  // Устанавливаем интервал для последующих проверок
  healthCheckInterval = setInterval(runHealthCheck, interval);
  logger.info(`Проверка состояния запущена с интервалом ${interval / 1000} секунд`);
};

// Запуск отправки регулярных отчетов в Telegram
const startReportSchedule = () => {
  // Запускаем отправку отчетов в Telegram каждую минуту
  const job = new CronJob('* * * * *', async () => {
    logger.info('Отправка минутного отчета в Telegram...');
    const report = await generateStatusReport();
    await sendStatusReport(report);
  });
  
  job.start();
  logger.info('Отправка отчетов в Telegram запланирована каждую минуту');
};

// Функция для сохранения данных о состоянии в файл
const saveServiceStatusLog = async (report) => {
  try {
    // Создаем директорию для хранения логов статуса
    const statusLogDir = process.env.STATUS_LOG_PATH || path.join(__dirname, '..', 'status_logs');
    fs.ensureDirSync(statusLogDir);
    
    // Создаем имя файла на основе даты
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const logFilePath = path.join(statusLogDir, `status_${dateStr}.json`);
    
    // Проверяем, существует ли файл
    let logs = [];
    if (fs.existsSync(logFilePath)) {
      const fileContent = await fs.readFile(logFilePath, 'utf8');
      logs = JSON.parse(fileContent);
    }
    
    // Добавляем новую запись
    logs.push({
      timestamp: new Date().toISOString(),
      report
    });
    
    // Записываем обновленные данные в файл
    await fs.writeFile(logFilePath, JSON.stringify(logs, null, 2), 'utf8');
    
    // Очищаем старые логи (оставляем логи за последние 7 дней)
    await cleanupOldLogs(statusLogDir, 7);
    
    logger.info(`Данные о состоянии сохранены в ${logFilePath}`);
  } catch (error) {
    logger.error(`Ошибка при сохранении данных о состоянии: ${error.message}`);
  }
};

// Функция для очистки старых логов
const cleanupOldLogs = async (logDir, daysToKeep) => {
  try {
    const files = await fs.readdir(logDir);
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000; // в миллисекундах
    
    for (const file of files) {
      if (file.startsWith('status_') && file.endsWith('.json')) {
        const filePath = path.join(logDir, file);
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;
        
        if (age > maxAge) {
          await fs.unlink(filePath);
          logger.info(`Удален устаревший лог: ${file}`);
        }
      }
    }
  } catch (error) {
    logger.error(`Ошибка при очистке старых логов: ${error.message}`);
  }
};

// Функция для выполнения проверки состояния сервисов
const runHealthCheck = async () => {
  try {
    // Генерируем отчет о состоянии
    const report = await generateStatusReport();
    lastReport = report;
    
    // Сохраняем отчет в логи
    await saveServiceStatusLog(report);
    
    // Если есть неактивные сервисы, отправляем уведомление в Telegram
    const inactiveServices = Object.entries(report.serviceStatuses)
      .filter(([_, status]) => !status.isActive)
      .map(([service, _]) => service);
    
    if (inactiveServices.length > 0) {
      const message = `🔴 ВНИМАНИЕ! Недоступны следующие сервисы: ${inactiveServices.join(', ')}`;
      await sendMessage(message);
    }
    
    // Логируем состояние системы
    const { systemStatus } = report;
    logger.info(`Server Status:
      Uptime: ${systemStatus.uptime}
      Memory: ${systemStatus.memory}
      Active: ${report.allServicesActive ? 'Yes' : 'No'}`);
    
    return report;
  } catch (error) {
    logger.error(`Ошибка при проверке состояния: ${error.message}`);
    return null;
  }
};

// Инициализация сервиса
const init = async () => {
  try {
    // Создаем необходимые директории
    await fs.ensureDir(process.env.LOG_PATH || path.join(__dirname, '..', 'logs'));
    
    // Инициализируем Telegram бота
    initBot();
    
    // Запускаем проверку состояния
    startHealthCheck();
    
    // Запускаем отправку отчетов
    startReportSchedule();
    
    // Запускаем веб-сервер
    app.listen(PORT, () => {
      logger.info(`Сервис мониторинга запущен на порту ${PORT}`);
    });
  } catch (error) {
    logger.error(`Ошибка инициализации сервиса: ${error.message}`);
    process.exit(1);
  }
};

// Обработка сигналов завершения
process.on('SIGINT', async () => {
  logger.info('Получен сигнал SIGINT, завершаем работу...');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Получен сигнал SIGTERM, завершаем работу...');
  await cleanup();
  process.exit(0);
});

// Функция очистки ресурсов перед завершением
const cleanup = async () => {
  // Очищаем интервалы
  if (healthCheckInterval) clearInterval(healthCheckInterval);
  if (reportInterval) clearInterval(reportInterval);
  
  // Отправляем сообщение о завершении работы
  await sendMessage('🔴 Сервис мониторинга остановлен');
  
  // Даем время на отправку последних сообщений
  await new Promise(resolve => setTimeout(resolve, 1000));
};

// Запускаем инициализацию
init();