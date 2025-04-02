/**
 * Главный файл микросервиса GPT-4o Audio
 * 
 * Микросервис предоставляет REST API для транскрипции аудиофайлов 
 * с использованием OpenAI GPT-4o Audio Preview и Whisper API
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import gpt4oClient from './gpt4o-client.js';
import audioProcessor from './audio-processor.js';
import logger from './logger.js';

// Загрузка переменных окружения
dotenv.config();

// Настройка Express
const app = express();
const PORT = process.env.PORT || 3001;

// Директории для загрузки файлов
const uploadsDir = process.env.UPLOADS_DIR || './uploads';
const tempDir = path.join(uploadsDir, 'temp');

// Максимальный размер загружаемого файла
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '20971520'); // 20MB по умолчанию

// Настройка CORS
app.use(cors());
app.use(express.json());

// Настройка хранилища для загруженных файлов
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Создаем директории, если они не существуют
    await audioProcessor.ensureDirectoryExists(uploadsDir);
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя файла
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
    const filename = `${timestamp}_${file.originalname}`;
    cb(null, filename);
  }
});

// Настройка загрузчика файлов
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    // Проверяем тип файла
    const allowedMimeTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 
      'audio/x-wav', 'audio/webm', 'audio/mp4', 'audio/x-m4a'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Неподдерживаемый тип файла: ${file.mimetype}`));
    }
  }
});

// Маршрут для проверки работоспособности сервиса
app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    apiAvailable: gpt4oClient.hasOpenAIKey(),
    service: 'gpt4o-audio-service'
  };
  
  res.json(healthCheck);
});

// Маршрут для транскрипции аудио
app.post('/api/transcribe', upload.single('file'), async (req, res) => {
  try {
    const startTime = Date.now();
    
    if (!req.file) {
      logger.error('Файл не загружен');
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    logger.info(`Файл загружен: ${req.file.path} (${req.file.size} байт)`);
    
    // Получение параметров запроса
    const { 
      optimize = 'true', 
      model = 'auto',
      preferredMethod = 'auto',
      prompt = '',
      language = '',
      splitLargeFiles = 'true'
    } = req.body;
    
    // Путь к загруженному файлу
    let audioFilePath = req.file.path;
    let tempFiles = [];
    
    // Оптимизация аудиофайла (если требуется)
    if (optimize === 'true') {
      try {
        const optimizedPath = await audioProcessor.optimizeAudio(audioFilePath, {
          outputFormat: 'mp3',
          sampleRate: 16000,
          channels: 1,
          bitrate: '32k'
        });
        
        if (optimizedPath !== audioFilePath) {
          tempFiles.push(optimizedPath);
          audioFilePath = optimizedPath;
          logger.info(`Файл оптимизирован: ${audioFilePath}`);
        }
      } catch (error) {
        logger.warn(`Ошибка при оптимизации аудио: ${error.message}. Используем оригинальный файл.`);
      }
    }
    
    // Получение информации о файле для расчета стоимости
    let fileInfo;
    try {
      fileInfo = await audioProcessor.getMediaInfo(audioFilePath);
    } catch (error) {
      logger.error(`Ошибка при получении информации о файле: ${error.message}`);
    }
    
    // Расчет примерной стоимости (если доступна информация о длительности)
    let estimatedCost = 'Неизвестно';
    if (fileInfo && fileInfo.duration) {
      estimatedCost = gpt4oClient.calculateTranscriptionCost(fileInfo.duration);
    }
    
    // Разбиение больших файлов на сегменты (опционально)
    let segments = [];
    let transcriptions = [];
    
    if (splitLargeFiles === 'true' && fileInfo && fileInfo.duration > 60) {
      try {
        logger.info('Разбиение файла на сегменты...');
        segments = await audioProcessor.splitAudioFile(audioFilePath, {
          segmentDurationSeconds: 60,
          outputFormat: 'mp3'
        });
        
        tempFiles.push(...segments.filter(s => s !== audioFilePath));
        
        // Транскрипция каждого сегмента
        for (let i = 0; i < segments.length; i++) {
          logger.info(`Транскрипция сегмента ${i+1}/${segments.length}`);
          const segmentResult = await gpt4oClient.transcribeAudio(segments[i], {
            model,
            preferredMethod,
            prompt: i === 0 ? prompt : '', // Промпт только для первого сегмента
            language
          });
          
          if (segmentResult) {
            transcriptions.push(segmentResult.text || '');
          }
        }
        
        // Объединение результатов транскрипции
        const transcriptionText = transcriptions.join(' ');
        
        const response = {
          status: 'success',
          transcription: transcriptionText,
          duration: fileInfo ? fileInfo.duration : null,
          segments: segments.length,
          estimatedCost,
          model: model === 'auto' ? 'gpt-4o-audio-preview' : model,
          processingTime: `${(Date.now() - startTime) / 1000} сек`
        };
        
        res.json(response);
      } catch (error) {
        logger.error(`Ошибка при обработке сегментов: ${error.message}`);
        // В случае ошибки, пробуем обработать файл целиком
        segments = [];
      }
    }
    
    // Если сегментация не требуется или произошла ошибка - обрабатываем файл целиком
    if (segments.length === 0) {
      // Транскрипция аудио
      const result = await gpt4oClient.transcribeAudio(audioFilePath, {
        model,
        preferredMethod,
        prompt,
        language
      });
      
      if (!result) {
        throw new Error('Не удалось выполнить транскрипцию');
      }
      
      const response = {
        status: 'success',
        transcription: result.text,
        duration: fileInfo ? fileInfo.duration : null,
        estimatedCost,
        model: result.model || (model === 'auto' ? 'gpt-4o-audio-preview' : model),
        processingTime: `${(Date.now() - startTime) / 1000} сек`
      };
      
      res.json(response);
    }
    
    // Очистка временных файлов
    if (tempFiles.length > 0) {
      await audioProcessor.cleanupTempFiles(tempFiles);
    }
  } catch (error) {
    logger.error(`Ошибка при обработке запроса: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`GPT-4o Audio Service запущен на порту ${PORT}`);
});

// Обработка сигналов завершения
process.on('SIGINT', async () => {
  logger.info('Сервис останавливается...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Сервис останавливается...');
  process.exit(0);
});

export default app;