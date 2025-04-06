/**
 * Модуль управления записями
 * 
 * Отвечает за сохранение записей, обработку фрагментов
 * и обеспечение целостности данных при потере соединения.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { storage } from '../../storage';
import { fragmentManager } from '../../fragments.js';
import { log } from '../../vite';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOADS_DIR = path.join(dirname(dirname(dirname(__dirname))), 'uploads');

// Создаем директорию для загрузок, если она не существует
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Настройка хранилища multer для аудиофайлов
const storageConfig = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  }
});

// Настройка загрузчика файлов
export const upload = multer({ 
  storage: storageConfig,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Файл не является аудио'));
    }
  }
});

/**
 * Создает новую запись со статусом "started"
 * @param {Object} data Данные для создания записи
 * @returns {Promise<Object>} Созданная запись
 */
export async function startRecording(data) {
  try {
    const { targetUsername, senderUsername = "Пользователь" } = data;
    
    const timestamp = new Date().toISOString();
    
    const validData = {
      filename: '',  // Будет заполнено после записи
      duration: 0,   // Будет обновлено после записи
      timestamp,
      targetUsername,
      senderUsername,
      status: 'started'
    };
    
    const recording = await storage.createRecording(validData);
    
    log(`Создана новая запись (ID: ${recording.id}) со статусом 'started'`, 'recording');
    
    return recording;
  } catch (error) {
    log(`Ошибка при создании записи со статусом 'started': ${error}`, 'recording');
    throw error;
  }
}

/**
 * Завершает запись и обрабатывает аудиофайл
 * @param {number} recordingId ID записи
 * @param {Object} options Опции для завершения записи
 * @returns {Promise<Object>} Обновленная запись
 */
export async function completeRecording(recordingId, options = {}) {
  try {
    const { forceProcess = false, sessionId = null } = options;
    
    const recording = await storage.getRecordingById(recordingId);
    
    if (!recording) {
      throw new Error(`Запись с ID ${recordingId} не найдена`);
    }
    
    // Обновляем статус на 'completed'
    await storage.updateRecordingStatus(recordingId, 'completed');
    
    // Если передан ID сессии или включен режим принудительной обработки,
    // получаем фрагменты и объединяем их
    if (sessionId || forceProcess) {
      log(`${forceProcess ? 'Принудительная обработка' : 'Обработка сессии'}: получаем фрагменты для записи ID: ${recordingId}`, 'fragments');
      
      // Получаем все фрагменты для этой записи
      const fragments = await storage.getRecordingFragments(recordingId);
      
      if (fragments && fragments.length > 0) {
        // Если сессия не указана, пытаемся получить ее из первого фрагмента
        const sessionIdToUse = sessionId || fragments[0].sessionId;
        
        // Отфильтровываем только фрагменты для этой сессии
        const sessionFragments = fragments.filter(f => f.sessionId === sessionIdToUse);
        
        if (sessionFragments.length > 0) {
          log(`Найдено ${sessionFragments.length} фрагментов для сессии ${sessionIdToUse}`, 'fragments');
          
          try {
            // Объединяем фрагменты и получаем итоговый файл
            const outputFilename = await fragmentManager.mergeFragments(sessionFragments, UPLOADS_DIR);
            
            if (outputFilename) {
              log(`Фрагменты объединены в файл: ${outputFilename}`, 'fragments');
              
              // Обновляем запись с путем к файлу и вычисляем размер
              const filePath = path.join(UPLOADS_DIR, outputFilename);
              let fileSize = 0;
              let duration = 0;
              
              if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                fileSize = stats.size;
                
                // Получаем продолжительность как сумму продолжительностей всех фрагментов
                duration = sessionFragments.reduce((total, fragment) => total + (fragment.duration || 0), 0);
              }
              
              // Обновляем запись
              const updatedRecording = await storage.updateRecording(recordingId, {
                filename: outputFilename,
                fileSize,
                duration,
                status: 'completed'
              });
              
              return updatedRecording;
            } else {
              log(`Не удалось объединить фрагменты для сессии ${sessionIdToUse}`, 'fragments');
              // Обновляем статус записи на 'error'
              await storage.updateRecordingStatus(recordingId, 'error');
              throw new Error('Не удалось объединить фрагменты');
            }
          } catch (error) {
            log(`Ошибка при объединении фрагментов: ${error}`, 'fragments');
            // Обновляем статус записи на 'error'
            await storage.updateRecordingStatus(recordingId, 'error');
            throw error;
          }
        } else {
          log(`Не найдено фрагментов для сессии ${sessionIdToUse}`, 'fragments');
          throw new Error(`Не найдено фрагментов для сессии ${sessionIdToUse}`);
        }
      } else {
        log(`Не найдено фрагментов для записи ID: ${recordingId}`, 'fragments');
        throw new Error(`Не найдено фрагментов для записи ID: ${recordingId}`);
      }
    } else {
      // Если не передан ID сессии и не включен режим принудительной обработки,
      // просто возвращаем обновленную запись
      return await storage.getRecordingById(recordingId);
    }
  } catch (error) {
    log(`Ошибка при завершении записи: ${error}`, 'recording');
    throw error;
  }
}

