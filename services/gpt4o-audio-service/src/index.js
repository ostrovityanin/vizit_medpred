/**
 * GPT-4o Audio Preview микросервис
 * 
 * Обеспечивает транскрипцию аудиофайлов с использованием GPT-4o Preview
 */

// Загружаем переменные окружения из .env файла
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { log } = require('./logger');
const GPT4oClient = require('./gpt4o-client');
const { ensureTempDir } = require('./audio-processor');

// Создаем экземпляр Express
const app = express();
const PORT = process.env.PORT || 3400;

// Настраиваем CORS для доступа с других сервисов
app.use(cors());
app.use(express.json());

// Настраиваем multer для загрузки файлов
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '25') * 1024 * 1024; // 25 МБ по умолчанию
const upload = multer({
  dest: ensureTempDir(),
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

// Инициализируем клиент GPT-4o
const gpt4oClient = new GPT4oClient();

// Маршрут для проверки работоспособности сервиса
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'gpt4o-audio-service',
    version: '1.0.0',
    apiKeyConfigured: !!process.env.OPENAI_API_KEY
  });
});

// Маршрут для информации о сервисе
app.get('/info', (req, res) => {
  res.json({
    name: 'GPT-4o Audio Preview Microservice',
    description: 'Сервис для транскрибирования аудиофайлов с помощью GPT-4o',
    version: '1.0.0',
    endpoints: [
      { path: '/health', method: 'GET', description: 'Проверка работоспособности сервиса' },
      { path: '/info', method: 'GET', description: 'Информация о сервисе' },
      { path: '/transcribe', method: 'POST', description: 'Транскрибирование аудиофайла (form-data с файлом)' },
      { path: '/transcribe/path', method: 'POST', description: 'Транскрибирование аудиофайла по указанному пути' }
    ],
    config: {
      maxFileSize: `${MAX_FILE_SIZE / (1024 * 1024)} МБ`,
      transcriptionModel: process.env.TRANSCRIPTION_MODEL || 'gpt-4o',
      transcriptionLanguage: process.env.TRANSCRIPTION_LANGUAGE || 'ru'
    }
  });
});

// Маршрут для транскрибирования загруженного аудиофайла
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No audio file provided',
        message: 'Аудиофайл не был загружен. Используйте form-data с полем "audio".'
      });
    }

    log.info(`Получен запрос на транскрибирование загруженного файла: ${req.file.originalname}`);
    log.debug(`Временный путь файла: ${req.file.path}, Размер: ${req.file.size} байт`);

    // Выполняем транскрипцию
    const result = await gpt4oClient.transcribeAudio(req.file.path);

    // Удаляем временный файл после обработки
    try {
      fs.unlinkSync(req.file.path);
      log.debug(`Временный файл ${req.file.path} удален`);
    } catch (unlinkError) {
      log.warn(`Ошибка при удалении временного файла: ${unlinkError.message}`);
    }

    res.json({
      success: true,
      text: result.text,
      metadata: {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        cost: result.cost,
        tokensProcessed: result.tokensProcessed
      }
    });
  } catch (error) {
    log.error(`Ошибка при транскрибировании загруженного файла: ${error.message}`);
    res.status(500).json({
      error: 'Transcription failed',
      message: error.message
    });
  }
});

// Маршрут для транскрибирования файла по указанному пути
app.post('/transcribe/path', async (req, res) => {
  try {
    const { filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({
        error: 'No file path provided',
        message: 'Путь к аудиофайлу не указан. Отправьте JSON с полем "filePath".'
      });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'File not found',
        message: `Файл не найден по указанному пути: ${filePath}`
      });
    }

    log.info(`Получен запрос на транскрибирование файла по пути: ${filePath}`);

    // Получаем информацию о файле
    const fileStats = fs.statSync(filePath);
    const filename = path.basename(filePath);

    // Выполняем транскрипцию
    const result = await gpt4oClient.transcribeAudio(filePath);

    res.json({
      success: true,
      text: result.text,
      metadata: {
        filename: filename,
        size: fileStats.size,
        path: filePath,
        cost: result.cost,
        tokensProcessed: result.tokensProcessed
      }
    });
  } catch (error) {
    log.error(`Ошибка при транскрибировании файла по пути: ${error.message}`);
    res.status(500).json({
      error: 'Transcription failed',
      message: error.message
    });
  }
});

// Запускаем сервер
app.listen(PORT, () => {
  log.info(`GPT-4o Audio Preview сервис запущен на порту ${PORT}`);
  log.info(`Документация: http://localhost:${PORT}/info`);
  log.info(`Проверка работоспособности: http://localhost:${PORT}/health`);
});

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  log.error(`Необработанное исключение: ${error.message}`, error);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error(`Необработанное отклонение обещания: ${reason}`, reason);
});