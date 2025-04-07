/**
 * Модуль админ-панели
 * 
 * Отвечает за функциональность администраторской панели,
 * включая управление записями, пользователями и статистикой.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { storage } from '../../storage';
import { fragmentManager } from '../../fragments.js';
import { log } from '../../vite';
import { transcribeAudio } from '../../transcription-api';
import { compareTranscriptionModels } from '../transcription';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'recordings');

/**
 * Получает все записи для админ-панели
 * @param {Object} options Опции для запроса
 * @returns {Promise<Array>} Список записей
 */
export async function getAdminRecordings(options = {}) {
  try {
    const { 
      limit = 50, 
      offset = 0,
      sortBy = 'timestamp',
      sortDir = 'desc'
    } = options;
    
    // Получаем записи из хранилища
    const recordings = await storage.getRecordings();
    
    // Применяем сортировку
    recordings.sort((a, b) => {
      // Безопасное сравнение для null/undefined значений
      const valueA = a[sortBy] === undefined || a[sortBy] === null ? '' : a[sortBy];
      const valueB = b[sortBy] === undefined || b[sortBy] === null ? '' : b[sortBy];
      
      // Числовое сравнение для id и duration
      if (sortBy === 'id' || sortBy === 'duration' || sortBy === 'fileSize') {
        return sortDir === 'asc' ? valueA - valueB : valueB - valueA;
      }
      
      // Строковое сравнение для остальных полей
      if (sortDir === 'asc') {
        return String(valueA).localeCompare(String(valueB));
      } else {
        return String(valueB).localeCompare(String(valueA));
      }
    });
    
    // Применяем пагинацию
    const paginatedRecordings = recordings.slice(offset, offset + limit);
    
    // Добавляем дополнительные данные к каждой записи
    for (const recording of paginatedRecordings) {
      // Проверяем наличие файла
      if (recording.filename) {
        const filePath = path.join(UPLOADS_DIR, recording.filename);
        recording.fileExists = fs.existsSync(filePath);
      } else {
        recording.fileExists = false;
      }
      
      // Добавляем количество фрагментов
      try {
        const fragments = await storage.getRecordingFragments(recording.id);
        recording.fragmentsCount = fragments.length;
        
        // Если есть фрагменты, но нет файла, проверяем возможность объединения
        if (fragments.length > 0 && !recording.fileExists) {
          recording.canMergeFragments = true;
        } else {
          recording.canMergeFragments = false;
        }
      } catch (error) {
        recording.fragmentsCount = 0;
        recording.canMergeFragments = false;
      }
    }
    
    return {
      recordings: paginatedRecordings,
      total: recordings.length,
      limit,
      offset
    };
  } catch (error) {
    log(`Ошибка при получении записей для админ-панели: ${error}`, 'admin');
    throw error;
  }
}

/**
 * Получает запись для админ-панели по ID
 * @param {number} recordingId ID записи
 * @returns {Promise<Object>} Запись с дополнительными данными
 */
export async function getAdminRecordingById(recordingId) {
  try {
    // Получаем запись из хранилища
    const recording = await storage.getRecordingById(recordingId);
    
    if (!recording) {
      throw new Error(`Запись с ID ${recordingId} не найдена`);
    }
    
    // Проверяем наличие файла
    if (recording.filename) {
      const filePath = path.join(UPLOADS_DIR, recording.filename);
      recording.fileExists = fs.existsSync(filePath);
      
      if (recording.fileExists) {
        // Получаем размер файла
        const stats = fs.statSync(filePath);
        recording.actualFileSize = stats.size;
      }
    } else {
      recording.fileExists = false;
    }
    
    // Получаем фрагменты
    const fragments = await storage.getRecordingFragments(recordingId);
    recording.fragments = fragments;
    
    // Если есть фрагменты, но нет файла, проверяем возможность объединения
    if (fragments.length > 0 && !recording.fileExists) {
      recording.canMergeFragments = true;
      
      // Группируем фрагменты по сессиям
      const sessionGroups = {};
      
      for (const fragment of fragments) {
        if (!sessionGroups[fragment.sessionId]) {
          sessionGroups[fragment.sessionId] = [];
        }
        sessionGroups[fragment.sessionId].push(fragment);
      }
      
      // Сортируем фрагменты в каждой сессии
      for (const sessionId in sessionGroups) {
        sessionGroups[sessionId].sort((a, b) => a.fragmentIndex - b.fragmentIndex);
      }
      
      recording.sessionGroups = sessionGroups;
    } else {
      recording.canMergeFragments = false;
      recording.sessionGroups = {};
    }
    
    return recording;
  } catch (error) {
    log(`Ошибка при получении записи для админ-панели: ${error}`, 'admin');
    throw error;
  }
}

