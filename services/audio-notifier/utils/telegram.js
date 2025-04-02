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
      // Включаем HTML-разметку для подписи
      form.append('parse_mode', 'HTML');
    }
    
    // Отправляем аудио
    const response = await axios.post(`${TELEGRAM_API_URL}/sendAudio`, form, {
      headers: form.getHeaders()
    });
    
    logger.info(`Аудиофайл успешно отправлен в чат ${chatId}: ${filePath}`);
    if (caption) {
      logger.info(`Прикреплена подпись к аудио с транскрипцией: ${caption.substring(0, 50)}...`);
    }
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
    
    // Проверяем размер транскрипции для подписи
    let audioCaption = '';
    const MAX_CAPTION_LENGTH = 1024; // Максимальная длина подписи в Telegram
    
    if (transcription) {
      // Подготавливаем транскрипцию для подписи
      const transcriptionPreview = transcription.length > 800 
        ? transcription.substring(0, 790) + '...' 
        : transcription;
        
      const shortTranscription = `<b>📝 Транскрипция:</b>\n\n<i>${transcriptionPreview}</i>`;
      
      if (shortTranscription.length <= MAX_CAPTION_LENGTH) {
        audioCaption = shortTranscription;
        
        // Если транскрипция была сокращена, добавляем сообщение об этом
        if (transcription.length > 800) {
          audioCaption += '\n\n<i>Показана часть транскрипции. Полный текст отправлен отдельным сообщением.</i>';
        }
      }
    }
    
    // Отправляем аудиофайл с транскрипцией в подписи, если она подходит по размеру
    const audioSent = await sendAudioFile(filePath, audioCaption, chatId);
    
    // Если транскрипция длинная, всегда отправляем полную версию отдельным сообщением
    if (transcription && transcription.length > 300) {
      // Разбиваем транскрипцию на части, если она очень длинная
      const transcriptionParts = chunkText(transcription, 3000);
      
      // Отправляем заголовок для транскрипции
      await sendMessage(`<b>📝 Полная транскрипция аудиозаписи:</b>`, chatId);
      
      // Отправляем части транскрипции
      for (let i = 0; i < transcriptionParts.length; i++) {
        // Добавляем номер части, если частей больше одной
        let partText = transcriptionParts[i];
        if (transcriptionParts.length > 1) {
          partText = `<i>Часть ${i+1}/${transcriptionParts.length}</i>\n\n${partText}`;
        }
        
        await sendMessage(partText, chatId);
      }
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
    createdAt,
    senderUsername = null,
    targetUsername = null,
    status = null
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
    const seconds = Math.floor(duration % 60);
    durationStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Формируем заголовок
  let header = `<b>🎙️ Новая аудиозапись</b>\n\n`;
  
  // Добавляем основную информацию
  header += `📟 <b>ID записи:</b> ${id || 'Не указан'}\n`;
  header += `📌 <b>Название:</b> ${title}\n`;
  header += `👤 <b>Пользователь:</b> ${username}\n`;
  
  // Добавляем информацию об отправителе и получателе, если есть
  if (senderUsername) {
    header += `📤 <b>Отправитель:</b> ${senderUsername}\n`;
  }
  if (targetUsername) {
    header += `📥 <b>Получатель:</b> ${targetUsername}\n`;
  }
  
  // Добавляем техническую информацию
  header += `⏱️ <b>Длительность:</b> ${durationStr}\n`;
  header += `💾 <b>Размер файла:</b> ${sizeStr}\n`;
  header += `📅 <b>Дата записи:</b> ${dateStr}\n`;
  
  // Добавляем статус записи, если он указан
  if (status) {
    const statusEmoji = {
      'started': '🟡',
      'completed': '🟢',
      'failed': '🔴',
      'pending': '⚪',
      'sent': '📨',
      'error': '⚠️'
    };
    const emoji = statusEmoji[status] || '❓';
    header += `${emoji} <b>Статус:</b> ${status}\n`;
  }
  
  return header;
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