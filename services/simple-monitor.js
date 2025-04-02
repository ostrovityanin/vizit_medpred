/**
 * Упрощенный скрипт мониторинга для прямого запуска в Replit
 */
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const { CronJob } = require('cron');
require('dotenv').config();

// Получаем токен и ID чата из переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

// URL для проверки здоровья
const serviceUrl = 'http://localhost:5000/health';

// Инициализируем Telegram бота
const bot = new TelegramBot(token, { polling: false });

console.log(`Инициализация упрощенного мониторинга`);
console.log(`Используем токен Telegram: ${token ? 'Да (установлен)' : 'Нет'}`);
console.log(`Используем Chat ID: ${chatId || 'Нет'}`);
console.log(`Проверяемый сервис: ${serviceUrl}`);

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