/**
 * Добавляет фрагмент к записи
 * @param {Object} fragmentData Данные фрагмента
 * @returns {Promise<Object>} Созданный фрагмент
 */
export async function addRecordingFragment(fragmentData) {
  try {
    const { recordingId, sessionId, index, audio, duration } = fragmentData;
    
    if (!recordingId || !sessionId || !audio) {
      throw new Error('Не указаны обязательные параметры: recordingId, sessionId, audio');
    }
    
    // Сохраняем фрагмент в файл
    const fragment = await fragmentManager.saveFragment(recordingId, sessionId, index, audio, UPLOADS_DIR);
    
    // Добавляем информацию о фрагменте в базу данных
    const createdFragment = await storage.createRecordingFragment({
      recordingId,
      sessionId,
      fragmentIndex: index,
      filename: fragment.filename,
      duration: duration || 0
    });
    
    log(`Создан фрагмент записи ${recordingId}: сессия ${sessionId}, индекс ${index}`, 'fragments');
    
    return createdFragment;
  } catch (error) {
    log(`Ошибка при добавлении фрагмента: ${error}`, 'fragments');
    throw error;
  }
}

/**
 * Получает все фрагменты для записи
 * @param {number} recordingId ID записи
 * @returns {Promise<Array>} Список фрагментов
 */
export async function getRecordingFragments(recordingId) {
  try {
    return await storage.getRecordingFragments(recordingId);
  } catch (error) {
    log(`Ошибка при получении фрагментов записи: ${error}`, 'fragments');
    throw error;
  }
}

/**
 * Получает все записи
 * @returns {Promise<Array>} Список записей
 */
export async function getAllRecordings() {
  try {
    return await storage.getRecordings();
  } catch (error) {
    log(`Ошибка при получении списка записей: ${error}`, 'recording');
    throw error;
  }
}

/**
 * Получает запись по ID
 * @param {number} recordingId ID записи
 * @returns {Promise<Object>} Запись
 */
export async function getRecordingById(recordingId) {
  try {
    return await storage.getRecordingById(recordingId);
  } catch (error) {
    log(`Ошибка при получении записи по ID: ${error}`, 'recording');
    throw error;
  }
}

/**
 * Удаляет запись
 * @param {number} recordingId ID записи
 * @returns {Promise<boolean>} Результат удаления
 */
export async function deleteRecording(recordingId) {
  try {
    // Получаем информацию о записи
    const recording = await storage.getRecordingById(recordingId);
    
    if (!recording) {
      throw new Error(`Запись с ID ${recordingId} не найдена`);
    }
    
    // Удаляем файл, если он существует
    if (recording.filename) {
      const filePath = path.join(UPLOADS_DIR, recording.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        log(`Удален файл записи: ${filePath}`, 'recording');
      }
    }
    
    // Получаем и удаляем все фрагменты
    const fragments = await storage.getRecordingFragments(recordingId);
    
    for (const fragment of fragments) {
      if (fragment.filename) {
        const fragmentPath = path.join(UPLOADS_DIR, fragment.filename);
        if (fs.existsSync(fragmentPath)) {
          fs.unlinkSync(fragmentPath);
          log(`Удален файл фрагмента: ${fragmentPath}`, 'fragments');
        }
      }
      
      // Удаляем запись о фрагменте
      await storage.deleteRecordingFragment(fragment.id);
    }
    
    // Удаляем саму запись
    return await storage.deleteRecording(recordingId);
  } catch (error) {
    log(`Ошибка при удалении записи: ${error}`, 'recording');
    throw error;
  }
}

/**
 * Получает путь к файлу записи
 * @param {number} recordingId ID записи
 * @returns {Promise<string>} Путь к файлу
 */
export async function getRecordingFilePath(recordingId) {
  try {
    const recording = await storage.getRecordingById(recordingId);
    
    if (!recording || !recording.filename) {
      throw new Error(`Запись с ID ${recordingId} не найдена или не имеет файла`);
    }
    
    const filePath = path.join(UPLOADS_DIR, recording.filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Файл записи не существует: ${filePath}`);
    }
    
    return filePath;
  } catch (error) {
    log(`Ошибка при получении пути к файлу записи: ${error}`, 'recording');
    throw error;
  }
}

export default {
  upload,
  startRecording,
  completeRecording,
  addRecordingFragment,
  getRecordingFragments,
  getAllRecordings,
  getRecordingById,
  deleteRecording,
  getRecordingFilePath
};