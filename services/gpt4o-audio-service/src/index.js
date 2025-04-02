/**
 * Микросервис GPT-4o Audio для транскрипции аудиозаписей
 */

import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { 
  logInfo, 
  logError, 
  logWarning, 
  logRequest, 
  logResponse 
} from './logger.js';
import { 
  transcribeWithGPT4o, 
  isOpenAIConfigured,
  cleanText,
  parseDialogueFromText,
  calculateGPT4oTranscriptionCost
} from './gpt4o-client.js';
import {
  optimizeAudioForTranscription,
  convertWebmToWav,
  getAudioDuration,
  splitAudioFile,
  cleanupTempFiles,
  ensureDirectoryExists
} from './audio-processor.js';

// Получаем текущую директорию (для ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Директории для хранения файлов
const uploadsDir = path.join(__dirname, '../uploads');
const tempDir = path.join(__dirname, '../temp');

// Создаем директории, если они не существуют
ensureDirectoryExists(uploadsDir);
ensureDirectoryExists(tempDir);

// Конфигурация сервиса
const config = {
  port: process.env.PORT || 3100,
  maxFileSize: process.env.MAX_FILE_SIZE || 100 * 1024 * 1024, // 100MB по умолчанию
  apiToken: process.env.API_TOKEN,
  version: '1.0.0',
  serviceName: 'GPT-4o Audio Service'
};

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSize
  }
});

// Middleware для проверки API-токена
const authenticateToken = (req, res, next) => {
  if (!config.apiToken) {
    return next(); // Если токен не настроен, пропускаем проверку
  }
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Отсутствует токен авторизации' });
  }
  
  if (token !== config.apiToken) {
    return res.status(403).json({ error: 'Недействительный токен авторизации' });
  }
  
  next();
};

// Создаем сервер Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Обработчик ошибок
app.use((err, req, res, next) => {
  logError(err, req, 'Ошибка сервера');
  res.status(500).json({
    error: 'Ошибка сервера',
    message: err.message
  });
});

// Маршруты
app.get('/health', (req, res) => {
  const openaiConfigured = isOpenAIConfigured();
  res.json({
    status: 'ok',
    version: config.version,
    serviceName: config.serviceName,
    openaiConfigured
  });
});

app.get('/api/info', authenticateToken, (req, res) => {
  const openaiConfigured = isOpenAIConfigured();
  res.json({
    version: config.version,
    serviceName: config.serviceName,
    openaiConfigured,
    maxFileSize: config.maxFileSize,
    uploadsDir,
    tempDir
  });
});

// API для транскрипции
app.post('/api/transcribe', authenticateToken, upload.single('audioFile'), async (req, res) => {
  try {
    logRequest(req, 'Получен запрос на транскрипцию');
    
    if (!req.file) {
      return res.status(400).json({ error: 'Аудиофайл не загружен' });
    }
    
    const filepath = req.file.path;
    let processedFilePath = filepath;
    
    // Проверяем, нужно ли оптимизировать аудио
    const optimize = req.body.optimize !== 'false';
    
    if (optimize) {
      try {
        processedFilePath = await optimizeAudioForTranscription(filepath);
      } catch (optimizeError) {
        logWarning(`Ошибка оптимизации, продолжаем с оригинальным файлом: ${optimizeError.message}`);
      }
    }
    
    // Получаем длительность аудио для расчета примерной стоимости
    let duration = 0;
    try {
      duration = await getAudioDuration(processedFilePath);
      logInfo(`Длительность аудио: ${duration} секунд`);
    } catch (durationError) {
      logWarning(`Не удалось определить длительность: ${durationError.message}`);
    }
    
    // Выполняем транскрипцию
    const transcriptionResult = await transcribeWithGPT4o(processedFilePath);
    
    // Очищаем временные файлы
    if (optimize && processedFilePath !== filepath) {
      try {
        fs.unlinkSync(processedFilePath);
      } catch (e) {
        logWarning(`Не удалось удалить временный файл: ${e.message}`);
      }
    }
    
    // Форматируем текст, если нужно
    const rawText = transcriptionResult.text;
    const formattedText = req.body.format === 'dialogue' 
      ? parseDialogueFromText(rawText)
      : cleanText(rawText);
    
    const response = {
      transcription: {
        raw: rawText,
        formatted: formattedText
      },
      metadata: {
        filename: req.file.originalname,
        filesize: req.file.size,
        mimetype: req.file.mimetype,
        duration,
        cost: transcriptionResult.cost,
        tokensProcessed: transcriptionResult.tokensProcessed,
        optimized: optimize && processedFilePath !== filepath
      }
    };
    
    logResponse(req, res, 'Транскрипция успешно выполнена');
    res.json(response);
  } catch (error) {
    logError(error, req, 'Ошибка при выполнении транскрипции');
    
    // Очищаем загруженный файл в случае ошибки
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        logWarning(`Не удалось удалить загруженный файл: ${e.message}`);
      }
    }
    
    res.status(500).json({
      error: 'Ошибка транскрипции',
      message: error.message
    });
  }
});

