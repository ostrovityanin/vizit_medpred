/**
 * Маршруты API для модуля сравнительной диаризации и мульти-модельной транскрипции
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Импортируем модуль диаризации с мульти-модельной транскрипцией
import diarizationComparison from '../modules/diarization-comparison/index.js';
const { performDiarizationAndMultiTranscription } = diarizationComparison;

const router = express.Router();

// Настройка временной директории для загрузки файлов
const TEMP_DIR = path.join(process.cwd(), 'temp');
const UPLOADS_DIR = path.join(TEMP_DIR, 'uploads');

// Создаем директории, если они не существуют
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Настройка multer для загрузки аудиофайлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB
  },
  fileFilter: (req, file, cb) => {
    // Проверка на аудио форматы
    const allowedTypes = [
      'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav', 
      'audio/webm', 'audio/aac', 'audio/m4a', 'audio/x-m4a'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый формат файла. Поддерживаются только аудиофайлы.'));
    }
  }
});

/**
 * Эндпоинт для загрузки аудиофайла и выполнения сравнительной диаризации и транскрипции
 * 
 * POST /api/diarize/compare
 * 
 * Параметры:
 * - file: аудиофайл (multipart/form-data)
 * - minSpeakers: минимальное количество говорящих (опционально)
 * - maxSpeakers: максимальное количество говорящих (опционально)
 */
router.post('/diarize/compare', upload.single('file'), async (req, res) => {
  const file = req.file;
  
  if (!file) {
    return res.status(400).json({ error: 'Отсутствует аудиофайл' });
  }
  
  let audioPath = file.path;
  
  try {
    console.log(`[API] Запрос на сравнительную диаризацию и транскрипцию файла: ${file.originalname}`);
    
    // Получаем дополнительные параметры из запроса
    const minSpeakers = parseInt(req.body.minSpeakers) || 1;
    const maxSpeakers = parseInt(req.body.maxSpeakers) || 10;
    
    // Выполняем диаризацию и транскрипцию
    const results = await performDiarizationAndMultiTranscription(audioPath, {
      minSpeakers,
      maxSpeakers
    });
    
    // Добавляем информацию о загруженном файле
    results.metadata.original_filename = file.originalname;
    results.metadata.file_size = file.size;
    
    // Возвращаем результаты
    return res.status(200).json(results);
  } catch (error) {
    console.error(`[API] Ошибка при обработке запроса: ${error.message}`);
    return res.status(500).json({ error: 'Ошибка при обработке запроса', details: error.message });
  } finally {
    // Удаляем загруженный файл
    try {
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
        console.log(`[API] Удален временный файл: ${audioPath}`);
      }
    } catch (err) {
      console.error(`[API] Ошибка при удалении файла ${audioPath}: ${err.message}`);
    }
  }
});

/**
 * Эндпоинт для выполнения сравнительной диаризации и транскрипции по ID записи
 * 
 * POST /api/diarize/compare/recording/:id
 * 
 * Параметры URL:
 * - id: ID записи в базе данных
 * 
 * Параметры запроса:
 * - minSpeakers: минимальное количество говорящих (опционально)
 * - maxSpeakers: максимальное количество говорящих (опционально)
 */
router.post('/diarize/compare/recording/:id', async (req, res) => {
  const recordingId = parseInt(req.params.id);
  
  if (isNaN(recordingId)) {
    return res.status(400).json({ error: 'Недопустимый ID записи' });
  }
  
  try {
    console.log(`[API] Запрос на сравнительную диаризацию и транскрипцию записи #${recordingId}`);
    
    // Получаем информацию о записи из хранилища
    const recordingsStorage = req.app.locals.storage?.getRecordings?.();
    
    if (!recordingsStorage) {
      return res.status(500).json({ error: 'Хранилище записей недоступно' });
    }
    
    const recording = recordingsStorage.find(r => r.id === recordingId);
    
    if (!recording) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    
    // Проверяем наличие аудиофайла
    const audioFilePath = path.join(process.cwd(), 'data', 'recordings', recording.filename);
    
    if (!fs.existsSync(audioFilePath)) {
      return res.status(404).json({ error: 'Аудиофайл записи не найден' });
    }
    
    // Получаем дополнительные параметры из запроса
    const minSpeakers = parseInt(req.body.minSpeakers) || 1;
    const maxSpeakers = parseInt(req.body.maxSpeakers) || 10;
    
    // Выполняем диаризацию и транскрипцию
    const results = await performDiarizationAndMultiTranscription(audioFilePath, {
      minSpeakers,
      maxSpeakers
    });
    
    // Добавляем информацию о записи
    results.metadata.recording_id = recordingId;
    results.metadata.recording_info = {
      filename: recording.filename,
      duration: recording.duration,
      timestamp: recording.timestamp,
      senderUsername: recording.senderUsername,
      targetUsername: recording.targetUsername
    };
    
    // Возвращаем результаты
    return res.status(200).json(results);
  } catch (error) {
    console.error(`[API] Ошибка при обработке запроса: ${error.message}`);
    return res.status(500).json({ error: 'Ошибка при обработке запроса', details: error.message });
  }
});

export default router;