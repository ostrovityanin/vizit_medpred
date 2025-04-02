/**
 * Модуль для отправки уведомлений через Telegram
 */
const TelegramBot = require('node-telegram-bot-api');
const { logger } = require('./logger');
require('dotenv').config();

// Получаем настройки из переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

let bot = null;

// Инициализация бота
function initBot() {
  if (!token || !chatId) {
    logger.warn('Настройки Telegram бота отсутствуют. Уведомления будут отключены.');
    return false;
  }
  
  try {
    bot = new TelegramBot(token, { polling: false });
    logger.info('Telegram бот успешно инициализирован');
    return true;
  } catch (error) {
    logger.error(`Ошибка инициализации Telegram бота: ${error.message}`);
    return false;
  }
}

/**
 * Отправка текстового сообщения в Telegram
 * @param {string} message - Текст сообщения
 * @returns {Promise<boolean>} - Результат отправки
 */
async function sendTelegramMessage(message) {
  if (!bot) {
    if (!initBot()) {
      return false;
    }
  }
  
  // Проверяем наличие настроек
  if (!token || !chatId) {
    logger.warn('Невозможно отправить сообщение: отсутствуют настройки Telegram');
    return false;
  }
  
  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    logger.info('Сообщение в Telegram успешно отправлено');
    return true;
  } catch (error) {
    logger.error(`Ошибка отправки сообщения в Telegram: ${error.message}`);
    return false;
  }
}

/**
 * Отправка статуса сервисов в Telegram
 * @param {Object} statusReport - Отчет о статусе сервисов
 * @returns {Promise<boolean>} - Результат отправки
 */
async function sendStatusReport(statusReport) {
  const { time, services, overallStatus } = statusReport;
  
  let statusEmoji = '🟢';
  if (overallStatus === 'warning') statusEmoji = '🟡';
  if (overallStatus === 'critical') statusEmoji = '🔴';
  
  let message = `<b>${statusEmoji} Статус системы: ${time}</b>\n\n`;
  
  // Добавляем информацию о каждом сервисе
  for (const service of services) {
    let serviceEmoji = '🟢';
    if (service.status === 'warning') serviceEmoji = '🟡';
    if (service.status === 'critical') serviceEmoji = '🔴';
    
    message += `${serviceEmoji} <b>${service.name}</b>: ${service.status.toUpperCase()}\n`;
    if (service.message) {
      message += `   <i>${service.message}</i>\n`;
    }
    message += `   Время отклика: ${service.responseTime}ms\n`;
    
    // Добавляем информацию о времени простоя, если сервис недоступен
    if (service.downtime) {
      message += `   Время простоя: ${service.downtime}\n`;
    }
    
    message += '\n';
  }
  
  return sendTelegramMessage(message);
}

/**
 * Отправка уведомления о критической ошибке в Telegram
 * @param {string} serviceName - Имя сервиса
 * @param {string} error - Описание ошибки
 * @returns {Promise<boolean>} - Результат отправки
 */
async function sendErrorAlert(serviceName, error) {
  const message = `🔴 <b>КРИТИЧЕСКАЯ ОШИБКА</b>\n\n` +
                 `<b>Сервис:</b> ${serviceName}\n` +
                 `<b>Время:</b> ${new Date().toLocaleString()}\n` +
                 `<b>Ошибка:</b> ${error}\n\n` +
                 `Требуется немедленное вмешательство.`;
  
  return sendTelegramMessage(message);
}

/**
 * Отправка уведомления о восстановлении сервиса в Telegram
 * @param {string} serviceName - Имя сервиса
 * @param {string} downtime - Время простоя
 * @returns {Promise<boolean>} - Результат отправки
 */
async function sendRecoveryAlert(serviceName, downtime) {
  const message = `🟢 <b>СЕРВИС ВОССТАНОВЛЕН</b>\n\n` +
                 `<b>Сервис:</b> ${serviceName}\n` +
                 `<b>Время:</b> ${new Date().toLocaleString()}\n` +
                 `<b>Время простоя:</b> ${downtime}`;
  
  return sendTelegramMessage(message);
}

// Инициализация при импорте модуля
initBot();

module.exports = {
  sendTelegramMessage,
  sendStatusReport,
  sendErrorAlert,
  sendRecoveryAlert
};