/**
 * Маршруты API для функций диаризации и сравнения транскрипций
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import diarizationComparison from '../modules/diarization-comparison/index.js';

// Получаем путь к текущей директории (необходимо для ES модулей)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Конфигурация хранилища для загруженных файлов
const uploadDir = path.join(__dirname, '..', '..', 'temp', 'uploads');

// Создаем директорию, если она не существует
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Настраиваем multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `audio-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    // Проверяем тип файла
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Только аудиофайлы могут быть загружены!'), false);
    }
  }
});

/**
 * @route GET /api/diarization/status
 * @description Проверка статуса сервиса диаризации
 * @access Public
 */
router.get('/status', async (req, res) => {
  try {
    const status = await diarizationComparison.checkDiarizationServiceStatus();
    res.json(status);
  } catch (error) {
    console.error('Error checking diarization service status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check diarization service status',
      error: error.message
    });
  }
});

/**
 * @route POST /api/diarization/start
 * @description Запуск сервиса диаризации
 * @access Public
 */
router.post('/start', async (req, res) => {
  try {
    const { simplified = true } = req.body;
    const result = await diarizationComparison.startDiarizationService(simplified);
    res.json(result);
  } catch (error) {
    console.error('Error starting diarization service:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to start diarization service',
      error: error.message
    });
  }
});

/**
 * @route POST /api/diarization/stop
 * @description Остановка сервиса диаризации
 * @access Public
 */
router.post('/stop', async (req, res) => {
  try {
    const result = await diarizationComparison.stopDiarizationService();
    res.json(result);
  } catch (error) {
    console.error('Error stopping diarization service:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to stop diarization service',
      error: error.message
    });
  }
});

/**
 * @route POST /api/diarization/process
 * @description Обработка аудиофайла с диаризацией и транскрипцией
 * @access Public
 */
router.post('/process', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No audio file provided'
      });
    }
    
    const audioFilePath = req.file.path;
    
    // Получаем опции из запроса
    const options = {
      minSpeakers: parseInt(req.body.minSpeakers || '1', 10),
      maxSpeakers: parseInt(req.body.maxSpeakers || '10', 10),
      language: req.body.language || null,
      models: req.body.models ? req.body.models.split(',') : undefined,
      outputFilename: req.body.saveResults === 'true' ? 
        `result-${Date.now()}.json` : undefined
    };
    
    console.log(`Processing audio file: ${audioFilePath}`);
    console.log('Options:', options);
    
    const result = await diarizationComparison.processAudioFile(audioFilePath, options);
    
    // Удаляем временный файл после обработки
    if (fs.existsSync(audioFilePath)) {
      fs.unlinkSync(audioFilePath);
      console.log(`Temporary file removed: ${audioFilePath}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error processing audio file:', error);
    
    // Удаляем временный файл в случае ошибки
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to process audio file',
      error: error.message
    });
  }
});

/**
 * @route POST /api/diarization/diarize
 * @description Только диаризация аудиофайла
 * @access Public
 */
router.post('/diarize', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No audio file provided'
      });
    }
    
    const audioFilePath = req.file.path;
    
    // Получаем опции из запроса
    const options = {
      minSpeakers: parseInt(req.body.minSpeakers || '1', 10),
      maxSpeakers: parseInt(req.body.maxSpeakers || '10', 10)
    };
    
    console.log(`Diarizing audio file: ${audioFilePath}`);
    console.log('Options:', options);
    
    const result = await diarizationComparison.performDiarization(audioFilePath, options);
    
    // Удаляем временный файл после обработки
    if (fs.existsSync(audioFilePath)) {
      fs.unlinkSync(audioFilePath);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error diarizing audio file:', error);
    
    // Удаляем временный файл в случае ошибки
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to diarize audio file',
      error: error.message
    });
  }
});

/**
 * @route POST /api/diarization/transcribe
 * @description Транскрипция аудиофайла с использованием нескольких моделей
 * @access Public
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No audio file provided'
      });
    }
    
    const audioFilePath = req.file.path;
    
    // Получаем опции из запроса
    const models = req.body.models ? req.body.models.split(',') : undefined;
    const language = req.body.language || null;
    
    console.log(`Transcribing audio file: ${audioFilePath}`);
    console.log(`Models: ${models ? models.join(', ') : 'default'}`);
    
    const result = await diarizationComparison.performMultiModelTranscription(
      audioFilePath, models, language
    );
    
    // Удаляем временный файл после обработки
    if (fs.existsSync(audioFilePath)) {
      fs.unlinkSync(audioFilePath);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error transcribing audio file:', error);
    
    // Удаляем временный файл в случае ошибки
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to transcribe audio file',
      error: error.message
    });
  }
});

/**
 * @route GET /api/diarization/models
 * @description Получение списка доступных моделей транскрипции
 * @access Public
 */
router.get('/models', (req, res) => {
  // Список доступных моделей
  const models = [
    {
      id: 'whisper-1',
      name: 'Whisper',
      description: 'OpenAI Whisper model, оптимизирована для транскрипции речи',
      languages: ['en', 'ru', 'uk', 'de', 'fr', 'es', 'it', 'pt', 'ja', 'zh', 'ko']
    },
    {
      id: 'gpt-4o-mini-transcribe',
      name: 'GPT-4o Mini Transcribe',
      description: 'Облегченная GPT-4o модель с возможностью транскрипции',
      languages: ['en', 'ru', 'uk', 'de', 'fr', 'es', 'it', 'pt', 'ja', 'zh', 'ko']
    },
    {
      id: 'gpt-4o-transcribe',
      name: 'GPT-4o Transcribe',
      description: 'Полная GPT-4o модель с возможностью транскрипции',
      languages: ['en', 'ru', 'uk', 'de', 'fr', 'es', 'it', 'pt', 'ja', 'zh', 'ko']
    }
  ];
  
  res.json({
    status: 'success',
    models
  });
});

export default router;