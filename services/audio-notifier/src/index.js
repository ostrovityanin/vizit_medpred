/**
 * Микросервис для отправки аудиозаписей и их расшифровок в Telegram группу
 * 
 * Данный сервис периодически проверяет наличие новых аудиозаписей, которые
 * еще не были отправлены в Telegram, и отправляет их вместе с транскрипцией.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { logger } = require('../utils/logger');
const { sendMessage, sendAudioWithTranscription, checkTelegramApiAvailability } = require('../utils/telegram');
const { sleep, formatDuration } = require('../utils/helpers');

// Конфигурация
const API_URL = process.env.API_URL || 'http://localhost:5000';
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || '60000', 10);
const TEMP_DIR = path.join(__dirname, '../temp');
const DATA_DIR = path.join(__dirname, '../data');

// Создаем временные директории, если они не существуют
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Файл для хранения информации об отправленных записях
const SENT_RECORDINGS_FILE = path.join(DATA_DIR, 'sent_recordings.json');

// Загружаем информацию об уже отправленных записях
let sentRecordings = [];
try {
  if (fs.existsSync(SENT_RECORDINGS_FILE)) {
    sentRecordings = JSON.parse(fs.readFileSync(SENT_RECORDINGS_FILE, 'utf8'));
    logger.info(`Загружено ${sentRecordings.length} записей из истории отправок`);
  }
} catch (error) {
  logger.error(`Ошибка загрузки истории отправок: ${error.message}`);
  // Создаем пустой файл истории
  fs.writeFileSync(SENT_RECORDINGS_FILE, '[]', 'utf8');
}

/**
 * Сохраняет информацию об отправленных записях в файл
 * @param {number|string} recordingId - ID записи
 */
function saveRecordingAsSent(recordingId) {
  try {
    if (!sentRecordings.includes(recordingId)) {
      sentRecordings.push(recordingId);
      fs.writeFileSync(SENT_RECORDINGS_FILE, JSON.stringify(sentRecordings), 'utf8');
      logger.info(`Запись ${recordingId} добавлена в историю отправок`);
    }
  } catch (error) {
    logger.error(`Ошибка сохранения истории отправок: ${error.message}`);
  }
}

/**
 * Проверяет наличие новых записей и отправляет их в Telegram
 */