/**
 * Удаляет запись
 * @param {number} recordingId ID записи
 * @returns {Promise<Object>} Результат удаления
 */
export async function deleteAdminRecording(recordingId) {
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
        log(`Удален файл записи: ${filePath}`, 'admin');
      }
    }
    
    // Получаем и удаляем все фрагменты
    const fragments = await storage.getRecordingFragments(recordingId);
    
    for (const fragment of fragments) {
      if (fragment.filename) {
        const fragmentPath = path.join(process.cwd(), 'data', 'fragments', fragment.filename);
        if (fs.existsSync(fragmentPath)) {
          fs.unlinkSync(fragmentPath);
          log(`Удален файл фрагмента: ${fragmentPath}`, 'admin');
        }
      }
      
      // Удаляем запись о фрагменте
      await storage.deleteRecordingFragment(fragment.id);
    }
    
    // Удаляем пользовательские записи, связанные с этой записью
    const userRecordings = await storage.getUserRecordingsByAdminId(recordingId);
    
    for (const userRec of userRecordings) {
      await storage.deleteUserRecording(userRec.id);
      log(`Удалена пользовательская запись с ID ${userRec.id}`, 'admin');
    }
    
    // Удаляем саму запись
    const result = await storage.deleteRecording(recordingId);
    
    return {
      success: result,
      message: result ? `Запись с ID ${recordingId} удалена` : `Не удалось удалить запись с ID ${recordingId}`
    };
  } catch (error) {
    log(`Ошибка при удалении записи: ${error}`, 'admin');
    throw error;
  }
}

/**
 * Объединяет фрагменты записи
 * @param {number} recordingId ID записи
 * @param {Object} options Опции объединения
 * @returns {Promise<Object>} Результат объединения
 */
export async function mergeRecordingFragments(recordingId, options = {}) {
  try {
    const { sessionId = null, forceProcess = false } = options;
    
    // Получаем запись
    const recording = await storage.getRecordingById(recordingId);
    
    if (!recording) {
      throw new Error(`Запись с ID ${recordingId} не найдена`);
    }
    
    // Получаем все фрагменты для этой записи
    const fragments = await storage.getRecordingFragments(recordingId);
    
    if (!fragments || fragments.length === 0) {
      throw new Error(`Не найдено фрагментов для записи ID: ${recordingId}`);
    }
    
    // Если сессия не указана, используем сессию из первого фрагмента
    const sessionIdToUse = sessionId || fragments[0].sessionId;
    
    // Отфильтровываем только фрагменты для этой сессии
    const sessionFragments = fragments.filter(f => f.sessionId === sessionIdToUse);
    
    if (sessionFragments.length === 0) {
      throw new Error(`Не найдено фрагментов для сессии ${sessionIdToUse}`);
    }
    
    log(`Найдено ${sessionFragments.length} фрагментов для сессии ${sessionIdToUse}`, 'admin');
    
    // Объединяем фрагменты и получаем итоговый файл
    const outputFilename = await fragmentManager.mergeFragments(sessionFragments, UPLOADS_DIR);
    
    if (!outputFilename) {
      throw new Error('Не удалось объединить фрагменты');
    }
    
    log(`Фрагменты объединены в файл: ${outputFilename}`, 'admin');
    
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
    
    // Если нужно, выполняем транскрипцию
    if (forceProcess && fs.existsSync(filePath)) {
      try {
        log('Начинаем распознавание речи...', 'admin');
        const transcriptionResult = await transcribeAudio(filePath);
        
        // Если транскрипция успешна, обновляем запись
        if (transcriptionResult && transcriptionResult.text) {
          await storage.updateRecording(recordingId, {
            transcription: transcriptionResult.text,
            transcriptionCost: transcriptionResult.cost,
            tokensProcessed: transcriptionResult.tokensProcessed
          });
          
          log(`Транскрипция успешно выполнена, текст: ${transcriptionResult.text}`, 'admin');
        }
      } catch (transcriptionError) {
        log(`Ошибка при транскрипции: ${transcriptionError}`, 'admin');
        // Игнорируем ошибку транскрипции и возвращаем обновленную запись
      }
    }
    
    return {
      success: true,
      message: `Фрагменты успешно объединены в файл: ${outputFilename}`,
      recording: await getAdminRecordingById(recordingId)
    };
  } catch (error) {
    log(`Ошибка при объединении фрагментов: ${error}`, 'admin');
    throw error;
  }
}

