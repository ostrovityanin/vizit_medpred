/**
 * Модуль управления аудиоплеером
 * 
 * Отвечает за воспроизведение аудиозаписей, обработку фрагментов
 * и предоставление данных для UI.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { storage } from '../../storage';
import { log } from '../../vite';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOADS_DIR = path.join(dirname(dirname(dirname(__dirname))), 'uploads');

/**
 * Получает метаданные аудиозаписи
 * @param {string} filePath Путь к файлу аудиозаписи
 * @returns {Promise<Object>} Метаданные аудиозаписи
 */
export async function getAudioMetadata(filePath) {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(filePath)) {
        return reject(new Error(`Файл не существует: ${filePath}`));
      }
      
      // Получаем размер файла
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      
      // Определяем MIME-тип на основе расширения файла
      const ext = path.extname(filePath).toLowerCase();
      let mimeType = 'audio/mpeg'; // По умолчанию MP3
      
      if (ext === '.wav') {
        mimeType = 'audio/wav';
      } else if (ext === '.ogg') {
        mimeType = 'audio/ogg';
      } else if (ext === '.m4a') {
        mimeType = 'audio/mp4';
      } else if (ext === '.flac') {
        mimeType = 'audio/flac';
      }
      
      resolve({
        path: filePath,
        size: fileSize,
        mimeType
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Создает HTTP-заголовки для потоковой передачи аудио
 * @param {Object} metadata Метаданные аудиозаписи
 * @param {Object} range Диапазон байтов для передачи
 * @returns {Object} HTTP-заголовки
 */
export function createAudioStreamHeaders(metadata, range = null) {
  const headers = {
    'Content-Type': metadata.mimeType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };
  
  if (range) {
    const { start, end, contentLength } = range;
    headers['Content-Range'] = `bytes ${start}-${end}/${metadata.size}`;
    headers['Content-Length'] = contentLength;
    headers['Content-Disposition'] = 'inline';
    return { headers, statusCode: 206 }; // Partial Content
  } else {
    headers['Content-Length'] = metadata.size;
    headers['Content-Disposition'] = 'inline';
    return { headers, statusCode: 200 }; // OK
  }
}

/**
 * Обрабатывает запрос на потоковую передачу аудио
 * @param {Object} req HTTP-запрос
 * @param {string} filePath Путь к файлу аудиозаписи
 * @returns {Promise<Object>} Метаданные для создания потока
 */
export async function handleAudioStream(req, filePath) {
  try {
    const metadata = await getAudioMetadata(filePath);
    
    // Обработка запроса диапазона (Range)
    const rangeHeader = req.headers.range;
    
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : metadata.size - 1;
      const contentLength = end - start + 1;
      
      return {
        filePath,
        metadata,
        range: { start, end, contentLength },
        ...createAudioStreamHeaders(metadata, { start, end, contentLength })
      };
    } else {
      return {
        filePath,
        metadata,
        range: null,
        ...createAudioStreamHeaders(metadata)
      };
    }
  } catch (error) {
    log(`Ошибка при обработке запроса на потоковую передачу аудио: ${error}`, 'audio-player');
    throw error;
  }
}

/**
 * Получает все фрагменты записи для плеера
 * @param {number} recordingId ID записи
 * @returns {Promise<Array>} Массив фрагментов для плеера
 */
export async function getPlayerFragments(recordingId) {
  try {
    const fragments = await storage.getRecordingFragments(recordingId);
    
    if (!fragments || fragments.length === 0) {
      return [];
    }
    
    // Сортируем фрагменты по индексу
    fragments.sort((a, b) => a.fragmentIndex - b.fragmentIndex);
    
    // Формируем информацию для плеера
    return fragments.map(fragment => {
      // Проверяем наличие файла
      const fragmentPath = path.join(UPLOADS_DIR, fragment.filename);
      const exists = fs.existsSync(fragmentPath);
      
      return {
        id: fragment.id,
        recordingId: fragment.recordingId,
        sessionId: fragment.sessionId,
        index: fragment.fragmentIndex,
        duration: fragment.duration || 0,
        filename: fragment.filename,
        path: exists ? `/api/recordings/${recordingId}/fragments/${fragment.id}/audio` : null,
        exists
      };
    });
  } catch (error) {
    log(`Ошибка при получении фрагментов для плеера: ${error}`, 'audio-player');
    throw error;
  }
}

/**
 * Получает путь к файлу фрагмента
 * @param {number} fragmentId ID фрагмента
 * @returns {Promise<string>} Путь к файлу фрагмента
 */
export async function getFragmentFilePath(fragmentId) {
  try {
    const fragment = await storage.getRecordingFragmentById(fragmentId);
    
    if (!fragment || !fragment.filename) {
      throw new Error(`Фрагмент с ID ${fragmentId} не найден или не имеет файла`);
    }
    
    const filePath = path.join(UPLOADS_DIR, fragment.filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Файл фрагмента не существует: ${filePath}`);
    }
    
    return filePath;
  } catch (error) {
    log(`Ошибка при получении пути к файлу фрагмента: ${error}`, 'audio-player');
    throw error;
  }
}

export default {
  getAudioMetadata,
  createAudioStreamHeaders,
  handleAudioStream,
  getPlayerFragments,
  getFragmentFilePath
};