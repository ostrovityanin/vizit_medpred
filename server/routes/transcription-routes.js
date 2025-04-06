/**
 * Маршруты для транскрипции аудио
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const router = express.Router();

// Получаем путь к текущему файлу и директории
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Динамически импортируем модуль транскрипции
let transcriptionModule = null;

async function getTranscriptionModule() {
  if (!transcriptionModule) {
    transcriptionModule = await import('../../server/transcription-api.js');
  }
  return transcriptionModule;
}

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
    const allowedTypes = [
      'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav', 
      'audio/webm', 'audio/aac', 'audio/m4a', 'audio/x-m4a'
    ];
    
    if (allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый формат файла. Поддерживаются только аудиофайлы.'));
    }
  }
});

/**
 * Эндпоинт для транскрипции аудиофайла с использованием стандартной модели
 * 
 * POST /api/transcribe
 * 
 * Параметры:
 * - file: аудиофайл (multipart/form-data)
 * - model: модель для транскрипции (опционально, по умолчанию 'whisper-1')
 */
router.post('/transcribe', upload.single('file'), async (req, res) => {
  const file = req.file;
  
  if (!file) {
    return res.status(400).json({ error: 'Отсутствует аудиофайл' });
  }
  
  let audioPath = file.path;
  
  try {
    console.log(`[API] Запрос на транскрипцию файла: ${file.originalname}`);
    
    // Получаем модель для транскрипции из запроса или используем значение по умолчанию
    const model = req.body.model || 'whisper-1';
    
    // Получаем модуль транскрипции
    const transcriptionApi = await getTranscriptionModule();
    
    // Выполняем транскрипцию
    const startTime = Date.now();
    const transcriptionResult = await transcriptionApi.transcribeAudio(audioPath, { 
      model, 
      language: req.body.language || 'ru'
    });
    const processingTime = (Date.now() - startTime) / 1000;
    
    // Формируем ответ
    const response = {
      text: transcriptionResult.text,
      model: model,
      processingTime: processingTime.toFixed(2),
      language: req.body.language || 'ru',
      originalFilename: file.originalname
    };
    
    // Если есть детали транскрипции, добавляем их
    if (transcriptionResult.segments) {
      response.segments = transcriptionResult.segments;
    }
    
    // Возвращаем результат
    return res.status(200).json(response);
  } catch (error) {
    console.error(`[API] Ошибка при транскрипции: ${error.message}`);
    return res.status(500).json({ error: 'Ошибка при транскрипции', details: error.message });
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
 * Эндпоинт для сравнительной транскрипции аудиофайла с использованием разных моделей
 * 
 * POST /api/transcribe/compare
 * 
 * Параметры:
 * - file: аудиофайл (multipart/form-data)
 * - language: язык аудио (опционально, по умолчанию 'ru')
 */
router.post('/transcribe/compare', upload.single('file'), async (req, res) => {
  const file = req.file;
  
  if (!file) {
    return res.status(400).json({ error: 'Отсутствует аудиофайл' });
  }
  
  let audioPath = file.path;
  
  try {
    console.log(`[API] Запрос на сравнительную транскрипцию файла: ${file.originalname}`);
    
    // Получаем язык из запроса
    const language = req.body.language || 'ru';
    
    // Получаем модуль транскрипции
    const transcriptionApi = await getTranscriptionModule();
    
    // Список моделей для сравнения
    const models = [
      'whisper-1',
      'gpt-4o-mini-transcribe',
      'gpt-4o-transcribe'
    ];
    
    // Выполняем транскрипцию с использованием разных моделей
    const results = {};
    
    for (const model of models) {
      try {
        const startTime = Date.now();
        const transcriptionResult = await transcriptionApi.transcribeAudio(audioPath, { 
          model, 
          language
        });
        const processingTime = (Date.now() - startTime) / 1000;
        
        results[model] = {
          text: transcriptionResult.text,
          processingTime: processingTime.toFixed(2)
        };
        
        if (transcriptionResult.segments) {
          results[model].segments = transcriptionResult.segments;
        }
      } catch (modelError) {
        console.error(`[API] Ошибка при транскрипции моделью ${model}: ${modelError.message}`);
        results[model] = {
          error: modelError.message,
          status: 'failed'
        };
      }
    }
    
    // Формируем ответ
    const response = {
      language,
      originalFilename: file.originalname,
      fileSize: file.size,
      results
    };
    
    // Возвращаем результат
    return res.status(200).json(response);
  } catch (error) {
    console.error(`[API] Ошибка при сравнительной транскрипции: ${error.message}`);
    return res.status(500).json({ error: 'Ошибка при транскрипции', details: error.message });
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

export default router;