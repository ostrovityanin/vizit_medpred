/**
 * Улучшенный скрипт мониторинга с гарантированной отправкой в Telegram
 * Версия 3.0 - С расширенными функциями отчетности и мониторинга ресурсов
 */
import axios from 'axios';
import TelegramBot from 'node-telegram-bot-api';
import { CronJob } from 'cron';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import os from 'os';

// Инициализация для ESM
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Получаем токен и ID чата из переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

// URL для проверки здоровья
const serviceUrl = 'http://localhost:5000/health';

// Конфигурация мониторинга
const CONFIG = {
  checkInterval: 30000,       // 30 секунд между проверками
  alertThreshold: 3,          // Количество последовательных ошибок перед оповещением
  restartCommand: 'npm run dev',
  workingDirectory: process.cwd(),
  maxRestarts: 3,             // Максимальное количество автоматических перезапусков
  restartInterval: 120000,    // 2 минуты между попытками перезапуска
  telegramReportInterval: '0 */5 * * * *', // Каждые 5 минут
  telegramRetryCount: 3,      // Количество попыток отправки в Telegram
  telegramRetryDelay: 5000,   // 5 секунд между попытками отправки
  logFile: 'enhanced-monitoring.log',
  metricsInterval: 60000      // Интервал сбора метрик системы (1 минута)
};

// Инициализируем Telegram бота
let bot = null;
try {
  bot = new TelegramBot(token, { polling: false });
  console.log(`✅ Telegram бот успешно инициализирован`);
} catch (error) {
  console.error(`❌ Ошибка инициализации Telegram бота:`, error.message);
}

// Переменные состояния
let failedChecks = 0;
let lastRestartTime = 0;
let restartCount = 0;
let lastStatus = null;
let serverProcess = null;
let telegramSendQueue = [];
let sendingInProgress = false;
let systemMetrics = {
  cpuUsage: 0,
  memTotal: 0,
  memFree: 0,
  memUsage: 0,
  uptime: 0,
  loadAvg: [0, 0, 0]
};

// Функция логирования
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  console.log(formattedMessage);
  
  try {
    fs.appendFileSync(CONFIG.logFile, formattedMessage + '\n');
  } catch (error) {
    console.error(`Ошибка записи в лог:`, error.message);
  }
}

log(`🚀 Инициализация расширенного мониторинга (v3.0)`);
log(`✅ Используем токен Telegram: ${token ? 'Да (установлен)' : 'Нет'}`);
log(`✅ Используем Chat ID: ${chatId || 'Нет'}`);
log(`📡 Проверяемый сервис: ${serviceUrl}`);
log(`⏱️ Интервал проверки: ${CONFIG.checkInterval / 1000} секунд`);
log(`🔄 Порог оповещения: ${CONFIG.alertThreshold} последовательных ошибок`);
log(`📊 Интервал отчетов Telegram: ${CONFIG.telegramReportInterval}`);

/**
 * Сбор метрик системы
 */
function collectSystemMetrics() {
  try {
    const cpus = os.cpus();
    const totalCpu = cpus.reduce((acc, cpu) => {
      return acc + Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
    }, 0);
    const idleCpu = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
    const cpuUsage = 100 - (idleCpu / totalCpu * 100);
    
    systemMetrics = {
      cpuUsage: cpuUsage.toFixed(2),
      memTotal: Math.round(os.totalmem() / 1024 / 1024),
      memFree: Math.round(os.freemem() / 1024 / 1024),
      memUsage: ((1 - os.freemem() / os.totalmem()) * 100).toFixed(2),
      uptime: Math.floor(os.uptime()),
      loadAvg: os.loadavg()
    };
    
    log(`Метрики системы обновлены: CPU ${systemMetrics.cpuUsage}%, RAM ${systemMetrics.memUsage}%`, 'debug');
  } catch (error) {
    log(`Ошибка сбора метрик системы: ${error.message}`, 'error');
  }
}

/**
 * Проверка здоровья сервиса
 */
