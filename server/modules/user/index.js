/**
 * Модуль управления пользователями
 * 
 * Отвечает за работу с пользователями, их настройками
 * и доступом к записям.
 */

import { storage } from '../../storage';
import { log } from '../../vite';
import { sendTextToTelegram, resolveTelegramUsername } from '../../telegram';
import { resolveClientUsername, sendClientTextMessage, notifyUserAboutRecording } from '../../client-bot';

/**
 * Проверяет существование пользователя
 * @param {string} username Имя пользователя
 * @returns {Promise<boolean>} Существует ли пользователь
 */
export async function userExists(username) {
  try {
    // Пытаемся найти пользователя в базе
    const userRecordings = await storage.getUserRecordings(username);
    return userRecordings.length > 0;
  } catch (error) {
    log(`Ошибка при проверке существования пользователя: ${error}`, 'user');
    return false;
  }
}

/**
 * Получает записи пользователя
 * @param {string} username Имя пользователя
 * @returns {Promise<Array>} Список записей пользователя
 */
export async function getUserRecordings(username) {
  try {
    return await storage.getUserRecordings(username);
  } catch (error) {
    log(`Ошибка при получении записей пользователя: ${error}`, 'user');
    throw error;
  }
}

/**
 * Добавляет запись пользователю
 * @param {Object} data Данные записи пользователя
 * @returns {Promise<Object>} Созданная запись пользователя
 */
export async function addUserRecording(data) {
  try {
    const { adminRecordingId, username, duration, timestamp } = data;
    
    if (!adminRecordingId || !username) {
      throw new Error('Не указаны обязательные параметры: adminRecordingId, username');
    }
    
    // Создаем запись пользователя
    const userRecording = await storage.createUserRecording({
      adminRecordingId,
      username,
      duration: duration || 0,
      timestamp: timestamp || new Date().toISOString()
    });
    
    log(`Создана запись пользователя ${username} (ID: ${userRecording.id})`, 'user');
    
    return userRecording;
  } catch (error) {
    log(`Ошибка при добавлении записи пользователю: ${error}`, 'user');
    throw error;
  }
}

/**
 * Отправляет уведомление пользователю о новой записи
 * @param {string} username Имя пользователя
 * @param {number} adminRecordingId ID записи в админке
 * @returns {Promise<Object>} Результат отправки уведомления
 */
export async function notifyUserAboutNewRecording(username, adminRecordingId) {
  try {
    // Получаем запись из админки
    const recording = await storage.getRecordingById(adminRecordingId);
    
    if (!recording) {
      throw new Error(`Запись с ID ${adminRecordingId} не найдена`);
    }
    
    // Пытаемся отправить уведомление через клиентского бота
    try {
      const result = await notifyUserAboutRecording(username, recording);
      log(`Уведомление отправлено пользователю ${username} через клиентского бота`, 'user');
      return result;
    } catch (clientError) {
      log(`Ошибка при отправке уведомления через клиентского бота: ${clientError}`, 'user');
      
      // Если не удалось отправить через клиентского бота, пытаемся через основного
      try {
        // Формируем текст сообщения
        const duration = recording.duration ? Math.round(recording.duration) : 'неизвестно';
        const message = `Для вас записано новое аудио${recording.senderUsername ? ` от ${recording.senderUsername}` : ''}! Продолжительность: ${duration} секунд.`;
        
        // Пытаемся отправить через основного бота
        const result = await sendTextToTelegram(username, message);
        log(`Уведомление отправлено пользователю ${username} через основного бота`, 'user');
        return result;
      } catch (mainError) {
        log(`Ошибка при отправке уведомления через основного бота: ${mainError}`, 'user');
        throw new Error(`Не удалось отправить уведомление пользователю ${username}`);
      }
    }
  } catch (error) {
    log(`Ошибка при отправке уведомления пользователю: ${error}`, 'user');
    throw error;
  }
}

/**
 * Получает ID чата пользователя Telegram
 * @param {string} username Имя пользователя
 * @returns {Promise<string>} ID чата пользователя
 */
export async function getUserChatId(username) {
  try {
    // Сначала пытаемся получить ID через клиентского бота
    try {
      const chatId = await resolveClientUsername(username);
      if (chatId) {
        return chatId;
      }
    } catch (clientError) {
      log(`Ошибка при получении chat_id через клиентского бота: ${clientError}`, 'user');
    }
    
    // Если не удалось через клиентского бота, пытаемся через основного
    try {
      const chatId = await resolveTelegramUsername(username);
      if (chatId) {
        return chatId;
      }
    } catch (mainError) {
      log(`Ошибка при получении chat_id через основного бота: ${mainError}`, 'user');
    }
    
    throw new Error(`Не удалось получить chat_id для пользователя ${username}`);
  } catch (error) {
    log(`Ошибка при получении chat_id пользователя: ${error}`, 'user');
    throw error;
  }
}

/**
 * Отправляет сообщение пользователю
 * @param {string} username Имя пользователя или ID чата
 * @param {string} message Текст сообщения
 * @returns {Promise<Object>} Результат отправки сообщения
 */
export async function sendMessageToUser(username, message) {
  try {
    // Сначала пытаемся отправить через клиентского бота
    try {
      const result = await sendClientTextMessage(username, message);
      log(`Сообщение отправлено пользователю ${username} через клиентского бота`, 'user');
      return result;
    } catch (clientError) {
      log(`Ошибка при отправке сообщения через клиентского бота: ${clientError}`, 'user');
      
      // Если не удалось отправить через клиентского бота, пытаемся через основного
      try {
        const result = await sendTextToTelegram(username, message);
        log(`Сообщение отправлено пользователю ${username} через основного бота`, 'user');
        return result;
      } catch (mainError) {
        log(`Ошибка при отправке сообщения через основного бота: ${mainError}`, 'user');
        throw new Error(`Не удалось отправить сообщение пользователю ${username}`);
      }
    }
  } catch (error) {
    log(`Ошибка при отправке сообщения пользователю: ${error}`, 'user');
    throw error;
  }
}

export default {
  userExists,
  getUserRecordings,
  addUserRecording,
  notifyUserAboutNewRecording,
  getUserChatId,
  sendMessageToUser
};