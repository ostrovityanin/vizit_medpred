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

import { setupLogger } from './logger.js';
import { AudioProcessor } from './audio-processor.js';
import { GPT4oClient } from './gpt4o-client.js';

// Инициализация переменных окружения
dotenv.config();

// ES модули не имеют доступа к __dirname, создаем аналог
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Настройка логирования
const logger = setupLogger();

// Инициализация классов для обработки аудио и транскрипции
const audioProcessor = new AudioProcessor(logger);
const gpt4oClient = new GPT4oClient(logger);

// Настройка сервера Express
const app = express();
const PORT = process.env.PORT || 3500;

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
    
    // Транскрибируем через Whisper API
    const result = await gpt4oClient.transcribeWithWhisper(audioFile, options);
    
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
    
    // Проверяем доступность GPT-4o
    const availableModels = await gpt4oClient.getAvailableModels();
    let result;
    
    if (availableModels.gpt4oAvailable) {
      logger.info(`Модель GPT-4o найдена: ${availableModels.gpt4oModel}, попытка транскрипции...`);
      // Транскрибируем через GPT-4o
      result = await gpt4oClient.transcribeWithGPT4o(audioFile, availableModels.gpt4oModel, options);
    } else {
      logger.warn('Модель GPT-4o не доступна, используем Whisper API в качестве запасного варианта');
      // Используем Whisper как запасной вариант
      result = await gpt4oClient.transcribeWithWhisper(audioFile, options);
    }
    
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
    
    // Проверяем, требуется ли расширенные возможности GPT-4o
    let result;
    if (options.detailed) {
      // Проверяем доступность GPT-4o
      const availableModels = await gpt4oClient.getAvailableModels();
      
      if (availableModels.gpt4oAvailable) {
        logger.info(`Запрошены расширенные возможности и GPT-4o доступен (${availableModels.gpt4oModel}), используем его`);
        result = await gpt4oClient.transcribeWithGPT4o(audioFile, availableModels.gpt4oModel, options);
      } else {
        logger.warn('Запрошены расширенные возможности, но GPT-4o недоступен, используем Whisper');
        result = await gpt4oClient.transcribeWithWhisper(audioFile, options);
      }
    } else {
      // Для обычной транскрипции используем Whisper как более надежный вариант
      logger.info('Используем Whisper API для стандартной транскрипции');
      result = await gpt4oClient.transcribeWithWhisper(audioFile, options);
    }
    
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