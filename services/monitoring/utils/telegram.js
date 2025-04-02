/**
 * Модуль для отправки уведомлений в Telegram
 */
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger').createLogger('telegram');

// Загрузка переменных окружения
require('dotenv').config();

// Токен бота Telegram из переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN;

// ID чата для отправки сообщений
const chatId = process.env.TELEGRAM_CHAT_ID;

// Максимальная длина сообщения в Telegram
const MAX_MESSAGE_LENGTH = 4096;

// Путь к файлу истории сообщений
const MESSAGES_LOG_FILE = path.join(process.env.STATUS_LOG_PATH || './status_logs', 'telegram_messages.json');

// История отправленных сообщений
let messageHistory = [];

/**
 * Инициализация бота Telegram
 */
let bot = null;

/**
 * Проверяет, настроен ли Telegram бот
 * @returns {boolean} Результат проверки
 */
function isTelegramConfigured() {
  return !!token && !!chatId;
}

/**
 * Инициализирует бота Telegram
 */
function initializeBot() {
  if (!isTelegramConfigured()) {
    logger.warn('Telegram бот не настроен. Проверьте переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID.');
    return false;
  }
  
  try {
    bot = new TelegramBot(token, { polling: false });
    logger.info('Telegram бот инициализирован');
    
    // Загружаем историю сообщений
    loadMessageHistory();
    
    return true;
  } catch (error) {
    logger.error(`Ошибка инициализации Telegram бота: ${error.message}`);
    return false;
  }
}

/**
 * Загружает историю отправленных сообщений
 */
async function loadMessageHistory() {
  try {
    // Создаем директорию, если она не существует
    await fs.ensureDir(path.dirname(MESSAGES_LOG_FILE));
    
    // Проверяем существование файла
    if (await fs.pathExists(MESSAGES_LOG_FILE)) {
      messageHistory = await fs.readJson(MESSAGES_LOG_FILE);
      logger.debug(`Загружено ${messageHistory.length} сообщений из истории`);
    } else {
      messageHistory = [];
      // Создаем пустой файл
      await fs.writeJson(MESSAGES_LOG_FILE, [], { spaces: 2 });
      logger.debug('Создан новый файл истории сообщений');
    }
  } catch (error) {
    logger.error(`Ошибка загрузки истории сообщений: ${error.message}`);
    messageHistory = [];
  }
}

/**
 * Сохраняет историю отправленных сообщений
 */
async function saveMessageHistory() {
  try {
    // Ограничиваем размер истории
    if (messageHistory.length > 100) {
      messageHistory = messageHistory.slice(-100);
    }
    
    await fs.writeJson(MESSAGES_LOG_FILE, messageHistory, { spaces: 2 });
    logger.debug('История сообщений сохранена');
  } catch (error) {
    logger.error(`Ошибка сохранения истории сообщений: ${error.message}`);
  }
}

/**
 * Отправляет сообщение в Telegram
 * @param {string} message Текст сообщения
 * @param {string} type Тип сообщения (report, alert, recovery)
 * @returns {Promise<boolean>} Результат отправки
 */
async function sendMessage(message, type = 'report') {
  if (!bot) {
    if (!initializeBot()) {
      logger.error('Не удалось инициализировать Telegram бота для отправки сообщения');
      return false;
    }
  }
  
  // Проверяем длину сообщения
  if (message.length > MAX_MESSAGE_LENGTH) {
    message = message.substring(0, MAX_MESSAGE_LENGTH - 100) + '...\n[Сообщение сокращено из-за ограничений Telegram]';
  }
  
  try {
    // Отправляем сообщение
    const result = await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    
    // Сохраняем сообщение в истории
    const messageRecord = {
      timestamp: new Date().toISOString(),
      content: message,
      type,
      messageId: result.message_id
    };
    
    messageHistory.push(messageRecord);
    await saveMessageHistory();
    
    logger.info(`Отправлено сообщение типа "${type}" в Telegram`);
    return true;
  } catch (error) {
    logger.error(`Ошибка отправки сообщения в Telegram: ${error.message}`);
    
    // Пытаемся отправить без форматирования
    if (error.message.includes('parse_mode')) {
      try {
        await bot.sendMessage(chatId, message);
        logger.info('Сообщение отправлено без форматирования');
        return true;
      } catch (secondError) {
        logger.error(`Повторная ошибка отправки: ${secondError.message}`);
      }
    }
    
    return false;
  }
}

/**
 * Форматирует и отправляет отчет о состоянии сервисов
 * @param {Object} status Объект статуса сервисов
 * @returns {Promise<boolean>} Результат отправки
 */
