/**
 * Микросервис телеграм-клиента - отвечает за отправку сообщений в Telegram
 */
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Получаем токены из переменных окружения
const adminBotToken = process.env.TELEGRAM_BOT_TOKEN;
const adminChatId = process.env.TELEGRAM_CHAT_ID;

// Если токены не найдены, логируем ошибку
if (!adminBotToken) {
  console.error('Ошибка: Не найден TELEGRAM_BOT_TOKEN в переменных окружения');
}

if (!adminChatId) {
  console.error('Ошибка: Не найден TELEGRAM_CHAT_ID в переменных окружения');
}

// Инициализация бота
const bot = adminBotToken 
  ? new TelegramBot(adminBotToken, { polling: false }) 
  : null;

/**
 * Проверяет, настроен ли бот
 * @returns {boolean} - True, если бот настроен
 */
function isBotConfigured() {
  return !!bot && !!adminChatId;
}

/**
 * Отправляет текстовое сообщение в Telegram администратору
 * @param {string} message - Текст сообщения
 * @param {Object} options - Дополнительные опции
 * @returns {Promise<Object>} - Результат отправки
 */
async function sendTelegramMessage(message, options = {}) {
  if (!isBotConfigured()) {
    throw new Error('Telegram бот не настроен. Проверьте переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID');
  }
  
  try {
    const result = await bot.sendMessage(adminChatId, message, options);
    return result;
  } catch (error) {
    console.error(`Ошибка отправки сообщения в Telegram: ${error.message}`);
    throw error;
  }
}

/**
 * Отправляет аудио-файл в Telegram администратору
 * @param {string|Buffer} audio - Путь к файлу или буфер с аудио
 * @param {Object} options - Дополнительные опции
 * @returns {Promise<Object>} - Результат отправки
 */
async function sendTelegramAudio(audio, options = {}) {
  if (!isBotConfigured()) {
    throw new Error('Telegram бот не настроен. Проверьте переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID');
  }
  
  try {
    const result = await bot.sendAudio(adminChatId, audio, options);
    return result;
  } catch (error) {
    console.error(`Ошибка отправки аудио в Telegram: ${error.message}`);
    throw error;
  }
}

/**
 * Отправляет файл в Telegram администратору
 * @param {string|Buffer} file - Путь к файлу или буфер с данными
 * @param {Object} options - Дополнительные опции
 * @returns {Promise<Object>} - Результат отправки
 */
async function sendTelegramDocument(file, options = {}) {
  if (!isBotConfigured()) {
    throw new Error('Telegram бот не настроен. Проверьте переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID');
  }
  
  try {
    const result = await bot.sendDocument(adminChatId, file, options);
    return result;
  } catch (error) {
    console.error(`Ошибка отправки документа в Telegram: ${error.message}`);
    throw error;
  }
}

/**
 * Разрешает имя пользователя в chat_id используя Telegram API getChat
 * @param {string} username - Имя пользователя (с @ или без)
 * @returns {Promise<number|string|null>} - ID чата или null, если не найдено
 */
async function resolveUsername(username) {
  if (!isBotConfigured()) {
    throw new Error('Telegram бот не настроен. Проверьте переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID');
  }
  
  try {
    // Убедимся, что имя пользователя начинается с @
    const formattedUsername = username.startsWith('@') ? username : `@${username}`;
    
    const chat = await bot.getChat(formattedUsername);
    return chat.id;
  } catch (error) {
    console.error(`Ошибка разрешения имени пользователя в Telegram: ${error.message}`);
    return null;
  }
}

/**
 * Отправляет сообщение конкретному пользователю
 * @param {number|string} chatId - ID чата пользователя
 * @param {string} message - Текст сообщения
 * @param {Object} options - Дополнительные опции
 * @returns {Promise<Object>} - Результат отправки
 */
async function sendMessageToUser(chatId, message, options = {}) {
  if (!isBotConfigured()) {
    throw new Error('Telegram бот не настроен. Проверьте переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID');
  }
  
  try {
    const result = await bot.sendMessage(chatId, message, options);
    return result;
  } catch (error) {
    console.error(`Ошибка отправки сообщения пользователю в Telegram: ${error.message}`);
    throw error;
  }
}

/**
 * Отправляет аудио конкретному пользователю
 * @param {number|string} chatId - ID чата пользователя
 * @param {string|Buffer} audio - Путь к файлу или буфер с аудио
 * @param {Object} options - Дополнительные опции
 * @returns {Promise<Object>} - Результат отправки
 */
async function sendAudioToUser(chatId, audio, options = {}) {
  if (!isBotConfigured()) {
    throw new Error('Telegram бот не настроен. Проверьте переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID');
  }
  
  try {
    const result = await bot.sendAudio(chatId, audio, options);
    return result;
  } catch (error) {
    console.error(`Ошибка отправки аудио пользователю в Telegram: ${error.message}`);
    throw error;
  }
}

/**
 * Получает обновления для бота
 * @returns {Promise<Array>} - Массив обновлений
 */
async function getBotUpdates() {
  if (!isBotConfigured()) {
    throw new Error('Telegram бот не настроен. Проверьте переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID');
  }
  
  try {
    const updates = await bot.getUpdates();
    return updates;
  } catch (error) {
    console.error(`Ошибка получения обновлений Telegram: ${error.message}`);
    throw error;
  }
}

/**
 * Получает информацию о боте
 * @returns {Promise<Object>} - Информация о боте
 */
async function getBotInfo() {
  if (!isBotConfigured()) {
    throw new Error('Telegram бот не настроен. Проверьте переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID');
  }
  
  try {
    const me = await bot.getMe();
    return me;
  } catch (error) {
    console.error(`Ошибка получения информации о боте: ${error.message}`);
    throw error;
  }
}

module.exports = {
  sendTelegramMessage,
  sendTelegramAudio,
  sendTelegramDocument,
  resolveUsername,
  sendMessageToUser,
  sendAudioToUser,
  getBotUpdates,
  getBotInfo,
  isBotConfigured
};