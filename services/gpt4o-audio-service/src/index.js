const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const logger = require('./logger');
const gpt4oClient = require('./gpt4o-client');

// Инициализация Express приложения
const app = express();

// Настройка middleware
app.use(cors());
app.use(express.json());

// Настройка хранилища для загружаемых файлов
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, `${uniquePrefix}${extension}`);
    }
  }),
  limits: {
    fileSize: config.gpt4o.maxAudioSizeBytes
  }
});

// Проверка статуса сервиса
app.get('/health', (req, res) => {
  const status = {
    service: 'gpt4o-audio-service',
    status: 'ok',
    timestamp: new Date().toISOString(),
    openaiConfigured: gpt4oClient.isOpenAIConfigured()
  };
  
  res.json(status);
});

// Метод для транскрипции аудио
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  // Проверяем загрузку файла
  if (!req.file) {
    logger.error('Аудиофайл не был загружен');
    return res.status(400).json({ error: 'Аудиофайл не был загружен' });
  }
  
  // Получаем промпт из запроса или используем дефолтный
  const prompt = req.body.prompt || config.gpt4o.defaultPrompt;
  
  // Логируем информацию о файле
  logger.info(`Получен аудиофайл: ${req.file.originalname}, размер: ${req.file.size} байт`);
  
  try {
    // Транскрибируем аудио
    const result = await gpt4oClient.transcribeWithGPT4o(req.file.path, prompt);
    
    // Удаляем временный файл после обработки
    fs.unlinkSync(req.file.path);
    
    // Возвращаем результат
    res.json({
      success: true,
      transcription: result.text,
      tokens: result.tokens,
      cost: result.cost
    });
  } catch (error) {
    logger.error(`Ошибка при транскрипции: ${error.message}`);
    
    // Удаляем временный файл в случае ошибки
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Получение доступных моделей
app.get('/models', async (req, res) => {
  try {
    const models = await gpt4oClient.getAvailableModels();
    res.json({ models });
  } catch (error) {
    logger.error(`Ошибка при получении моделей: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Обработка ошибок
app.use((err, req, res, next) => {
  logger.error(`Ошибка сервера: ${err.message}`);
  res.status(500).json({
    success: false,
    error: 'Внутренняя ошибка сервера',
    message: err.message
  });
});

// Запуск сервера
const server = app.listen(config.port, '0.0.0.0', () => {
  logger.info(`GPT-4o Audio Preview сервис запущен на порту ${config.port}`);
});

// Обработка сигналов завершения
process.on('SIGTERM', () => {
  logger.info('Получен сигнал SIGTERM, завершение работы...');
  server.close(() => {
    logger.info('Сервер остановлен');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Получен сигнал SIGINT, завершение работы...');
  server.close(() => {
    logger.info('Сервер остановлен');
    process.exit(0);
  });
});

module.exports = { app, server };