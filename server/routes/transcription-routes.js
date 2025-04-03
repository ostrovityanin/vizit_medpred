/**
 * Маршруты для транскрипции аудио
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const transcriptionAPI = require('../transcription-api');

const router = express.Router();

// Настройка multer для загрузки аудиофайлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../temp/uploads');
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
  },
  fileFilter: (req, file, cb) => {
    // Проверка типа файла
    const allowedFileTypes = /wav|mp3|ogg|m4a|webm|mp4|mpga|mpeg/;
    const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedFileTypes.test(file.mimetype);
    
    if (extname || mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый формат аудиофайла'));
    }
  }
});

// Проверка API ключа
router.use((req, res, next) => {
  if (!transcriptionAPI.hasOpenAIKey()) {
    return res.status(500).json({ 
      error: 'Ключ API OpenAI не найден. Проверьте переменную окружения OPENAI_API_KEY.'
    });
  }
  next();
});

// Маршрут для транскрипции аудио
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Аудиофайл не загружен' });
    }
    
    console.log(`Получен запрос на транскрипцию: ${req.file.originalname}, размер: ${req.file.size} байт`);
    
    // Параметры транскрипции из запроса
    const options = {
      language: req.body.language || 'ru',
      prompt: req.body.prompt || '',
      detailed: req.body.detailed === 'true',
      speed: req.body.speed
    };
    
    // Выполняем транскрипцию
    const result = await transcriptionAPI.transcribeAudio(req.file.path, options);
    
    // Удаляем исходный файл
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    // Возвращаем результат
    res.json({
      text: result.text,
      processingTime: result.processingTime,
      model: result.model,
      fileSize: req.file.size,
      fileName: req.file.originalname
    });
    
  } catch (error) {
    console.error(`Ошибка обработки запроса транскрипции: ${error.message}`);
    res.status(500).json({ error: 'Ошибка сервера при обработке запроса транскрипции' });
  }
});

// Маршрут для сравнения всех моделей транскрипции
router.post('/transcribe/compare', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Аудиофайл не загружен' });
    }
    
    console.log(`Получен запрос на сравнительную транскрипцию: ${req.file.originalname}`);
    
    // Параметры транскрипции из запроса
    const options = {
      language: req.body.language || 'ru',
      prompt: req.body.prompt || ''
    };
    
    // Выполняем сравнительную транскрипцию
    const results = await transcriptionAPI.compareTranscriptionModels(req.file.path, options);
    
    // Удаляем исходный файл
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    // Добавляем информацию о файле
    results.fileSize = req.file.size;
    results.fileName = req.file.originalname;
    
    // Возвращаем результаты
    res.json(results);
    
  } catch (error) {
    console.error(`Ошибка обработки запроса сравнения: ${error.message}`);
    res.status(500).json({ error: 'Ошибка сервера при сравнительной транскрипции' });
  }
});

// Для ESM-совместимости мы также экспортируем маршруты как default
module.exports = router;
module.exports.default = router;