async function checkAndSendNewRecordings() {
  try {
    // Получаем список всех записей через API
    const response = await axios.get(`${API_URL}/api/admin/recordings`);
    
    // Логируем ответ для отладки
    logger.info(`Получен ответ от API. Тип данных: ${typeof response.data}`);
    
    // Проверяем ответ и преобразуем его в массив записей
    let recordings = null;
    
    if (Array.isArray(response.data)) {
      // Прямой массив записей
      recordings = response.data;
      logger.info('API вернул массив записей напрямую');
    } else if (response.data && Array.isArray(response.data.recordings)) {
      // Объект с полем recordings, содержащим массив
      recordings = response.data.recordings;
      logger.info('API вернул объект с полем recordings');
    } else {
      logger.error('Неверный формат ответа от API при получении списка записей');
      logger.error(`Полученные данные: ${JSON.stringify(response.data).substring(0, 200)}...`);
      return;
    }
    
    if (!recordings || recordings.length === 0) {
      logger.info('API вернул пустой список записей');
      return;
    }
    
    logger.info(`Получено ${recordings.length} записей от API`);
    
    // Фильтруем только те записи, которые:
    // 1. Имеют статус "completed" (завершенные)
    // 2. Еще не были отправлены в Telegram
    // 3. Имеют транскрипцию
    const newRecordings = recordings.filter(recording => 
      recording.status === 'completed' && 
      !sentRecordings.includes(recording.id) &&
      recording.transcription // Проверяем наличие транскрипции
    );
    
    logger.info(`Найдено ${newRecordings.length} новых записей для отправки`);
    
    // Отправляем каждую новую запись в Telegram
    for (const recording of newRecordings) {
      await processAndSendRecording(recording);
    }
  } catch (error) {
    logger.error(`Ошибка при проверке новых записей: ${error.message}`);
    
    if (error.response) {
      logger.error(`Статус ответа: ${error.response.status}`);
      logger.error(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
  }
}

/**
 * Обрабатывает и отправляет запись в Telegram
 * @param {object} recording - Объект записи
 */
async function processAndSendRecording(recording) {
  try {
    logger.info(`Обработка записи ${recording.id} (${recording.title || 'Без названия'})`);
    
    // Получаем детальную информацию о записи через API
    const detailResponse = await axios.get(`${API_URL}/api/admin/recordings/${recording.id}`);
    
    // Проверяем формат ответа - может быть либо объект recording, либо запись напрямую
    const recordingDetail = detailResponse.data.recording || detailResponse.data;
    
    if (!recordingDetail || !recordingDetail.id) {
      logger.error(`Не удалось получить детальную информацию о записи ${recording.id}`);
      return;
    }
    
    // Скачиваем аудиофайл
    const audioFilePath = await downloadAudioFile(recording.id);
    
    if (!audioFilePath) {
      logger.error(`Не удалось скачать аудиофайл для записи ${recording.id}`);
      return;
    }
    
    // Подготавливаем метаданные для отправки
    const metadata = {
      id: recordingDetail.id,
      title: recordingDetail.title || 'Без названия',
      username: recordingDetail.senderUsername || recordingDetail.username || 'Неизвестный пользователь',
      duration: recordingDetail.duration,
      size: recordingDetail.fileSize || recordingDetail.size,
      createdAt: recordingDetail.timestamp || recordingDetail.createdAt
    };
    
    // Отправляем аудио с транскрипцией в Telegram
    const sent = await sendAudioWithTranscription(
      audioFilePath,
      recordingDetail.transcription,
      metadata
    );
    
    if (sent) {
      logger.info(`Запись ${recording.id} успешно отправлена в Telegram`);
      
      // Отмечаем на сервере, что запись отправлена
      await axios.post(`${API_URL}/api/admin/recordings/${recording.id}/mark-sent`, {
        sentAt: new Date().toISOString()
      });
      
      // Сохраняем информацию об отправке
      saveRecordingAsSent(recording.id);
      
      // Удаляем временный файл
      fs.unlinkSync(audioFilePath);
    } else {
      logger.error(`Ошибка отправки записи ${recording.id} в Telegram`);
    }
  } catch (error) {
    logger.error(`Ошибка при обработке записи ${recording.id}: ${error.message}`);
    
    if (error.response) {
      logger.error(`Статус ответа: ${error.response.status}`);
      logger.error(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
  }
}

/**
 * Скачивает аудиофайл записи
 * @param {number|string} recordingId - ID записи
 * @returns {Promise<string|null>} - Путь к скачанному файлу или null в случае ошибки
 */
async function downloadAudioFile(recordingId) {
  try {
    const filePath = path.join(TEMP_DIR, `recording_${recordingId}.wav`);
    
    // Создаем поток записи в файл
    const writer = fs.createWriteStream(filePath);
    
    // Делаем запрос на скачивание файла
    const response = await axios({
      url: `${API_URL}/api/recordings/${recordingId}/download`,
      method: 'GET',
      responseType: 'stream'
    });
    
    // Записываем данные в файл
    response.data.pipe(writer);
    
    // Возвращаем promise, который разрешится, когда файл будет полностью скачан
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        logger.info(`Аудиофайл для записи ${recordingId} успешно скачан: ${filePath}`);
        resolve(filePath);
      });
      writer.on('error', (err) => {
        logger.error(`Ошибка при скачивании аудиофайла для записи ${recordingId}: ${err.message}`);
        reject(err);
      });
    });
  } catch (error) {
    logger.error(`Ошибка при скачивании аудиофайла для записи ${recordingId}: ${error.message}`);
    return null;
  }
}

/**
 * Главная функция микросервиса
 */
async function main() {
  logger.info('Запуск микросервиса отправки аудио в Telegram...');
  
  // Проверяем доступность Telegram API
  const telegramAvailable = await checkTelegramApiAvailability();
  if (!telegramAvailable) {
    logger.error('Telegram API недоступен. Проверьте токен бота и подключение к интернету.');
    process.exit(1);
  }
  
  // Проверяем доступность основного API
  try {
    await axios.get(`${API_URL}/health`);
    logger.info(`API сервер доступен по адресу: ${API_URL}`);
  } catch (error) {
    logger.error(`API сервер недоступен: ${error.message}`);
    // Даже если API недоступен, продолжаем работу микросервиса
  }
  
  // Отправляем сообщение о запуске микросервиса
  await sendMessage(`<b>📢 Микросервис отправки аудио запущен</b>\n\nПериодичность проверки: ${CHECK_INTERVAL / 1000} сек.`);
  
  // Запускаем бесконечный цикл проверки новых записей
  while (true) {
    try {
      await checkAndSendNewRecordings();
    } catch (error) {
      logger.error(`Ошибка в главном цикле: ${error.message}`);
    }
    
    // Ждем указанный интервал перед следующей проверкой
    await sleep(CHECK_INTERVAL);
  }
}

// Запускаем микросервис
main().catch(error => {
  logger.error(`Критическая ошибка в микросервисе: ${error.message}`);
  process.exit(1);
});