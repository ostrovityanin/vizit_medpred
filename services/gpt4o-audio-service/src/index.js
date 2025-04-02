/**
 * GPT-4o Audio Service Microservice
 * 
 * Микросервис для транскрипции аудиофайлов с использованием OpenAI API.
 * Поддерживает два метода транскрипции:
 * 1. Whisper API через /v1/audio/transcriptions - надежный метод, всегда доступен
 * 2. GPT-4o через /v1/chat/completions - более расширенные возможности, но требует специального доступа
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import winston from 'winston';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

import logger from './logger.js';
import audioProcessor from './audio-processor.js';
import gpt4oClient from './gpt4o-client.js';

// Инициализация переменных окружения
dotenv.config();

// ES модули не имеют доступа к __dirname, создаем аналог
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Логирование и обработчики аудио и GPT-4o уже импортированы из соответствующих файлов

// Настройка сервера Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB максимальный размер файла
  }
});

// Маршруты API
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'GPT-4o Audio Service работает',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Транскрипция файла через Whisper API
app.post('/api/transcribe/whisper', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Аудиофайл не загружен' });
    }
    
    logger.info(`Получен запрос на транскрипцию через Whisper API: ${req.file.originalname}, размер: ${req.file.size} байт`);
    
    // Оптимизируем аудиофайл если нужно
    let audioFile = req.file.path;
    if (req.body.optimize === 'true') {
      logger.info('Запрошена оптимизация аудиофайла');
      try {
        const optimizedFile = await audioProcessor.optimizeAudio(req.file.path);
        if (optimizedFile) {
          audioFile = optimizedFile;
          logger.info(`Аудио оптимизировано: ${optimizedFile}`);
        }
      } catch (optimizeError) {
        logger.error(`Ошибка оптимизации аудио: ${optimizeError.message}`);
        // Продолжаем с оригинальным файлом
      }
    }
    
    // Параметры транскрипции
    const options = {
      language: req.body.language || 'ru',
      prompt: req.body.prompt || ''
    };
    
    const startTime = Date.now();
    
    // Транскрибируем через API
    const result = await gpt4oClient.transcribeAudio(audioFile, { ...options, model: 'whisper-1' });
    
    const elapsedTime = (Date.now() - startTime) / 1000;
    
    // Удаляем оптимизированный файл если он был создан
    if (audioFile !== req.file.path && fs.existsSync(audioFile)) {
      fs.unlinkSync(audioFile);
    }
    
    // Удаляем исходный файл
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    if (result.error) {
      logger.error(`Ошибка транскрипции: ${result.error}`);
      return res.status(500).json({ error: result.error });
    }
    
    logger.info(`Транскрипция успешно выполнена за ${elapsedTime.toFixed(2)} секунд`);
    
    res.json({
      text: result.text,
      processingTime: elapsedTime,
      fileSize: req.file.size,
      fileName: req.file.originalname
    });
    
  } catch (error) {
    logger.error(`Ошибка обработки запроса: ${error.message}`);
    res.status(500).json({ error: 'Ошибка сервера при обработке запроса' });
  }
});

// Транскрипция файла через GPT-4o
app.post('/api/transcribe/gpt4o', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Аудиофайл не загружен' });
    }
    
    logger.info(`Получен запрос на транскрипцию через GPT-4o: ${req.file.originalname}, размер: ${req.file.size} байт`);
    
    // Оптимизируем аудиофайл если нужно
    let audioFile = req.file.path;
    if (req.body.optimize !== 'false') { // По умолчанию для GPT-4o оптимизируем всегда
      logger.info('Выполняется оптимизация аудиофайла для GPT-4o...');
      try {
        const optimizedFile = await audioProcessor.optimizeAudioForGPT4o(req.file.path);
        if (optimizedFile) {
          audioFile = optimizedFile;
          logger.info(`Аудио оптимизировано для GPT-4o: ${optimizedFile}`);
        }
      } catch (optimizeError) {
        logger.error(`Ошибка оптимизации аудио: ${optimizeError.message}`);
        // Продолжаем с оригинальным файлом
      }
    }
    
    // Параметры транскрипции
    const options = {
      prompt: req.body.prompt || 'Пожалуйста, точно транскрибируй содержание данного аудиофайла. Выдай только текст содержания без дополнительных комментариев.',
      language: req.body.language || 'ru',
      detailed: req.body.detailed === 'true'
    };
    
    const startTime = Date.now();
    
    // Подготовка параметров для транскрипции
    let modelToUse = 'whisper-1';
    let result;
    
    logger.info(`Используем выбранную модель ${options.model || 'whisper-1'} для транскрипции`);
    
    // Транскрибируем через TranscribeAudio API
    result = await gpt4oClient.transcribeAudio(audioFile, options);
    
    const elapsedTime = (Date.now() - startTime) / 1000;
    
    // Удаляем оптимизированный файл если он был создан
    if (audioFile !== req.file.path && fs.existsSync(audioFile)) {
      fs.unlinkSync(audioFile);
    }
    
    // Удаляем исходный файл
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    if (result.error) {
      logger.error(`Ошибка транскрипции: ${result.error}`);
      return res.status(500).json({ error: result.error });
    }
    
    logger.info(`Транскрипция успешно выполнена за ${elapsedTime.toFixed(2)} секунд`);
    
    res.json({
      text: result.text,
      processingTime: elapsedTime,
      fileSize: req.file.size,
      fileName: req.file.originalname,
      model: result.model || 'whisper-1',
      usage: result.usage
    });
    
  } catch (error) {
    logger.error(`Ошибка обработки запроса: ${error.message}`);
    res.status(500).json({ error: 'Ошибка сервера при обработке запроса' });
  }
});

// Комбинированный маршрут для автоматического выбора лучшего метода
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Аудиофайл не загружен' });
    }
    
    logger.info(`Получен запрос на транскрипцию: ${req.file.originalname}, размер: ${req.file.size} байт`);
    
    // Оптимизируем аудиофайл если нужно
    let audioFile = req.file.path;
    if (req.body.optimize === 'true') {
      logger.info('Запрошена оптимизация аудиофайла');
      try {
        const optimizedFile = await audioProcessor.optimizeAudio(req.file.path);
        if (optimizedFile) {
          audioFile = optimizedFile;
          logger.info(`Аудио оптимизировано: ${optimizedFile}`);
        }
      } catch (optimizeError) {
        logger.error(`Ошибка оптимизации аудио: ${optimizeError.message}`);
        // Продолжаем с оригинальным файлом
      }
    }
    
    // Параметры транскрипции
    const options = {
      language: req.body.language || 'ru',
      prompt: req.body.prompt || '',
      detailed: req.body.detailed === 'true'
    };
    
    const startTime = Date.now();
    
    // Выбираем модель на основе запрошенных возможностей
    let result;
    let modelToUse = 'whisper-1'; // Модель по умолчанию
    
    if (options.detailed) {
      // Для расширенной транскрипции используем одну из моделей GPT-4o
      logger.info('Запрошены расширенные возможности, используем GPT-4o-transcribe');
      modelToUse = 'gpt-4o-transcribe';
    } else {
      // Для обычной транскрипции используем Whisper как более надежный вариант
      logger.info('Используем Whisper API для стандартной транскрипции');
    }
    
    // Объединяем опции с выбранной моделью
    const transcriptionOptions = { ...options, model: modelToUse };
    
    // Выполняем транскрипцию
    logger.info(`Транскрибируем с моделью ${modelToUse}`);
    result = await gpt4oClient.transcribeAudio(audioFile, transcriptionOptions);
    
    const elapsedTime = (Date.now() - startTime) / 1000;
    
    // Удаляем оптимизированный файл если он был создан
    if (audioFile !== req.file.path && fs.existsSync(audioFile)) {
      fs.unlinkSync(audioFile);
    }
    
    // Удаляем исходный файл
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    if (result.error) {
      logger.error(`Ошибка транскрипции: ${result.error}`);
      return res.status(500).json({ error: result.error });
    }
    
    logger.info(`Транскрипция успешно выполнена за ${elapsedTime.toFixed(2)} секунд`);
    
    res.json({
      text: result.text,
      processingTime: elapsedTime,
      fileSize: req.file.size,
      fileName: req.file.originalname,
      model: result.model || 'whisper-1',
      usage: result.usage
    });
    
  } catch (error) {
    logger.error(`Ошибка обработки запроса: ${error.message}`);
    res.status(500).json({ error: 'Ошибка сервера при обработке запроса' });
  }
});

// Маршрут для сравнения транскрипции с использованием всех доступных моделей
app.post('/api/transcribe/compare', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Аудиофайл не загружен' });
    }
    
    logger.info(`Получен запрос на сравнительную транскрипцию: ${req.file.originalname}, размер: ${req.file.size} байт`);
    
    // Список моделей для сравнения
    const models = [
      'whisper-1',
      'gpt-4o-transcribe',
      'gpt-4o-mini-transcribe'
    ];
    
    // Оптимизируем аудиофайл для MP3 формата (лучшая совместимость с новыми моделями)
    let audioFile = req.file.path;
    try {
      logger.info('Конвертация аудиофайла в MP3 для совместимости с новыми моделями');
      const convertedFile = await audioProcessor.convertToMp3(req.file.path);
      if (convertedFile) {
        audioFile = convertedFile;
        logger.info(`Аудио конвертировано в MP3: ${convertedFile}`);
      }
    } catch (convertError) {
      logger.error(`Ошибка конвертации аудио в MP3: ${convertError.message}`);
      // Продолжаем с оригинальным файлом
    }
    
    // Параметры транскрипции
    const options = {
      language: req.body.language || 'ru',
      prompt: req.body.prompt || ''
    };
    
    // Результаты для каждой модели
    const results = {};
    const startTimeTotal = Date.now();
    
    // Запускаем транскрипцию для каждой модели параллельно
    const transcriptionPromises = models.map(async (model) => {
      try {
        logger.info(`Запуск транскрипции с моделью ${model}`);
        const startTime = Date.now();
        
        // Создаем опции с текущей моделью
        const modelOptions = { ...options, model };
        
        // Транскрибируем через audio API
        const result = await gpt4oClient.transcribeAudio(audioFile, modelOptions);
        
        const elapsedTime = (Date.now() - startTime) / 1000;
        
        if (result && result.text) {
          results[model] = {
            text: result.text,
            processingTime: elapsedTime,
            model
          };
          
          logger.info(`Транскрипция с моделью ${model} выполнена за ${elapsedTime.toFixed(2)} секунд`);
        } else {
          const errorMsg = result?.error || 'Неизвестная ошибка';
          results[model] = {
            error: errorMsg,
            model
          };
          logger.error(`Ошибка транскрипции с моделью ${model}: ${errorMsg}`);
        }
      } catch (error) {
        logger.error(`Исключение при обработке модели ${model}: ${error.message}`);
        results[model] = {
          error: error.message,
          model
        };
      }
    });
    
    // Ждем завершения всех транскрипций
    await Promise.all(transcriptionPromises);
    
    const totalElapsedTime = (Date.now() - startTimeTotal) / 1000;
    
    // Удаляем конвертированный файл если он был создан
    if (audioFile !== req.file.path && fs.existsSync(audioFile)) {
      fs.unlinkSync(audioFile);
    }
    
    // Удаляем исходный файл
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    logger.info(`Сравнительная транскрипция выполнена за ${totalElapsedTime.toFixed(2)} секунд`);
    
    res.json({
      results,
      totalProcessingTime: totalElapsedTime,
      fileSize: req.file.size,
      fileName: req.file.originalname
    });
    
  } catch (error) {
    logger.error(`Ошибка обработки запроса сравнения: ${error.message}`);
    res.status(500).json({ error: 'Ошибка сервера при сравнительной транскрипции' });
  }
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`GPT-4o Audio Service запущен на порту ${PORT}`);
});

// Обработка необработанных исключений и отказов обещаний
process.on('uncaughtException', (err) => {
  logger.error(`Необработанное исключение: ${err.message}`, { stack: err.stack });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Необработанный отказ promise: ${reason}`);
});

// Экспорт для тестирования
export default app;