async function sendStatusReport(status) {
  const { services, system, timestamp } = status;
  
  // Форматируем заголовок
  const dateStr = new Date(timestamp).toLocaleString();
  let message = `📊 *Отчет о состоянии системы*\n`;
  message += `🕐 ${dateStr}\n\n`;
  
  // Информация о системе
  message += `*Система:*\n`;
  message += `⏱ Время работы: ${formatUptime(system.uptime)}\n`;
  message += `💾 Память: ${formatMemory(system.memoryUsed, system.memoryTotal)}\n\n`;
  
  // Статус сервисов
  message += `*Состояние сервисов:*\n`;
  
  // Подсчет активных/неактивных сервисов
  const totalServices = Object.keys(services).length;
  const activeServices = Object.values(services).filter(s => s.active).length;
  message += `✅ Активно: ${activeServices}/${totalServices}\n\n`;
  
  // Список сервисов
  Object.values(services).forEach(service => {
    const statusIcon = service.active ? '🟢' : '🔴';
    const responseTime = service.responseTime ? `${service.responseTime}ms` : 'н/д';
    
    message += `${statusIcon} *${service.name}*: ${service.active ? 'активен' : 'недоступен'} (${responseTime})\n`;
  });
  
  // Отправляем отчет
  return await sendMessage(message, 'report');
}

/**
 * Отправляет уведомление о недоступных сервисах
 * @param {Array} downServices Список недоступных сервисов
 * @returns {Promise<boolean>} Результат отправки
 */
async function sendDownServicesAlert(downServices) {
  if (!downServices || downServices.length === 0) {
    return false;
  }
  
  // Форматируем заголовок
  let message = `⚠️ *ПРЕДУПРЕЖДЕНИЕ: Обнаружены недоступные сервисы*\n\n`;
  
  // Список недоступных сервисов
  downServices.forEach(service => {
    const downSince = service.downSince 
      ? `с ${new Date(service.downSince).toLocaleTimeString()}`
      : 'время неизвестно';
    
    message += `🔴 *${service.name}* недоступен ${downSince}\n`;
  });
  
  // Отправляем предупреждение
  return await sendMessage(message, 'alert');
}

/**
 * Отправляет уведомление о восстановлении сервиса
 * @param {Object} recoveryEvent Событие восстановления
 * @returns {Promise<boolean>} Результат отправки
 */
async function sendRecoveryAlert(recoveryEvent) {
  // Форматируем заголовок
  let message = `✅ *ВОССТАНОВЛЕНИЕ СЕРВИСА*\n\n`;
  
  // Информация о восстановлении
  message += `🟢 Сервис *${recoveryEvent.service}* восстановлен\n`;
  message += `⏱ Время простоя: ${formatDuration(recoveryEvent.downtime)}\n`;
  message += `🕐 Восстановлен в: ${new Date(recoveryEvent.timestamp).toLocaleTimeString()}\n`;
  
  // Отправляем уведомление
  return await sendMessage(message, 'recovery');
}

/**
 * Форматирует время работы в читаемый вид
 * @param {number} seconds Время в секундах
 * @returns {string} Отформатированное время
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}д ${hours}ч ${minutes}м`;
  } else if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  } else {
    return `${minutes}м ${Math.floor(seconds % 60)}с`;
  }
}

/**
 * Форматирует размер памяти в читаемый вид
 * @param {number} used Используемая память в байтах
 * @param {number} total Общая память в байтах
 * @returns {string} Отформатированный размер
 */
function formatMemory(used, total) {
  const usedMB = Math.round(used / 1024 / 1024);
  const totalMB = Math.round(total / 1024 / 1024);
  return `${usedMB}MB / ${totalMB}MB`;
}

/**
 * Форматирует продолжительность в секундах в читаемый вид
 * @param {number} seconds Продолжительность в секундах
 * @returns {string} Отформатированная продолжительность
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds} сек`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes} мин ${secs} сек`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} ч ${minutes} мин`;
  }
}

/**
 * Получает историю отправленных сообщений
 * @returns {Array} История сообщений
 */
function getMessageHistory() {
  return messageHistory;
}

/**
 * Отправляет изображение в Telegram
 * @param {string} imageBuffer Буфер изображения или путь к файлу
 * @param {string} caption Подпись к изображению
 * @returns {Promise<boolean>} Результат отправки
 */
async function sendImage(imageBuffer, caption = '') {
  if (!bot) {
    if (!initializeBot()) {
      logger.error('Не удалось инициализировать Telegram бота для отправки изображения');
      return false;
    }
  }
  
  try {
    await bot.sendPhoto(chatId, imageBuffer, { caption });
    logger.info('Изображение отправлено в Telegram');
    return true;
  } catch (error) {
    logger.error(`Ошибка отправки изображения в Telegram: ${error.message}`);
    return false;
  }
}

module.exports = {
  initializeBot,
  isTelegramConfigured,
  sendMessage,
  sendStatusReport,
  sendDownServicesAlert,
  sendRecoveryAlert,
  sendImage,
  getMessageHistory
};