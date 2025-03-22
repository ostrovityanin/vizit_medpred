import { request } from '@zos/request';
import { getDeviceInfo } from '@zos/device';
import { localStorage } from '@zos/storage';
import { file as fsFile } from '@zos/fs';

// Получаем информацию об устройстве для идентификации
const deviceInfo = getDeviceInfo();
const deviceId = deviceInfo.deviceName + '_' + deviceInfo.deviceId;

// Базовый URL сервера - будет автоматически заменен на URL сервера при компиляции
// В режиме разработки можно использовать localhost с правильным портом
const BASE_URL = 'https://telegram-voice-assistant.mrosminin.repl.co';

/**
 * Отправка аудиофайла на сервер
 * @param {string} filePath - Путь к записанному аудиофайлу
 * @param {string} sessionId - Уникальный идентификатор сессии записи
 * @param {number} index - Индекс фрагмента (используется для больших файлов)
 * @returns {Promise<object>} - Ответ сервера
 */
export const sendAudioFragment = async (filePath, sessionId, index = 0) => {
  try {
    console.log(`Отправка фрагмента: ${filePath}, sessionId: ${sessionId}, index: ${index}`);
    
    // Чтение файла в двоичном формате
    const fileData = await fsFile.read(filePath);
    
    if (!fileData || !fileData.length) {
      console.error('Ошибка: файл пуст или не существует');
      return { error: 'Файл пуст или не существует' };
    }
    
    console.log(`Размер файла: ${fileData.byteLength} байт`);
    
    // Формирование multipart/form-data
    const formData = new FormData();
    formData.append('fragmentAudio', fileData, { filename: `fragment-${sessionId}-${index}.webm` });
    formData.append('sessionId', sessionId);
    formData.append('index', index.toString());
    formData.append('deviceId', deviceId);
    
    console.log('Отправка запроса на сервер...');
    
    // Отправка запроса на новый API эндпоинт для Zepp
    const result = await request({
      method: 'POST',
      url: `${BASE_URL}/api/zepp/recording-fragments`,
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      body: formData
    });
    
    if (result && (result.statusCode === 200 || result.statusCode === 201)) {
      console.log('Фрагмент успешно отправлен');
      return JSON.parse(result.body);
    } else {
      console.error(`Ошибка отправки файла: ${result ? result.statusCode : 'Нет ответа'}`);
      return { error: `Ошибка отправки (${result ? result.statusCode : 'Нет ответа'})` };
    }
  } catch (error) {
    console.error('Ошибка при отправке аудио:', error);
    return { error: 'Ошибка отправки: ' + (error.message || JSON.stringify(error)) };
  }
};

/**
 * Уведомление сервера о завершении записи, запрос объединения фрагментов
 * @param {string} sessionId - Идентификатор сессии записи
 * @param {number} duration - Общая длительность записи в секундах
 * @param {number} fragmentCount - Количество фрагментов
 * @returns {Promise<object>} - Ответ сервера с информацией о записи
 */
export const finishRecording = async (sessionId, duration = 0, fragmentCount = 0) => {
  try {
    console.log(`Завершение записи: sessionId: ${sessionId}, длительность: ${duration}с, фрагментов: ${fragmentCount}`);
    
    // Отправка запроса на новый API эндпоинт для Zepp
    const result = await request({
      method: 'POST',
      url: `${BASE_URL}/api/zepp/finalize-recording`,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId,
        deviceId,
        duration,
        fragments: fragmentCount
      })
    });
    
    if (result && (result.statusCode === 200 || result.statusCode === 201)) {
      console.log('Запись успешно завершена на сервере');
      return JSON.parse(result.body);
    } else {
      console.error(`Ошибка завершения записи: ${result ? result.statusCode : 'Нет ответа'}`);
      return { error: `Ошибка завершения (${result ? result.statusCode : 'Нет ответа'})` };
    }
  } catch (error) {
    console.error('Ошибка при запросе завершения:', error);
    return { error: 'Ошибка: ' + (error.message || JSON.stringify(error)) };
  }
};

/**
 * Сохранение и получение информации о сессии записи
 */
export const saveSessionInfo = (sessionId, info) => {
  try {
    localStorage.setItem(`session_${sessionId}`, JSON.stringify(info));
    return true;
  } catch (e) {
    console.error('Ошибка сохранения сессии:', e);
    return false;
  }
};

export const getSessionInfo = (sessionId) => {
  try {
    const data = localStorage.getItem(`session_${sessionId}`);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Ошибка получения сессии:', e);
    return null;
  }
};

/**
 * Генерация уникального идентификатора сессии
 */
export const generateSessionId = () => {
  return Date.now().toString() + '-' + Math.floor(Math.random() * 1000).toString();
};