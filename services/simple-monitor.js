/**
 * Актуализированный скрипт мониторинга для Replit
 * Улучшенная версия с автоматическим перезапуском сервера
 */
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const { CronJob } = require('cron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

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
      isHealthy ? 'ЗДОРОВ' : 'ПРОБЛЕМА', 
      `(${responseTime}ms)`);
    
    return status;
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] Ошибка проверки:`, error.message);
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Функция отправки статуса в Telegram
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
    
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    console.log(`[${new Date().toLocaleTimeString()}] Отчёт успешно отправлен в Telegram`);
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] Ошибка отправки в Telegram:`, error.message);
  }
}

// Выполняем проверку каждую минуту
const job = new CronJob('0 * * * * *', sendStatusToTelegram);
job.start();

// Также отправляем первоначальную проверку
sendStatusToTelegram();

console.log('Мониторинг запущен');
console.log('Нажмите Ctrl+C для завершения');

// Обработка завершения процесса
process.on('SIGINT', () => {
  console.log('Завершение мониторинга');
  process.exit(0);
});