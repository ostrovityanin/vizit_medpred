/**
 * Маршруты для транскрипции аудио
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import axios from 'axios';
import FormData from 'form-data';
import { log } from '../vite';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Для работы с __dirname в ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// API ключ OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Базовый URL API OpenAI
const OPENAI_API_URL = 'https://api.openai.com/v1';

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

/**
 * Проверка наличия API ключа OpenAI
 * @returns {boolean} Результат проверки
 */
function hasOpenAIKey(): boolean {
  return !!OPENAI_API_KEY;
}

/**
 * Оптимизация аудиофайла для транскрипции
 * @param {string} inputPath Путь к исходному файлу
 * @returns {Promise<string>} Путь к оптимизированному файлу
 */
async function optimizeAudio(inputPath: string): Promise<string> {
  try {
    // Создаем папку для оптимизированных файлов если её нет
    const optimizedDir = path.join(path.dirname(inputPath), 'optimized');
    if (!fs.existsSync(optimizedDir)) {
      fs.mkdirSync(optimizedDir, { recursive: true });
    }

    // Путь к оптимизированному файлу
    const optimizedPath = path.join(
      optimizedDir,
      path.basename(inputPath, path.extname(inputPath)) + '.mp3'
    );

    // Проверяем существует ли файл
    if (!fs.existsSync(inputPath)) {
      console.error(`Исходный файл ${inputPath} не найден`);
      return inputPath; // Возвращаем исходный путь как запасной вариант
    }

    // Параметры оптимизации:
    // - Преобразуем в MP3 формат с битрейтом 32k 
    // - Моно аудио (1 канал)
    // - Частота дискретизации 16 кГц
    return new Promise<string>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', inputPath,
        '-ac', '1',
        '-ar', '16000',
        '-b:a', '32k',
        optimizedPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          // Проверяем размер оптимизированного файла
          if (fs.existsSync(optimizedPath)) {
            const stats = fs.statSync(optimizedPath);
            if (stats.size > 0) {
              log(`Аудио успешно оптимизировано: ${optimizedPath} (${Math.round(stats.size / 1024)} KB)`, 'transcription');
              resolve(optimizedPath);
              return;
            } else {
              log(`Оптимизированный файл имеет нулевой размер: ${optimizedPath}`, 'error');
            }
          } else {
            log(`Оптимизированный файл не был создан: ${optimizedPath}`, 'error');
          }
          resolve(inputPath); // Возвращаем исходный путь в случае ошибки
        } else {
          log(`Ошибка при оптимизации аудио, код: ${code}`, 'error');
          resolve(inputPath); // Возвращаем исходный путь в случае ошибки
        }
      });

      ffmpeg.stderr.on('data', (data) => {
        // ffmpeg выводит логи в stderr, это нормально
        // log(`ffmpeg: ${data.toString()}`, 'debug');
      });

      ffmpeg.on('error', (err) => {
        log(`Ошибка при запуске ffmpeg: ${err.message}`, 'error');
        resolve(inputPath); // Возвращаем исходный путь в случае ошибки
      });
    });
  } catch (error) {
    log(`Ошибка при оптимизации аудио: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return inputPath; // Возвращаем исходный путь в случае ошибки
  }
}

/**
 * Транскрипция аудио с использованием audio/transcriptions API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Опции транскрипции
 * @returns {Promise<{text: string, model: string, processingTime: number, segments?: any[]}>} Результат транскрипции
 */
async function transcribeWithAudioAPI(
  audioFilePath: string, 
  options: {
    model?: string;
    language?: string;
    prompt?: string;
    detailed?: boolean;
    skipOptimization?: boolean;
  } = {}
): Promise<{text: string, model: string, processingTime: number, segments?: any[]}> {
  try {
    log(`Транскрипция файла ${audioFilePath} с моделью ${options.model || 'whisper-1'}`, 'transcription');
    
    // Оптимизируем аудиофайл (если не указан параметр skipOptimization)
    const fileToTranscribe = options.skipOptimization ? 
      audioFilePath : 
      await optimizeAudio(audioFilePath);
    
    // Создаем форму для отправки
    const form = new FormData();
    form.append('file', fs.createReadStream(fileToTranscribe));
    form.append('model', options.model || 'whisper-1');
    
    // Добавляем язык, если указан (повышает точность транскрипции)
    if (options.language) {
      form.append('language', options.language);
    }
    
    // Добавляем подсказку, если указана
    if (options.prompt) {
      form.append('prompt', options.prompt);
    }
    
    // Запрашиваем детализированную информацию если нужно
    if (options.detailed) {
      // verbose_json даёт нам дополнительную информацию, включая сегменты и их временные метки
      form.append('response_format', 'verbose_json');
    }
    
    // Добавляем формат отклика JSON если не запрошена детализация
    if (!options.detailed) {
      form.append('response_format', 'json');
    }
    
    // Начало замера времени
    const startTime = Date.now();
    
    // Отправляем запрос
    const response = await axios.post(
      `${OPENAI_API_URL}/audio/transcriptions`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );
    
    // Конец замера времени
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000; // в секундах
    
    // Результат
    const result: {text: string, model: string, processingTime: number, segments?: any[]} = {
      text: response.data.text,
      model: options.model || 'whisper-1',
      processingTime
    };
    
    // Если запрошена детализированная информация, добавляем её
    if (options.detailed && response.data.segments) {
      result.segments = response.data.segments;
    }
    
    return result;
  } catch (error) {
    log('Ошибка при транскрипции аудио:', 'error');
    if (axios.isAxiosError(error) && error.response) {
      log(`Ответ API: ${JSON.stringify(error.response.data)}`, 'error');
    } else {
      log(`${error instanceof Error ? error.message : String(error)}`, 'error');
    }
    throw error;
  }
}

/**
 * Сравнительная транскрипция аудио с использованием всех доступных моделей
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Опции транскрипции
 * @returns {Promise<Object>} Результаты транскрипции от всех моделей
 */
async function compareTranscriptionModels(
  audioFilePath: string, 
  options: {language?: string, prompt?: string} = {}
): Promise<Record<string, any>> {
  try {
    // Оптимизируем аудиофайл один раз для всех моделей
    const optimizedPath = await optimizeAudio(audioFilePath);
    
    log(`Сравнительная транскрипция файла ${optimizedPath} с использованием всех моделей`, 'transcription');
    
    // Список моделей для сравнения
    const models = [
      'whisper-1',              // Базовая модель
      'gpt-4o-mini-transcribe', // Быстрая модель
      'gpt-4o-transcribe'       // Высокоточная модель
    ];
    
    // Собираем результаты от всех моделей
    const results: Record<string, any> = {};
    
    // Параллельно запускаем транскрипцию с разными моделями
    const transcriptionPromises = models.map(model => {
      return transcribeWithAudioAPI(optimizedPath, {
        ...options,
        model,
        skipOptimization: true // Файл уже оптимизирован
      })
      .then(result => {
        results[model] = result;
      })
      .catch(error => {
        log(`Ошибка при транскрипции с моделью ${model}: ${error instanceof Error ? error.message : String(error)}`, 'error');
        results[model] = { error: error instanceof Error ? error.message : String(error) };
      });
    });
    
    // Ждем завершения всех запросов
    await Promise.all(transcriptionPromises);
    
    return results;
  } catch (error) {
    log(`Ошибка при сравнительной транскрипции: ${error instanceof Error ? error.message : String(error)}`, 'error');
    throw error;
  }
}

/**
 * Выполняет транскрипцию аудиофайла с автоматическим выбором лучшей модели
 * на основе языка и других параметров
 * 
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Опции транскрипции
 * @returns {Promise<{text: string, model: string, processingTime: number, segments?: any[]}>} Результат транскрипции
 */
async function transcribeAudio(
  audioFilePath: string, 
  options: {
    language?: string;
    prompt?: string;
    detailed?: boolean;
    speed?: string;
  } = {}
): Promise<{text: string, model: string, processingTime: number, segments?: any[]}> {
  try {
    // Выбор модели на основе языка и предпочтений пользователя
    let model: string;
    
    // 1. Если язык русский
    if (options.language === 'ru') {
      if (options.speed === 'fast') {
        model = 'gpt-4o-mini-transcribe'; 
      } else if (options.speed === 'accurate') {
        model = 'gpt-4o-transcribe';
      } else {
        // По умолчанию для русского используем gpt-4o-mini-transcribe (оптимальный баланс)
        model = 'gpt-4o-mini-transcribe';
      }
    } 
    // 2. Если язык английский или другой
    else if (options.language && options.language !== 'ru') {
      if (options.speed === 'fast') {
        model = 'whisper-1';
      } else if (options.speed === 'accurate') {
        model = 'gpt-4o-transcribe';
      } else {
        // По умолчанию для английского и других языков используем whisper-1
        model = 'whisper-1';
      }
    }
    // 3. Если язык не указан
    else {
      // По умолчанию используем gpt-4o-mini-transcribe как универсальную модель
      model = 'gpt-4o-mini-transcribe';
    }
    
    log(`Автоматический выбор модели: ${model} для транскрипции файла ${audioFilePath} (язык: ${options.language || 'не указан'})`, 'transcription');
    
    // Выполняем транскрипцию с выбранной моделью
    return await transcribeWithAudioAPI(audioFilePath, {
      ...options,
      model
    });
  } catch (error) {
    log(`Ошибка при транскрипции: ${error instanceof Error ? error.message : String(error)}`, 'error');
    
    // Если ошибка связана с моделью (например, модель не существует),
    // пробуем с базовой моделью whisper-1
    if (axios.isAxiosError(error) && error.response && error.response.status === 404) {
      log('Пробуем с базовой моделью whisper-1 (fallback)', 'transcription');
      return await transcribeWithAudioAPI(audioFilePath, {
        ...options,
        model: 'whisper-1'
      });
    }
    
    throw error;
  }
}

// Проверка API ключа
router.use((req, res, next) => {
  if (!hasOpenAIKey()) {
    return res.status(500).json({ 
      error: 'Ключ API OpenAI не найден. Проверьте переменную окружения OPENAI_API_KEY.'
    });
  }
  next();
});

// Маршрут для транскрипции аудио
router.post('/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Аудиофайл не загружен' });
    }
    
    log(`Получен запрос на транскрипцию: ${req.file.originalname}, размер: ${req.file.size} байт`, 'transcription');
    
    // Параметры транскрипции из запроса
    const options = {
      language: req.body.language || 'ru',
      prompt: req.body.prompt || '',
      detailed: req.body.detailed === 'true',
      speed: req.body.speed
    };
    
    // Выполняем транскрипцию
    const result = await transcribeAudio(req.file.path, options);
    
    // Удаляем исходный файл
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (deleteError) {
      log(`Предупреждение: не удалось удалить исходный файл: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`, 'transcription');
    }
    
    // Возвращаем результат
    res.json({
      text: result.text,
      processingTime: result.processingTime,
      model: result.model,
      fileSize: req.file.size,
      fileName: req.file.originalname,
      ...(result.segments ? { segments: result.segments } : {})
    });
    
  } catch (error) {
    log(`Ошибка обработки запроса транскрипции: ${error instanceof Error ? error.message : String(error)}`, 'error');
    res.status(500).json({ error: 'Ошибка сервера при обработке запроса транскрипции' });
  }
});

// Маршрут для сравнения всех моделей транскрипции
router.post('/transcribe/compare', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Аудиофайл не загружен' });
    }
    
    log(`Получен запрос на сравнительную транскрипцию: ${req.file.originalname}`, 'transcription');
    
    // Параметры транскрипции из запроса
    const options = {
      language: req.body.language || 'ru',
      prompt: req.body.prompt || ''
    };
    
    // Выполняем сравнительную транскрипцию
    const results = await compareTranscriptionModels(req.file.path, options);
    
    // Удаляем исходный файл
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (deleteError) {
      log(`Предупреждение: не удалось удалить исходный файл: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`, 'transcription');
    }
    
    // Добавляем информацию о файле
    const response = {
      ...results,
      fileSize: req.file.size,
      fileName: req.file.originalname
    };
    
    // Возвращаем результаты
    res.json(response);
    
  } catch (error) {
    log(`Ошибка обработки запроса сравнения: ${error instanceof Error ? error.message : String(error)}`, 'error');
    res.status(500).json({ error: 'Ошибка сервера при сравнительной транскрипции' });
  }
});

export default router;