/**
 * Выполняет сравнительную транскрипцию записи
 * @param {number} recordingId ID записи
 * @param {Object} options Опции транскрипции
 * @returns {Promise<Object>} Результат сравнительной транскрипции
 */
export async function compareRecordingTranscription(recordingId, options = {}) {
  try {
    const { language = 'ru' } = options;
    
    // Получаем запись
    const recording = await storage.getRecordingById(recordingId);
    
    if (!recording) {
      throw new Error(`Запись с ID ${recordingId} не найдена`);
    }
    
    if (!recording.filename) {
      throw new Error('У записи отсутствует аудиофайл');
    }
    
    // Проверяем существование файла
    const audioFilePath = path.join(UPLOADS_DIR, recording.filename);
    
    if (!fs.existsSync(audioFilePath)) {
      throw new Error('Аудиофайл не найден на сервере');
    }
    
    log(`Запрос сравнительной транскрипции для записи ID: ${recordingId}`, 'admin');
    
    // Выполняем сравнительную транскрипцию
    const result = await compareTranscriptionModels(audioFilePath, { language });
    
    return result;
  } catch (error) {
    log(`Ошибка сравнительной транскрипции: ${error}`, 'admin');
    throw error;
  }
}

/**
 * Получает статистику для админ-панели
 * @returns {Promise<Object>} Статистика
 */
export async function getAdminStats() {
  try {
    // Получаем все записи
    const recordings = await storage.getRecordings();
    
    // Получаем все фрагменты
    const fragments = await storage.getAllRecordingFragments();
    
    // Базовая статистика
    const stats = {
      recordings: {
        total: recordings.length,
        completed: recordings.filter(r => r.status === 'completed').length,
        started: recordings.filter(r => r.status === 'started').length,
        error: recordings.filter(r => r.status === 'error').length,
        withTranscription: recordings.filter(r => r.transcription && r.transcription.length > 0).length,
        totalDuration: recordings.reduce((sum, r) => sum + (r.duration || 0), 0)
      },
      fragments: {
        total: fragments.length,
        uniqueSessions: new Set(fragments.map(f => f.sessionId)).size
      },
      storage: {
        recordingsSize: recordings.reduce((sum, r) => sum + (r.fileSize || 0), 0),
        fragmentsSize: 0 // Заполним позже
      }
    };
    
    // Рассчитываем размер фрагментов
    for (const fragment of fragments) {
      if (fragment.filename) {
        const fragmentPath = path.join(process.cwd(), 'data', 'fragments', fragment.filename);
        if (fs.existsSync(fragmentPath)) {
          try {
            const stats = fs.statSync(fragmentPath);
            stats.storage.fragmentsSize += stats.size;
          } catch (error) {
            // Игнорируем ошибки
          }
        }
      }
    }
    
    // Рассчитываем затраты на транскрипцию
    stats.transcription = {
      totalCost: recordings.reduce((sum, r) => sum + (r.transcriptionCost || 0), 0),
      totalTokens: recordings.reduce((sum, r) => sum + (r.tokensProcessed || 0), 0)
    };
    
    return stats;
  } catch (error) {
    log(`Ошибка при получении статистики для админ-панели: ${error}`, 'admin');
    throw error;
  }
}

export default {
  getAdminRecordings,
  getAdminRecordingById,
  deleteAdminRecording,
  mergeRecordingFragments,
  compareRecordingTranscription,
  getAdminStats
};