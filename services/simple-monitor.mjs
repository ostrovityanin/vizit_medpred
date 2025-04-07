/**
 * Актуализированный скрипт мониторинга для Replit
 * Улучшенная версия с автоматическим перезапуском сервера
 */
import axios from 'axios';
import TelegramBot from 'node-telegram-bot-api';
import { CronJob } from 'cron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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
let serverProcess = null;

console.log(`🚀 Инициализация расширенного мониторинга`);
console.log(`✅ Используем токен Telegram: ${token ? 'Да (установлен)' : 'Нет'}`);
console.log(`✅ Используем Chat ID: ${chatId || 'Нет'}`);
console.log(`📡 Проверяемый сервис: ${serviceUrl}`);
console.log(`⏱️ Интервал проверки: ${CONFIG.checkInterval / 1000} секунд`);
console.log(`🔄 Порог оповещения: ${CONFIG.alertThreshold} последовательных ошибок`);

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
    
    console.log(`[${new Date().toLocaleTimeString()}] Проверка здоровья:`, 
      isHealthy ? '✅ ЗДОРОВ' : '❌ ПРОБЛЕМА', 
      `(${responseTime}ms)`);
    
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
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Ошибка проверки:`, error.message);
    
    failedChecks++;
    if (failedChecks >= CONFIG.alertThreshold) {
      console.log(`[${new Date().toLocaleTimeString()}] ⚠️ Достигнут порог ошибок (${failedChecks}/${CONFIG.alertThreshold})`);
      await handleServerFailure(error);
    } else {
      console.log(`[${new Date().toLocaleTimeString()}] ⚠️ Увеличен счетчик ошибок (${failedChecks}/${CONFIG.alertThreshold})`);
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
        console.log(`[${new Date().toLocaleTimeString()}] ⚠️ Достигнут лимит перезапусков (${restartCount}/${CONFIG.maxRestarts})`);
      } else {
        console.log(`[${new Date().toLocaleTimeString()}] ⏱️ Ожидание интервала перезапуска...`);
      }
    }
  } catch (alertError) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Ошибка при обработке сбоя:`, alertError.message);
  }
}

// Функция перезапуска сервера
async function restartServer() {
  console.log(`[${new Date().toLocaleTimeString()}] 🔄 Перезапуск сервера...`);
  
  // Проверяем, есть ли активный процесс сервера
  if (serverProcess && !serverProcess.killed) {
    console.log(`[${new Date().toLocaleTimeString()}] ⏹️ Завершение текущего процесса сервера...`);
    try {
      serverProcess.kill('SIGTERM');
      // Даем время процессу завершиться
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (killError) {
      console.error(`[${new Date().toLocaleTimeString()}] ❌ Ошибка при завершении процесса:`, killError.message);
    }
  }
  
  try {
    // Запускаем сервер
    const cmd = CONFIG.restartCommand.split(' ')[0];
    const args = CONFIG.restartCommand.split(' ').slice(1);
    
    console.log(`[${new Date().toLocaleTimeString()}] 🚀 Запуск команды: ${cmd} ${args.join(' ')}`);
    
    serverProcess = spawn(cmd, args, {
      cwd: CONFIG.workingDirectory,
      stdio: 'inherit',
      shell: true
    });
    
    // Обновляем счетчики
    lastRestartTime = Date.now();
    restartCount++;
    
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Сервер перезапущен (попытка ${restartCount}/${CONFIG.maxRestarts})`);
    
    // Слушаем события процесса
    serverProcess.on('exit', (code) => {
      console.log(`[${new Date().toLocaleTimeString()}] ⚠️ Процесс сервера завершился с кодом ${code}`);
    });
    
    serverProcess.on('error', (err) => {
      console.error(`[${new Date().toLocaleTimeString()}] ❌ Ошибка процесса сервера:`, err.message);
    });
    
    return true;
  } catch (spawnError) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Ошибка при запуске сервера:`, spawnError.message);
    return false;
  }
}

// Функция отправки сообщения в Telegram
async function sendTelegramMessage(message, parseMode = 'Markdown') {
  if (!token || !chatId) {
    console.log('Не настроены параметры Telegram, сообщение не отправлено');
    return false;
  }
  
  try {
    await bot.sendMessage(chatId, message, { parse_mode: parseMode });
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Сообщение успешно отправлено в Telegram`);
    return true;
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Ошибка отправки в Telegram:`, error.message);
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
    console.log('Не настроены параметры Telegram, отчёт не отправлен');
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
    console.error(`[${new Date().toLocaleTimeString()}] ❌ Ошибка отправки статуса:`, error.message);
  }
}

// Функция запуска автоматической проверки
function startHealthCheck() {
  console.log(`[${new Date().toLocaleTimeString()}] 🚀 Запуск автоматической проверки каждые ${CONFIG.checkInterval / 1000} секунд`);
  
  // Удаляем предыдущий интервал, если был
  if (global.healthCheckInterval) {
    clearInterval(global.healthCheckInterval);
  }
  
  // Запускаем новый интервал
  global.healthCheckInterval = setInterval(async () => {
    try {
      await checkHealth();
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] ❌ Ошибка в интервале проверки:`, error.message);
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

console.log('Мониторинг запущен');
console.log('Нажмите Ctrl+C для завершения');

// Обработка завершения процесса
process.on('SIGINT', () => {
  console.log('Завершение мониторинга');
  process.exit(0);
});

// Экспорт функций для ESM
export {
  checkHealth,
  sendStatusToTelegram,
  startHealthCheck,
  handleServerFailure,
  sendFailureAlert,
  sendRecoveryAlert
};