/**
 * Сервис мониторинга - отслеживает здоровье основного сервиса и отправляет уведомления
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { sendTelegramMessage } = require('../telegram-service/telegram-client');

// Конфигурация сервиса
const CONFIG = {
  // Основной сервис для проверки
  mainServiceUrl: 'http://localhost:5000/health',
  // Интервал проверки в миллисекундах
  checkInterval: process.env.NODE_ENV === 'production' ? 300000 : 60000, // 5 минут в проде, 1 минута в разработке
  // Путь к файлу логов
  logsPath: path.join(__dirname, '..', '..', 'logs', 'monitoring.log')
};

// Создаем директорию для логов, если она не существует
const logsDir = path.dirname(CONFIG.logsPath);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Запись в лог-файл
 * @param {string} message - Сообщение для записи
 */
function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  try {
    fs.appendFileSync(CONFIG.logsPath, logMessage);
  } catch (error) {
    console.error(`Ошибка записи в лог: ${error.message}`);
  }
  
  // Дублируем в консоль
  console.log(message);
}

/**
 * Проверка здоровья основного сервиса
 * @returns {Promise<Object>} - Результат проверки
 */
async function checkServiceHealth() {
  try {
    const startTime = Date.now();
    const response = await axios.get(CONFIG.mainServiceUrl, { timeout: 10000 });
    const responseTime = Date.now() - startTime;
    
    const statusCode = response.status;
    const isHealthy = statusCode === 200 && response.data && response.data.status === 'ok';
    
    return {
      healthy: isHealthy,
      statusCode,
      responseTime,
      uptime: response.data?.uptime,
      memory: response.data?.memory,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logToFile(`Ошибка при проверке здоровья: ${error.message}`);
    
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Форматирует информацию о статусе в понятное сообщение
 * @param {Object} status - Статус сервиса
 * @returns {string} - Форматированное сообщение для Telegram
 */
function formatStatusMessage(status) {
  const emoji = status.healthy ? '🟢' : '🔴';
  let message = `${emoji} *Статус сервиса*\n\n`;
  
  message += `⏱ *Время проверки:* ${new Date(status.timestamp).toLocaleString()}\n`;
  message += `🔄 *Время отклика:* ${status.responseTime || 'Н/Д'} мс\n`;
  
  if (status.uptime) {
    // Преобразуем секунды в понятный формат
    const uptime = status.uptime;
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    
    let uptimeStr = '';
    if (days > 0) uptimeStr += `${days}д `;
    if (hours > 0) uptimeStr += `${hours}ч `;
    if (minutes > 0) uptimeStr += `${minutes}м `;
    uptimeStr += `${seconds}с`;
    
    message += `⏳ *Аптайм:* ${uptimeStr}\n`;
  }
  
  if (status.memory) {
    const heapUsed = Math.round(status.memory.heapUsed / (1024 * 1024));
    const heapTotal = Math.round(status.memory.heapTotal / (1024 * 1024));
    message += `💾 *Память:* ${heapUsed}MB / ${heapTotal}MB\n`;
  }
  
  if (status.error) {
    message += `\n❌ *Ошибка:* ${status.error}\n`;
  }
  
  return message;
}

/**
 * Отправка уведомления в Telegram
 * @param {Object} status - Результат проверки здоровья
 */
async function sendNotification(status) {
  const message = formatStatusMessage(status);
  try {
    await sendTelegramMessage(message, { parse_mode: 'Markdown' });
    logToFile('Отправлено уведомление в Telegram');
  } catch (error) {
    logToFile(`Ошибка отправки уведомления: ${error.message}`);
  }
}

/**
 * Основной цикл мониторинга
 */
async function startMonitoring() {
  logToFile('Мониторинг-сервис запущен');
  
  // Начальная проверка и отправка уведомления при запуске
  const initialStatus = await checkServiceHealth();
  await sendNotification(initialStatus);
  
  // Запускаем интервальную проверку
  setInterval(async () => {
    const status = await checkServiceHealth();
    logToFile(`Проверка здоровья: ${status.healthy ? 'ЗДОРОВ' : 'ПРОБЛЕМА'}`);
    
    // Отправляем уведомление только при проблемах или раз в час
    const hourMark = new Date().getMinutes() === 0; // Проверяем, что сейчас начало часа
    if (!status.healthy || hourMark) {
      await sendNotification(status);
    }
  }, CONFIG.checkInterval);
}

// Запускаем мониторинг
startMonitoring();

module.exports = {
  checkServiceHealth,
  startMonitoring
};