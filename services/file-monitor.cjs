/**
 * Скрипт мониторинга с записью в файл
 * 
 * Эта версия оптимизирована для работы в фоновом режиме
 * и записывает все логи в указанный файл.
 */

// Импорты модулей
const fs = require('fs');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const { CronJob } = require('cron');
const path = require('path');
require('dotenv').config();

// Получаем токен и ID чата из переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

// Файлы для логирования
const LOG_FILE = 'monitoring-service.log';

// URL для проверки здоровья
const serviceUrl = 'http://localhost:5000/health';

// Конфигурация мониторинга
const CONFIG = {
  checkInterval: 30000, // 30 секунд между проверками
  alertThreshold: 3,    // Количество последовательных ошибок перед оповещением
  restartCommand: 'npm run dev',
  workingDirectory: process.cwd(),
  maxRestarts: 3,       // Максимальное количество автоматических перезапусков
  restartInterval: 120000 // 2 минуты между попытками перезапуска
};

// Инициализируем Telegram бота
const bot = new TelegramBot(token, { polling: false });

// Переменные состояния
let failedChecks = 0;
let lastRestartTime = 0;
let restartCount = 0;
let lastStatus = null;

// Функция записи в лог-файл
function writeLog(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type}] ${message}\n`;
  
  try {
    fs.appendFileSync(LOG_FILE, logMessage);
  } catch (error) {
    // Если запись в файл не удалась, выводим в консоль
    console.error(`Ошибка записи в лог: ${error.message}`);
    console.log(logMessage);
  }
}

// Инициализация
writeLog(`🚀 Инициализация расширенного мониторинга`);
writeLog(`✅ Используем токен Telegram: ${token ? 'Да (установлен)' : 'Нет'}`);
writeLog(`✅ Используем Chat ID: ${chatId || 'Нет'}`);
writeLog(`📡 Проверяемый сервис: ${serviceUrl}`);
writeLog(`⏱️ Интервал проверки: ${CONFIG.checkInterval / 1000} секунд`);
writeLog(`🔄 Порог оповещения: ${CONFIG.alertThreshold} последовательных ошибок`);

// Функция проверки здоровья сервиса
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
    
    writeLog(`Проверка здоровья: ${isHealthy ? '✅ ЗДОРОВ' : '❌ ПРОБЛЕМА'} (${responseTime}ms)`);
    
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
    writeLog(`Ошибка проверки: ${error.message}`, 'ERROR');
    
    failedChecks++;
    if (failedChecks >= CONFIG.alertThreshold) {
      writeLog(`Достигнут порог ошибок (${failedChecks}/${CONFIG.alertThreshold})`, 'WARNING');
      await handleServerFailure(error);
    } else {
      writeLog(`Увеличен счетчик ошибок (${failedChecks}/${CONFIG.alertThreshold})`, 'WARNING');
    }
    
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Функция обработки сбоя сервера
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
        writeLog(`Достигнут лимит перезапусков (${restartCount}/${CONFIG.maxRestarts})`, 'WARNING');
      } else {
        writeLog(`Ожидание интервала перезапуска...`, 'INFO');
      }
    }
  } catch (alertError) {
    writeLog(`Ошибка при обработке сбоя: ${alertError.message}`, 'ERROR');
  }
}

// Функция перезапуска сервера
async function restartServer() {
  writeLog(`Перезапуск сервера...`, 'INFO');
  
  // Проверяем, есть ли активный процесс сервера
  if (serverProcess && !serverProcess.killed) {
    writeLog(`Завершение текущего процесса сервера...`, 'INFO');
    try {
      serverProcess.kill('SIGTERM');
      // Даем время процессу завершиться
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (killError) {
      writeLog(`Ошибка при завершении процесса: ${killError.message}`, 'ERROR');
    }
  }
  
  try {
    // Запускаем сервер
    const cmd = CONFIG.restartCommand.split(' ')[0];
    const args = CONFIG.restartCommand.split(' ').slice(1);
    
    writeLog(`Запуск команды: ${cmd} ${args.join(' ')}`, 'INFO');
    
    serverProcess = require('child_process').spawn(cmd, args, {
      cwd: CONFIG.workingDirectory,
      stdio: 'inherit',
      shell: true
    });
    
    // Обновляем счетчики
    lastRestartTime = Date.now();
    restartCount++;
    
    writeLog(`Сервер перезапущен (попытка ${restartCount}/${CONFIG.maxRestarts})`, 'INFO');
    
    // Слушаем события процесса
    serverProcess.on('exit', (code) => {
      writeLog(`Процесс сервера завершился с кодом ${code}`, 'WARNING');
    });
    
    serverProcess.on('error', (err) => {
      writeLog(`Ошибка процесса сервера: ${err.message}`, 'ERROR');
    });
    
    return true;
  } catch (spawnError) {
    writeLog(`Ошибка при запуске сервера: ${spawnError.message}`, 'ERROR');
    return false;
  }
}

// Функция отправки сообщения в Telegram
async function sendTelegramMessage(message, parseMode = 'Markdown') {
  if (!token || !chatId) {
    writeLog('Не настроены параметры Telegram, сообщение не отправлено', 'WARNING');
    return false;
  }
  
  try {
    await bot.sendMessage(chatId, message, { parse_mode: parseMode });
    writeLog(`Сообщение успешно отправлено в Telegram`, 'INFO');
    return true;
  } catch (error) {
    writeLog(`Ошибка отправки в Telegram: ${error.message}`, 'ERROR');
    return false;
  }
}

// Функция отправки уведомления о сбое
async function sendFailureAlert(error, willRestart = false) {
  const message = `