// API для оптимизации аудио
app.post('/api/optimize', authenticateToken, upload.single('audioFile'), async (req, res) => {
  try {
    logRequest(req, 'Получен запрос на оптимизацию аудио');
    
    if (!req.file) {
      return res.status(400).json({ error: 'Аудиофайл не загружен' });
    }
    
    const filepath = req.file.path;
    const outputPath = req.body.outputPath || path.join(
      tempDir, 
      `optimized_${Date.now()}${path.extname(filepath) || '.mp3'}`
    );
    
    // Оптимизируем аудио
    const optimizedPath = await optimizeAudioForTranscription(filepath, outputPath);
    
    // Получаем информацию о файлах
    const originalStats = fs.statSync(filepath);
    const optimizedStats = fs.statSync(optimizedPath);
    const compressionRatio = (originalStats.size / optimizedStats.size).toFixed(2);
    
    const response = {
      originalPath: filepath,
      outputPath: optimizedPath,
      originalSize: originalStats.size,
      optimizedSize: optimizedStats.size,
      compressionRatio,
      metadata: {
        filename: req.file.originalname,
        mimetype: req.file.mimetype
      }
    };
    
    logResponse(req, res, 'Аудио успешно оптимизировано');
    res.json(response);
  } catch (error) {
    logError(error, req, 'Ошибка при оптимизации аудио');
    
    // Очищаем загруженный файл в случае ошибки
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        logWarning(`Не удалось удалить загруженный файл: ${e.message}`);
      }
    }
    
    res.status(500).json({
      error: 'Ошибка оптимизации',
      message: error.message
    });
  }
});

// API для расчета стоимости транскрипции
app.post('/api/calculate-cost', authenticateToken, async (req, res) => {
  try {
    const { durationSeconds } = req.body;
    
    if (!durationSeconds || isNaN(durationSeconds)) {
      return res.status(400).json({ error: 'Необходимо указать длительность в секундах' });
    }
    
    const cost = calculateGPT4oTranscriptionCost(durationSeconds);
    
    res.json({ cost });
  } catch (error) {
    logError(error, req, 'Ошибка при расчете стоимости');
    res.status(500).json({
      error: 'Ошибка расчета стоимости',
      message: error.message
    });
  }
});

// Запуск сервера
app.listen(config.port, '0.0.0.0', () => {
  logInfo(`${config.serviceName} запущен на порту ${config.port}`);
  logInfo(`Версия: ${config.version}`);
  
  if (!isOpenAIConfigured()) {
    logWarning('OpenAI API ключ не настроен! Функции транскрипции недоступны.');
  }
});

// Обработка сигналов завершения
process.on('SIGINT', () => {
  logInfo('Получен сигнал SIGINT. Завершение работы...');
  cleanupTempFiles();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logInfo('Получен сигнал SIGTERM. Завершение работы...');
  cleanupTempFiles();
  process.exit(0);
});

export default app;