/**
 * Утилиты для взаимодействия с Telegram API в микросервисе audio-notifier
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { logger } = require('./logger');
const { chunkText } = require('./helpers');

// Получаем токен и ID чата из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Базовый URL для Telegram Bot API
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Отправляет текстовое сообщение в Telegram
 * @param {string} text - Текст сообщения
 * @param {number|string} chatId - ID чата (если не указан, используется ID из .env)
 * @returns {Promise<boolean>} - Результат отправки
 */
async function sendMessage(text, chatId = TELEGRAM_CHAT_ID) {
  try {
    if (!text || !chatId) {
      logger.error('Ошибка отправки сообщения: отсутствует текст или ID чата');
      return false;
    }

    // Разбиваем длинный текст на части
    const textChunks = chunkText(text);
    
    for (const chunk of textChunks) {
      await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
        chat_id: chatId,
        text: chunk,
        parse_mode: 'HTML'
      });
      
      // Небольшая задержка между отправкой сообщений, чтобы не превысить лимиты API
      if (textChunks.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    logger.info(`Сообщение успешно отправлено в чат ${chatId}`);
    return true;
  } catch (error) {
    logger.error(`Ошибка отправки сообщения в Telegram: ${error.message}`);
    
    if (error.response) {
      logger.error(`Ответ API: ${JSON.stringify(error.response.data)}`);
    }
    
    return false;
  }
}

/**
 * Отправляет аудиофайл в Telegram
 * @param {string} filePath - Путь к аудиофайлу
 * @param {string} caption - Подпись к аудио (необязательно)
 * @param {number|string} chatId - ID чата (если не указан, используется ID из .env)
 * @returns {Promise<boolean>} - Результат отправки
 */
async function sendAudioFile(filePath, caption = '', chatId = TELEGRAM_CHAT_ID) {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      logger.error(`Ошибка отправки аудио: файл не существует - ${filePath}`);
      return false;
    }

    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('audio', fs.createReadStream(filePath));
    
    // Если есть подпись, добавляем её (ограничена 1024 символами)
    if (caption) {
      form.append('caption', caption.length > 1024 ? caption.substring(0, 1021) + '...' : caption);
    }
    
    // Отправляем аудио
    const response = await axios.post(`${TELEGRAM_API_URL}/sendAudio`, form, {
      headers: form.getHeaders()
    });
    
    logger.info(`Аудиофайл успешно отправлен в чат ${chatId}: ${filePath}`);
    return response.data.ok;
  } catch (error) {
    logger.error(`Ошибка отправки аудио в Telegram: ${error.message}`);
    
    if (error.response) {
      logger.error(`Ответ API: ${JSON.stringify(error.response.data)}`);
    }
    
    return false;
  }
}

/**
 * Отправляет аудиофайл и его транскрипцию в Telegram
 * @param {string} filePath - Путь к аудиофайлу
 * @param {string} transcription - Текст транскрипции
 * @param {object} metadata - Метаданные записи (название, продолжительность и т.д.)
 * @param {number|string} chatId - ID чата (если не указан, используется ID из .env)
 * @returns {Promise<boolean>} - Результат отправки
 */
async function sendAudioWithTranscription(filePath, transcription, metadata = {}, chatId = TELEGRAM_CHAT_ID) {
  try {
    // Формируем заголовок сообщения с метаданными
    const headerText = formatRecordingHeader(metadata);
    
    // Отправляем заголовок
    await sendMessage(headerText, chatId);
    
    // Отправляем аудиофайл
    const audioSent = await sendAudioFile(filePath, '', chatId);
    
    // Если транскрипция есть, отправляем её
    if (transcription) {
      const transcriptionText = `<b>Транскрипция:</b>\n\n${transcription}`;
      await sendMessage(transcriptionText, chatId);
    }
    
    return audioSent;
  } catch (error) {
    logger.error(`Ошибка отправки аудио с транскрипцией: ${error.message}`);
    return false;
  }
}

/**
 * Форматирует заголовок записи с метаданными
 * @param {object} metadata - Метаданные записи
 * @returns {string} - Отформатированный заголовок
 */
function formatRecordingHeader(metadata = {}) {
  const {
    id,
    title = 'Без названия',
    username = 'Неизвестный пользователь',
    duration = 0,
    size = 0,
    createdAt
  } = metadata;
  
  // Форматируем дату и время
  let dateStr = 'Время неизвестно';
  if (createdAt) {
    const date = new Date(createdAt);
    dateStr = date.toLocaleString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  // Форматируем размер файла
  let sizeStr = 'Размер неизвестен';
  if (size) {
    if (size < 1024) {
      sizeStr = `${size} байт`;
    } else if (size < 1024 * 1024) {
      sizeStr = `${(size / 1024).toFixed(1)} Кб`;
    } else {
      sizeStr = `${(size / (1024 * 1024)).toFixed(1)} Мб`;
    }
  }
  
  // Форматируем продолжительность
  let durationStr = 'Длительность неизвестна';
  if (duration) {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    durationStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Формируем заголовок
  return `<b>🎙️ Новая аудиозапись</b>\n\n` +
         `<b>ID:</b> ${id || 'Не указан'}\n` +
         `<b>Название:</b> ${title}\n` +
         `<b>Пользователь:</b> ${username}\n` +
         `<b>Длительность:</b> ${durationStr}\n` +
         `<b>Размер:</b> ${sizeStr}\n` +
         `<b>Дата записи:</b> ${dateStr}`;
}

/**
 * Проверяет доступность Telegram Bot API
 * @returns {Promise<boolean>} - Доступен ли API
 */
async function checkTelegramApiAvailability() {
  try {
    const response = await axios.get(`${TELEGRAM_API_URL}/getMe`);
    return response.data.ok;
  } catch (error) {
    logger.error(`Ошибка проверки доступности Telegram API: ${error.message}`);
    return false;
  }
}

module.exports = {
  sendMessage,
  sendAudioFile,
  sendAudioWithTranscription,
  checkTelegramApiAvailability
};