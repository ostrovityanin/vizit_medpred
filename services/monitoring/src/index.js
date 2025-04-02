/**
 * Основной файл сервиса мониторинга
 * Отвечает за проверку состояния микросервисов и отправку уведомлений
 */
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { CronJob } = require('cron');
const { logger } = require('../utils/logger');
const { checkAllServices, getStatusHistory, getCurrentStatus } = require('../utils/health-check');
const { sendStatusReport, sendErrorAlert, sendRecoveryAlert } = require('../utils/telegram');
const { getLogsSummary } = require('../utils/log-analyzer');

// Загружаем переменные окружения
require('dotenv').config();

// Создаем приложение Express
const app = express();
const PORT = process.env.PORT || 3200;

// Путь к статическим файлам
const publicPath = path.join(__dirname, '../public');

// Интервал проверки сервисов в миллисекундах
const HEALTH_CHECK_INTERVAL = parseInt(process.env.HEALTH_CHECK_INTERVAL || 60000);

// Служебные переменные
let lastStatusReport = null;
let lastNotificationTime = Date.now();
let minuteReportJob = null;
let lastHealthCheck = Date.now();

// Middleware для логирования запросов
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Статические файлы
app.use(express.static(publicPath));
app.use(express.json());

// API маршруты
app.get('/api/status', (req, res) => {
  const status = getCurrentStatus();
  res.json(status);
});

app.get('/api/history', (req, res) => {
  const history = getStatusHistory();
  res.json(history);
});

app.get('/api/logs/errors', (req, res) => {
  const logsSummary = getLogsSummary();
  res.json(logsSummary);
});

// Домашняя страница (веб-интерфейс)
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Функция для выполнения проверки сервисов
async function performHealthCheck() {
  try {
    lastHealthCheck = Date.now();
    const statusReport = await checkAllServices();
    
    // Сохраняем отчет для использования в других местах
    lastStatusReport = statusReport;
    
    // Если статус изменился на критический, отправляем уведомление
    if (statusReport.overallStatus === 'critical') {
      // Находим критические сервисы
      const criticalServices = statusReport.services
        .filter(service => service.status === 'critical')
        .map(service => `${service.name}: ${service.message}`);
      
      // Отправляем уведомление, если прошло достаточно времени с последнего уведомления
      const now = Date.now();
      if (now - lastNotificationTime > 300000) { // 5 минут
        await sendErrorAlert('Мониторинг', `Обнаружены проблемы в работе сервисов:\n${criticalServices.join('\n')}`);
        lastNotificationTime = now;
      }
    }
    
    logger.info(`Проверка здоровья выполнена. Общий статус: ${statusReport.overallStatus}`);
    return statusReport;
  } catch (error) {
    logger.error(`Ошибка выполнения проверки здоровья: ${error.message}`);
    return null;
  }
}

// Функция для отправки отчета о состоянии в Telegram
async function sendStatusReportToTelegram() {
  try {
    if (lastStatusReport) {
      await sendStatusReport(lastStatusReport);
      logger.info('Отчет о состоянии отправлен в Telegram');
    } else {
      logger.warn('Отчет о состоянии не отправлен: отсутствуют данные');
      // Выполняем проверку здоровья, если нет данных
      const report = await performHealthCheck();
      if (report) {
        await sendStatusReport(report);
        logger.info('Отчет о состоянии отправлен в Telegram после проверки');
      }
    }
  } catch (error) {
    logger.error(`Ошибка отправки отчета в Telegram: ${error.message}`);
  }
}

// Функция для запуска задач мониторинга
function startMonitoringTasks() {
  // Выполняем первоначальную проверку
  logger.info('Запуск первоначальной проверки...');
  performHealthCheck();
  
  // Настраиваем периодическую проверку
  logger.info(`Настройка периодической проверки каждые ${HEALTH_CHECK_INTERVAL / 1000} секунд`);
  setInterval(performHealthCheck, HEALTH_CHECK_INTERVAL);
  
  // Настраиваем ежеминутный отчет в Telegram
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    logger.info('Настройка ежеминутного отчета в Telegram');
    // Каждую минуту в 0 секунд
    minuteReportJob = new CronJob('0 * * * * *', sendStatusReportToTelegram);
    minuteReportJob.start();
  } else {
    logger.warn('Отсутствуют настройки Telegram. Отчеты отключены.');
  }
}

// Запускаем сервер
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Сервис мониторинга запущен на порту ${PORT}`);
  startMonitoringTasks();
});

// Обработка сигналов завершения
process.on('SIGINT', () => {
  logger.info('Получен сигнал завершения SIGINT');
  server.close(() => {
    logger.info('Сервер мониторинга остановлен');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  logger.info('Получен сигнал завершения SIGTERM');
  server.close(() => {
    logger.info('Сервер мониторинга остановлен');
    process.exit(0);
  });
});

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  logger.error(`Необработанное исключение: ${error.message}`);
  logger.error(error.stack);
});

// Обработка необработанных rejected promises
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Необработанный rejected promise: ${reason}`);
});