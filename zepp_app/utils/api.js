import { request } from '@zos/request';
import { getDeviceInfo } from '@zos/device';
import { localStorage } from '@zos/storage';

// Получаем информацию об устройстве для идентификации
const deviceInfo = getDeviceInfo();
const deviceId = deviceInfo.deviceName + '_' + deviceInfo.deviceId;

// Базовый URL сервера, будет меняться на URL вашего сервера
const BASE_URL = 'https://your-server-url.example';

/**
 * Отправка аудиофайла на сервер
 * @param {string} filePath - Путь к записанному аудиофайлу
 * @param {string} sessionId - Уникальный идентификатор сессии записи
 * @param {number} index - Индекс фрагмента (используется для больших файлов)
 * @returns {Promise<object>} - Ответ сервера
 */
export const sendAudioFragment = async (filePath, sessionId, index = 0) => {
  try {
    // Чтение файла в двоичном формате
    const fileData = await hmFS.readFile(filePath);
    
    // Формирование multipart/form-data
    const formData = new FormData();
    formData.append('fragmentAudio', fileData, { filename: `fragment-${sessionId}-${index}.webm` });
    formData.append('sessionId', sessionId);
    formData.append('index', index.toString());
    formData.append('deviceId', deviceId);
    
    // Отправка запроса
    const result = await request({
      method: 'POST',
      url: `${BASE_URL}/api/recording-fragments`,
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      body: formData
    });
    
    if (result.statusCode === 200) {
      return JSON.parse(result.body);
    } else {
      console.error('Ошибка отправки файла:', result.statusCode);
      return { error: `Ошибка отправки (${result.statusCode})` };
    }
  } catch (error) {
    console.error('Ошибка при отправке аудио:', error);
    return { error: 'Ошибка отправки: ' + error.message };
  }
};

/**
 * Уведомление сервера о завершении записи, запрос объединения фрагментов
 * @param {string} sessionId - Идентификатор сессии записи
 * @returns {Promise<object>} - Ответ сервера с информацией о записи
 */
export const finishRecording = async (sessionId) => {
  try {
    const result = await request({
      method: 'GET',
      url: `${BASE_URL}/api/recording-fragments/combine?sessionId=${sessionId}`,
    });
    
    if (result.statusCode === 200) {
      return JSON.parse(result.body);
    } else {
      console.error('Ошибка завершения записи:', result.statusCode);
      return { error: `Ошибка завершения (${result.statusCode})` };
    }
  } catch (error) {
    console.error('Ошибка при запросе завершения:', error);
    return { error: 'Ошибка: ' + error.message };
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