async function checkHealth() {
  try {
    const startTime = Date.now();
    const response = await axios.get(serviceUrl, { timeout: 5000 });
    const responseTime = Date.now() - startTime;
    
    const isHealthy = response.data.status === 'ok';
    const status = {
      healthy: isHealthy,
      responseTime: responseTime,
      uptime: response.data.uptime,
      memory: response.data.memory,
      timestamp: new Date().toISOString()
    };
    
    log(`Проверка здоровья: ${isHealthy ? '✅ ЗДОРОВ' : '❌ ПРОБЛЕМА'} (${responseTime}ms)`, 
      isHealthy ? 'info' : 'warn');
    
    // Сбрасываем счетчик ошибок при успешной проверке
    if (isHealthy && failedChecks > 0) {
      if (failedChecks >= CONFIG.alertThreshold) {
        await sendRecoveryAlert();
      }
      failedChecks = 0;
    }
    
    // Сохраняем последний статус
    lastStatus = status;
    
    return status;
  } catch (error) {
    log(`Ошибка проверки: ${error.message}`, 'error');
    
    failedChecks++;
    if (failedChecks >= CONFIG.alertThreshold) {
      log(`Достигнут порог ошибок (${failedChecks}/${CONFIG.alertThreshold})`, 'error');
      await handleServerFailure(error);
    } else {
      log(`Увеличен счетчик ошибок (${failedChecks}/${CONFIG.alertThreshold})`, 'warn');
    }
    
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Обработка сбоя сервера
 */
async function handleServerFailure(error) {
  try {
    // Проверяем, можем ли мы перезапустить сервер
    const now = Date.now();
    const canRestart = (now - lastRestartTime > CONFIG.restartInterval) && 
                      (restartCount < CONFIG.maxRestarts);
    
    if (canRestart) {
      // Отправляем уведомление о проблеме и перезапуске
      await sendFailureAlert(error, true);
      
      // Перезапускаем сервер
      await restartServer();
    } else {
      // Только отправляем уведомление о проблеме
      await sendFailureAlert(error, false);
      
      if (restartCount >= CONFIG.maxRestarts) {
        log(`Достигнут лимит перезапусков (${restartCount}/${CONFIG.maxRestarts})`, 'error');
      } else {
        log(`Ожидание интервала перезапуска...`, 'warn');
      }
    }
  } catch (alertError) {
    log(`Ошибка при обработке сбоя: ${alertError.message}`, 'error');
  }
}

/**
 * Перезапуск сервера
 */
async function restartServer() {
  log(`Перезапуск сервера...`, 'warn');
  
  // Проверяем, есть ли активный процесс сервера
  if (serverProcess && !serverProcess.killed) {
    log(`Завершение текущего процесса сервера...`, 'warn');
    try {
      serverProcess.kill('SIGTERM');
      // Даем время процессу завершиться
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (killError) {
      log(`Ошибка при завершении процесса: ${killError.message}`, 'error');
    }
  }
  
  try {
    // Запускаем сервер
    const cmd = CONFIG.restartCommand.split(' ')[0];
    const args = CONFIG.restartCommand.split(' ').slice(1);
    
    log(`Запуск команды: ${cmd} ${args.join(' ')}`, 'info');
    
    serverProcess = spawn(cmd, args, {
      cwd: CONFIG.workingDirectory,
      stdio: 'inherit',
      shell: true
    });
    
    // Обновляем счетчики
    lastRestartTime = Date.now();
    restartCount++;
    
    log(`Сервер перезапущен (попытка ${restartCount}/${CONFIG.maxRestarts})`, 'info');
    
    // Слушаем события процесса
    serverProcess.on('exit', (code) => {
      log(`Процесс сервера завершился с кодом ${code}`, 'warn');
    });
    
    serverProcess.on('error', (err) => {
      log(`Ошибка процесса сервера: ${err.message}`, 'error');
    });
    
    return true;
  } catch (spawnError) {
    log(`Ошибка при запуске сервера: ${spawnError.message}`, 'error');
    return false;
  }
}

/**
 * Отправка сообщений из очереди в Telegram
 */
async function processTelegramQueue() {
  if (sendingInProgress || telegramSendQueue.length === 0) {
    return;
  }
  
  sendingInProgress = true;
  const { message, parseMode, retryCount } = telegramSendQueue[0];
  
  try {
    if (!token || !chatId || !bot) {
      log(`Не настроены параметры Telegram, сообщение не отправлено`, 'warn');
      telegramSendQueue.shift(); // Удаляем сообщение из очереди
      sendingInProgress = false;
      return;
    }
    
    await bot.sendMessage(chatId, message, { parse_mode: parseMode });
    log(`Сообщение успешно отправлено в Telegram`, 'info');
    telegramSendQueue.shift(); // Удаляем отправленное сообщение из очереди
  } catch (error) {
    log(`Ошибка отправки в Telegram: ${error.message}`, 'error');
    
    // Если есть еще попытки отправки, оставляем сообщение в очереди
    if (retryCount > 0) {
      telegramSendQueue[0].retryCount--;
      log(`Повторная попытка отправки будет через ${CONFIG.telegramRetryDelay / 1000} сек (осталось попыток: ${telegramSendQueue[0].retryCount})`, 'info');
    } else {
      log(`Превышено количество попыток отправки сообщения, удаляем из очереди`, 'warn');
      telegramSendQueue.shift();
    }
  } finally {
    sendingInProgress = false;
    
    // Если в очереди остались сообщения, планируем следующую отправку
    if (telegramSendQueue.length > 0) {
      setTimeout(processTelegramQueue, CONFIG.telegramRetryDelay);
    }
  }
}

/**
 * Отправка сообщения в Telegram (через очередь)
 */
function sendTelegramMessage(message, parseMode = 'Markdown') {
  // Добавляем сообщение в очередь
  telegramSendQueue.push({
    message,
    parseMode,
    retryCount: CONFIG.telegramRetryCount
  });
  
  // Запускаем обработку очереди
  processTelegramQueue();
  
  return true;
}

/**
 * Отправка уведомления о сбое
 */
async function sendFailureAlert(error, willRestart = false) {
  const message = `
🔴 *СБОЙ ОСНОВНОГО СЕРВИСА*

⚠️ *Проблема:* ${error.message || 'Неизвестная ошибка'}
⏱ *Время обнаружения:* ${new Date().toLocaleString()}
🔢 *Последовательных ошибок:* ${failedChecks}

${willRestart ? '🔄 *Выполняется автоматический перезапуск*' : '❗ *Требуется ручное вмешательство*'}

${restartCount > 0 ? `📊 *Предыдущих перезапусков:* ${restartCount}/${CONFIG.maxRestarts}` : ''}

💻 *Системные метрики:*
📈 CPU: ${systemMetrics.cpuUsage}%
💾 RAM: ${systemMetrics.memUsage}% (${systemMetrics.memTotal - systemMetrics.memFree}/${systemMetrics.memTotal} MB)
⏳ Системный аптайм: ${formatUptime(systemMetrics.uptime)}
`;
  
  return sendTelegramMessage(message);
}

/**
 * Отправка уведомления о восстановлении
 */
async function sendRecoveryAlert() {
  const uptime = lastStatus ? lastStatus.uptime : 'Н/Д';
  const memory = lastStatus && lastStatus.memory ? 
    `${lastStatus.memory.heapUsed}/${lastStatus.memory.heapTotal}` : 'Н/Д';
  
  const message = `
🟢 *СЕРВИС ВОССТАНОВЛЕН*

✅ *Статус:* Сервер снова работает
⏱ *Время восстановления:* ${new Date().toLocaleString()}
${restartCount > 0 ? `🔄 *Понадобилось перезапусков:* ${restartCount}` : '🔍 *Восстановлен самостоятельно*'}
⏳ *Текущий аптайм:* ${formatUptime(uptime)}
💾 *Память:* ${memory}

💻 *Системные метрики:*
📈 CPU: ${systemMetrics.cpuUsage}%
💾 RAM: ${systemMetrics.memUsage}% (${systemMetrics.memTotal - systemMetrics.memFree}/${systemMetrics.memTotal} MB)
⏳ Системный аптайм: ${formatUptime(systemMetrics.uptime)}
`;
  
  return sendTelegramMessage(message);
}

/**
 * Отправка регулярного статуса в Telegram
 */
async function sendStatusToTelegram() {
  if (!token || !chatId) {
    log(`Не настроены параметры Telegram, отчёт не отправлен`, 'warn');
    return;
  }
  
  try {
    const status = await checkHealth();
    
    let emoji = status.healthy ? '🟢' : '🔴';
    let memoryInfo = '';
    
    if (status.memory) {
      memoryInfo = `
💾 *Память приложения:* ${status.memory.heapUsed}/${status.memory.heapTotal}`;
    }
    
    const message = `
${emoji} *СТАТУС СЕРВИСА*

⏱ *Время проверки:* ${new Date().toLocaleString()}
🔄 *Время отклика:* ${status.responseTime || 'Н/Д'} мс
⏳ *Аптайм приложения:* ${formatUptime(status.uptime || 0)}${memoryInfo}
${status.error ? `\n❌ *Ошибка:* ${status.error}` : ''}

💻 *Системные метрики:*
📈 CPU: ${systemMetrics.cpuUsage}%
💾 RAM: ${systemMetrics.memUsage}% (${systemMetrics.memTotal - systemMetrics.memFree}/${systemMetrics.memTotal} MB)
⏳ Системный аптайм: ${formatUptime(systemMetrics.uptime)}
🔄 Средняя нагрузка: ${systemMetrics.loadAvg.map(l => l.toFixed(2)).join(', ')}
`;
    
    sendTelegramMessage(message);
  } catch (error) {
    log(`Ошибка отправки статуса: ${error.message}`, 'error');
  }
}

/**
 * Форматирование времени аптайма
 */
function formatUptime(seconds) {
  if (isNaN(seconds)) return 'Н/Д';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  let formatted = '';
  if (days > 0) formatted += `${days}д `;
  if (hours > 0 || days > 0) formatted += `${hours}ч `;
  if (minutes > 0 || hours > 0 || days > 0) formatted += `${minutes}м `;
  formatted += `${remainingSeconds}с`;
  
  return formatted;
}

/**
 * Функция запуска автоматической проверки
 */
function startHealthCheck() {
  log(`Запуск автоматической проверки каждые ${CONFIG.checkInterval / 1000} секунд`, 'info');
  
  // Удаляем предыдущий интервал, если был
  if (global.healthCheckInterval) {
    clearInterval(global.healthCheckInterval);
  }
  
  // Запускаем новый интервал
  global.healthCheckInterval = setInterval(async () => {
    try {
      await checkHealth();
    } catch (error) {
      log(`Ошибка в интервале проверки: ${error.message}`, 'error');
    }
  }, CONFIG.checkInterval);
  
  // Первичная проверка
  checkHealth();
  
  return global.healthCheckInterval;
}

/**
 * Запуск сбора метрик системы
 */
function startMetricsCollection() {
  log(`Запуск сбора метрик системы каждые ${CONFIG.metricsInterval / 1000} секунд`, 'info');
  
  // Удаляем предыдущий интервал, если был
  if (global.metricsInterval) {
    clearInterval(global.metricsInterval);
  }
  
  // Запускаем новый интервал
  global.metricsInterval = setInterval(() => {
    try {
      collectSystemMetrics();
    } catch (error) {
      log(`Ошибка в интервале сбора метрик: ${error.message}`, 'error');
    }
  }, CONFIG.metricsInterval);
  
  // Первичный сбор метрик
  collectSystemMetrics();
  
  return global.metricsInterval;
}

// Выполняем проверку по расписанию для отправки отчета в Telegram
const statusJob = new CronJob(CONFIG.telegramReportInterval, sendStatusToTelegram);
statusJob.start();

// Запускаем автоматическую проверку с заданным интервалом
startHealthCheck();

// Запускаем сбор метрик системы
startMetricsCollection();

// Отправляем первоначальный отчет
sendStatusToTelegram();

log('Мониторинг успешно запущен', 'info');

// Обработка завершения процесса
process.on('SIGINT', () => {
  log('Завершение мониторинга', 'info');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Получен сигнал SIGTERM, завершение мониторинга', 'info');
  process.exit(0);
});

// Сообщение о запуске в Telegram
sendTelegramMessage(`
🚀 *МОНИТОРИНГ ЗАПУЩЕН*

✅ Система мониторинга успешно инициализирована
⏱ Время запуска: ${new Date().toLocaleString()}
📊 Интервал проверок: ${CONFIG.checkInterval / 1000} сек
📡 Интервал отчетов: ${CONFIG.telegramReportInterval}

💻 *Системные метрики:*
📈 CPU: ${systemMetrics.cpuUsage}%
💾 RAM: ${systemMetrics.memUsage}% (${systemMetrics.memTotal - systemMetrics.memFree}/${systemMetrics.memTotal} MB)
⏳ Системный аптайм: ${formatUptime(systemMetrics.uptime)}
`);

// Экспорт функций для ESM
export {
  checkHealth,
  sendStatusToTelegram,
  startHealthCheck,
  handleServerFailure,
  sendFailureAlert,
  sendRecoveryAlert,
  collectSystemMetrics
};