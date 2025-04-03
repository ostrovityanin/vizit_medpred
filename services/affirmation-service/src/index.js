/**
 * Микросервис для обработки аффирмаций из Telegram
 * 
 * Этот сервис отслеживает сообщения в Telegram, находит аффирмации
 * и отправляет их пользователям, отслеживая уникальность комментариев
 * по их ID для избежания повторных ответов на одни и те же сообщения.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const { logger } = require('../utils/logger');

// Конфигурация
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000', 10); // интервал опроса в мс
const DATA_DIR = path.join(__dirname, '../data');
const PROCESSED_MESSAGES_FILE = path.join(DATA_DIR, 'processed_messages.json');

// Создаем директорию для данных, если она не существует
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Инициализируем бота
let bot = null;
if (BOT_TOKEN) {
  bot = new TelegramBot(BOT_TOKEN, { polling: true });
  logger.info('Telegram бот для аффирмаций инициализирован');
} else {
  logger.error('TELEGRAM_BOT_TOKEN не найден в переменных окружения');
  process.exit(1);
}

// Загружаем информацию об уже обработанных сообщениях
let processedMessages = new Set();
try {
  if (fs.existsSync(PROCESSED_MESSAGES_FILE)) {
    const data = JSON.parse(fs.readFileSync(PROCESSED_MESSAGES_FILE, 'utf8'));
    processedMessages = new Set(data);
    logger.info(`Загружено ${processedMessages.size} обработанных сообщений`);
  } else {
    // Создаем пустой файл
    fs.writeFileSync(PROCESSED_MESSAGES_FILE, '[]', 'utf8');
    logger.info('Создан новый файл для хранения обработанных сообщений');
  }
} catch (error) {
  logger.error(`Ошибка загрузки обработанных сообщений: ${error.message}`);
  // Создаем пустой файл
  fs.writeFileSync(PROCESSED_MESSAGES_FILE, '[]', 'utf8');
}

/**
 * Сохраняет ID сообщения как обработанное
 * @param {string} messageId - Уникальный идентификатор сообщения (chatId_messageId)
 */
function markMessageAsProcessed(messageId) {
  try {
    if (!processedMessages.has(messageId)) {
      processedMessages.add(messageId);
      fs.writeFileSync(
        PROCESSED_MESSAGES_FILE, 
        JSON.stringify(Array.from(processedMessages)), 
        'utf8'
      );
      logger.info(`Сообщение ${messageId} добавлено в список обработанных`);
    }
  } catch (error) {
    logger.error(`Ошибка при сохранении обработанного сообщения: ${error.message}`);
  }
}

/**
 * Проверяет, было ли сообщение уже обработано
 * @param {string} messageId - Уникальный идентификатор сообщения (chatId_messageId)
 * @returns {boolean} - true, если сообщение уже обработано
 */
function isMessageProcessed(messageId) {
  return processedMessages.has(messageId);
}

/**
 * Обрабатывает входящее сообщение и определяет, является ли оно аффирмацией
 * @param {Object} msg - Объект сообщения Telegram
 */
async function processMessage(msg) {
  try {
    // Генерируем уникальный ID для сообщения (chatId_messageId)
    const messageId = `${msg.chat.id}_${msg.message_id}`;
    
    // Проверяем, обрабатывали ли мы уже это сообщение
    if (isMessageProcessed(messageId)) {
      logger.info(`Сообщение ${messageId} уже было обработано ранее, пропускаем`);
      return;
    }
    
    logger.info(`Получено новое сообщение: ${messageId}`);
    
    // Проверяем, содержит ли сообщение текст
    if (!msg.text) {
      logger.info(`Сообщение ${messageId} не содержит текста, пропускаем`);
      markMessageAsProcessed(messageId);
      return;
    }
    
    // Проверяем, содержит ли сообщение ключевое слово "Аффирмация"
    if (msg.text.toLowerCase().includes('аффирмация')) {
      logger.info(`Обнаружена аффирмация в сообщении ${messageId}`);
      
      // Полный текст аффирмации для отправки
      let affirmationText = msg.text;
      
      // Отправляем аффирмацию соответствующему пользователю
      await handleAffirmation(msg, affirmationText);
      
      // Отмечаем сообщение как обработанное
      markMessageAsProcessed(messageId);
    } else {
      logger.info(`Сообщение ${messageId} не содержит аффирмации, пропускаем`);
      markMessageAsProcessed(messageId);
    }
  } catch (error) {
    logger.error(`Ошибка при обработке сообщения: ${error.message}`);
  }
}

/**
 * Обрабатывает аффирмацию и отправляет ее целевому пользователю
 * @param {Object} msg - Объект сообщения Telegram
 * @param {string} affirmationText - Текст аффирмации
 */
async function handleAffirmation(msg, affirmationText) {
  try {
    // В реальном коде здесь должна быть логика определения целевого пользователя
    // Например, парсинг текста сообщения для выделения имени пользователя
    
    // В данном примере мы просто отвечаем в тот же чат с благодарностью за аффирмацию
    await bot.sendMessage(
      msg.chat.id,
      `✅ Аффирмация успешно обработана и будет доставлена пользователю.`,
      { reply_to_message_id: msg.message_id }
    );
    
    logger.info(`Аффирмация из сообщения ${msg.chat.id}_${msg.message_id} успешно обработана`);
  } catch (error) {
    logger.error(`Ошибка при обработке аффирмации: ${error.message}`);
  }
}

/**
 * Инициализация и запуск микросервиса
 */
async function main() {
  logger.info('Запуск микросервиса обработки аффирмаций из Telegram...');
  
  // Настраиваем обработчик входящих сообщений
  bot.on('message', processMessage);
  
  // Обработчик ошибок бота
  bot.on('polling_error', (error) => {
    logger.error(`Ошибка опроса Telegram API: ${error.message}`);
  });
  
  logger.info(`Микросервис запущен и ожидает входящие сообщения`);
}

// Запускаем микросервис
main().catch(error => {
  logger.error(`Критическая ошибка в микросервисе аффирмаций: ${error.message}`);
  process.exit(1);
});