🔴 *СБОЙ ОСНОВНОГО СЕРВИСА*

⚠️ *Проблема:* ${error.message || 'Неизвестная ошибка'}
⏱ *Время обнаружения:* ${new Date().toLocaleString()}
🔢 *Последовательных ошибок:* ${failedChecks}

${willRestart ? '🔄 *Выполняется автоматический перезапуск*' : '❗ *Требуется ручное вмешательство*'}

${restartCount > 0 ? `📊 *Предыдущих перезапусков:* ${restartCount}/${CONFIG.maxRestarts}` : ''}
`;
  
  return await sendTelegramMessage(message);
}

// Функция отправки уведомления о восстановлении
async function sendRecoveryAlert() {
  const uptime = lastStatus ? lastStatus.uptime : 'Н/Д';
  const memory = lastStatus && lastStatus.memory ? 
    `${lastStatus.memory.heapUsed}/${lastStatus.memory.heapTotal}` : 'Н/Д';
  
  const message = `
🟢 *СЕРВИС ВОССТАНОВЛЕН*

✅ *Статус:* Сервер снова работает
⏱ *Время восстановления:* ${new Date().toLocaleString()}
${restartCount > 0 ? `🔄 *Понадобилось перезапусков:* ${restartCount}` : '🔍 *Восстановлен самостоятельно*'}
⏳ *Текущий аптайм:* ${uptime} сек
💾 *Память:* ${memory}
`;
  
  return await sendTelegramMessage(message);
}

// Функция отправки регулярного статуса в Telegram
async function sendStatusToTelegram() {
  if (!token || !chatId) {
    writeLog('Не настроены параметры Telegram, отчёт не отправлен', 'WARNING');
    return;
  }
  
  try {
    const status = await checkHealth();
    
    let emoji = status.healthy ? '🟢' : '🔴';
    let memoryInfo = '';
    
    if (status.memory) {
      memoryInfo = `
💾 *Память:* ${status.memory.heapUsed}/${status.memory.heapTotal}`;
    }
    
    const message = `
${emoji} *Статус основного сервиса*

⏱ *Время проверки:* ${new Date().toLocaleString()}
🔄 *Время отклика:* ${status.responseTime || 'Н/Д'} мс
⏳ *Аптайм:* ${status.uptime || 'Н/Д'} сек${memoryInfo}
${status.error ? `\n❌ *Ошибка:* ${status.error}` : ''}
`;
    
    await sendTelegramMessage(message);
  } catch (error) {
    writeLog(`Ошибка отправки статуса: ${error.message}`, 'ERROR');
  }
}

// Функция запуска автоматической проверки
function startHealthCheck() {
  writeLog(`Запуск автоматической проверки каждые ${CONFIG.checkInterval / 1000} секунд`, 'INFO');
  
  // Удаляем предыдущий интервал, если был
  if (global.healthCheckInterval) {
    clearInterval(global.healthCheckInterval);
  }
  
  // Запускаем новый интервал
  global.healthCheckInterval = setInterval(async () => {
    try {
      await checkHealth();
    } catch (error) {
      writeLog(`Ошибка в интервале проверки: ${error.message}`, 'ERROR');
    }
  }, CONFIG.checkInterval);
  
  // Первичная проверка
  checkHealth();
  
  return global.healthCheckInterval;
}

// Выполняем проверку каждую минуту для отправки отчета в Telegram
const statusJob = new CronJob('0 */5 * * * *', sendStatusToTelegram); // Каждые 5 минут
statusJob.start();

// Запускаем автоматическую проверку с заданным интервалом
startHealthCheck();

// Также отправляем первоначальный отчет
sendStatusToTelegram();

writeLog('Мониторинг запущен', 'INFO');

// Обработка завершения процесса
process.on('SIGINT', () => {
  writeLog('Завершение мониторинга', 'INFO');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  writeLog(`Необработанное исключение: ${err.message}`, 'ERROR');
  writeLog(err.stack, 'ERROR');
});

// Сообщение о запуске в лог
writeLog(`Сервис мониторинга успешно запущен с PID ${process.pid}`, 'INFO');