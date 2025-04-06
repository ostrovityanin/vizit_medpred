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
 * @param {Object} options Дополнительные опции оптимизации
 * @returns {Promise<string>} Путь к оптимизированному файлу
 */
async function optimizeAudio(
  inputPath: string, 
  options: {
    targetModel?: string;
    highQuality?: boolean;
  } = {}
): Promise<string> {
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
      log(`Исходный файл ${inputPath} не найден`, 'error');
      return inputPath; // Возвращаем исходный путь как запасной вариант
    }

    // Проверка размера файла
    const stats = fs.statSync(inputPath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    
    // Если файл больше 20MB, может потребоваться дополнительная компрессия
    const needsCompression = fileSizeInMB > 20;

    // Определяем настройки на основе модели и требуемого качества
    let bitrate = '32k';  // Стандартный битрейт для транскрипции
    let sampleRate = '16000'; // Стандартная частота дискретизации
    
    // Для GPT-4o моделей:
    if (options.targetModel && options.targetModel.includes('gpt-4o')) {
      // Эти модели работают лучше с высоким качеством аудио
      bitrate = options.highQuality ? '48k' : '40k';
      sampleRate = '24000';
    } 
    
    // Для Whisper и других случаев оставляем стандартные параметры
    
    // Параметры оптимизации:
    // - Преобразуем в MP3 формат с оптимальным битрейтом
    // - Нормализация аудио для улучшения распознавания
    // - Моно аудио (1 канал)
    // - Оптимальная частота дискретизации
    return new Promise<string>((resolve, reject) => {
      const ffmpegArgs = [
        '-y',
        '-i', inputPath,
        '-ac', '1',
        '-ar', sampleRate,
      ];
      
      // Добавляем нормализацию громкости для лучшего распознавания тихих записей
      ffmpegArgs.push('-af', 'loudnorm=I=-16:LRA=11:TP=-1.5');
      
      // Если требуется, добавляем фильтр шумоподавления (легкий, чтобы не испортить речь)
      if (!options.highQuality && !options.targetModel?.includes('gpt-4o-transcribe')) {
        ffmpegArgs.push('-af', 'afftdn=nf=-20');
      }
      
      // Настройки битрейта
      ffmpegArgs.push('-b:a', bitrate);
      
      // Добавляем выходной файл
      ffmpegArgs.push(optimizedPath);

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);

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
          // Если оптимизация не удалась, попробуем упрощенный вариант
          trySimpleOptimization(inputPath, optimizedPath).then(result => {
            resolve(result);
          }).catch(() => {
            resolve(inputPath); // В случае ошибки возвращаем исходный путь
          });
        } else {
          log(`Ошибка при оптимизации аудио, код: ${code}`, 'error');
          // Если сложная оптимизация не удалась, попробуем упрощенный вариант
          trySimpleOptimization(inputPath, optimizedPath).then(result => {
            resolve(result);
          }).catch(() => {
            resolve(inputPath); // В случае ошибки возвращаем исходный путь
          });
        }
      });

      ffmpeg.stderr.on('data', (data) => {
        // ffmpeg выводит логи в stderr, это нормально
        // log(`ffmpeg: ${data.toString()}`, 'debug');
      });

      ffmpeg.on('error', (err) => {
        log(`Ошибка при запуске ffmpeg: ${err.message}`, 'error');
        // Пробуем упрощенный вариант оптимизации
        trySimpleOptimization(inputPath, optimizedPath).then(result => {
          resolve(result);
        }).catch(() => {
          resolve(inputPath); // В случае ошибки возвращаем исходный путь
        });
      });
    });
  } catch (error) {
    log(`Ошибка при оптимизации аудио: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return inputPath; // Возвращаем исходный путь в случае ошибки
  }
}

/**
 * Упрощенная оптимизация файла без дополнительных фильтров
 * @param {string} inputPath Путь к исходному файлу
 * @param {string} outputPath Путь для сохранения оптимизированного файла
 * @returns {Promise<string>} Путь к результирующему файлу
 */
async function trySimpleOptimization(inputPath: string, outputPath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    log(`Попытка упрощенной оптимизации: ${inputPath}`, 'transcription');
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i', inputPath,
      '-ac', '1',        // Моно
      '-ar', '16000',    // Частота 16 кГц
      '-b:a', '32k',     // Битрейт 32 кбит/с
      outputPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        log(`Упрощенная оптимизация успешна: ${outputPath}`, 'transcription');
        resolve(outputPath);
      } else {
        log(`Упрощенная оптимизация не удалась`, 'error');
        reject(new Error('Упрощенная оптимизация не удалась'));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
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
    speed?: string;
  } = {}
): Promise<{text: string, model: string, processingTime: number, segments?: any[]}> {
  try {
    log(`Транскрипция файла ${audioFilePath} с моделью ${options.model || 'whisper-1'}`, 'transcription');
    
    // Оптимизируем аудиофайл (если не указан параметр skipOptimization)
    const fileToTranscribe = options.skipOptimization ? 
      audioFilePath : 
      await optimizeAudio(audioFilePath, { targetModel: options.model });
    
    // Создаем форму для отправки
    const form = new FormData();
    form.append('file', fs.createReadStream(fileToTranscribe));
    
    // Указываем модель (с учетом особенностей новых моделей GPT-4o)
    const model = options.model || 'whisper-1';
    form.append('model', model);
    
    // Добавляем язык, если указан (повышает точность транскрипции)
    if (options.language) {
      form.append('language', options.language);
    }
    
    // Для моделей gpt-4o добавляем дополнительные параметры и более информативный prompt
    if (model.includes('gpt-4o')) {
      // Для моделей gpt-4o используем специальные подсказки для улучшения качества
      const enhancedPrompt = options.prompt || 
        `Расшифруй полностью всю речь в аудиозаписи на языке ${options.language || 'русском'}. Не пропускай никакие фрагменты.`;
      form.append('prompt', enhancedPrompt);
      
      // Настраиваем temperature для лучшего качества
      form.append('temperature', '0.1');
    } else {
      // Для whisper используем стандартные параметры
      if (options.prompt) {
        form.append('prompt', options.prompt);
      }
    }
    
    // Запрашиваем детализированную информацию если нужно
    if (options.detailed) {
      // verbose_json даёт нам дополнительную информацию, включая сегменты и их временные метки
      form.append('response_format', 'verbose_json');
    } else {
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
  options: {
    language?: string; 
    prompt?: string;
    skipOptimization?: boolean;
  } = {}
): Promise<Record<string, any>> {
  try {
    log(`Сравнительная транскрипция файла ${audioFilePath} с использованием всех моделей`, 'transcription');
    
    // Список моделей для сравнения
    const models = [
      'whisper-1',              // Базовая модель
      'gpt-4o-mini-transcribe', // Быстрая модель
      'gpt-4o-transcribe'       // Высокоточная модель
    ];
    
    // Собираем результаты от всех моделей
    const results: Record<string, any> = {};
    
    // Для каждой модели выполняем оптимизацию под конкретную модель
    for (const model of models) {
      try {
        // Оптимизируем файл для конкретной модели 
        // (каждая модель может требовать разных параметров оптимизации)
        const optimizedPath = await optimizeAudio(audioFilePath, {
          targetModel: model,
          highQuality: model === 'gpt-4o-transcribe' // Для высокоточной модели используем высшее качество
        });
        
        log(`Транскрипция с моделью ${model} (оптимизированный файл: ${optimizedPath})`, 'transcription');
        
        // Формируем правильные параметры для каждой модели
        const modelOptions: {
          model: string;
          language?: string;
          prompt?: string;
          skipOptimization?: boolean;
        } = { 
          ...options,
          model 
        };
        
        // Добавляем специфичные для каждой модели параметры
        if (model.includes('gpt-4o')) {
          // Для GPT-4o моделей добавляем более подробный prompt 
          // с указанием особенностей языка (если не указано пользователем)
          if (!options.prompt) {
            const lang = options.language || 'ru';
            let enhancedPrompt = '';
            
            if (lang === 'ru') {
              enhancedPrompt = `Пожалуйста, расшифруй полностью всю речь в аудиозаписи на русском языке. Обрати внимание на специфические термины и выражения. Не пропускай никакие фрагменты речи.`;
            } else if (lang === 'en') {
              enhancedPrompt = `Please transcribe all the speech in this audio file in English. Pay attention to specific terms and expressions. Don't skip any part of the speech.`;
            } else {
              enhancedPrompt = `Please transcribe all the speech in this audio file in ${lang}. Pay attention to specific terms and expressions. Don't skip any fragments.`;
            }
            
            modelOptions.prompt = enhancedPrompt;
          }
        }
        
        // Оптимизация аудио уже выполнена ранее
        modelOptions.skipOptimization = true;
        
        // Выполняем транскрипцию
        const result = await transcribeWithAudioAPI(optimizedPath, modelOptions);
        results[model] = result;
      } catch (error) {
        log(`Ошибка при транскрипции с моделью ${model}: ${error instanceof Error ? error.message : String(error)}`, 'error');
        results[model] = { error: error instanceof Error ? error.message : String(error) };
      }
    }
    
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

/**
 * Маршрут для диаризации аудио (определения говорящих)
 * 
 * Отправляет аудиофайл в микросервис диаризации и возвращает результат
 * с информацией о разных говорящих и сегментах их речи.
 * 
 * Опционально выполняет транскрипцию каждого сегмента и объединяет результаты.
 */
// Импортируем функции для диаризации из нашего нового модуля
// @ts-ignore - Игнорируем ошибки типизации для JS модуля
import { simpleDiarizeAudio, simpleDiarizeAndTranscribe, simpleDiarizeAndCompareModels } from '../simple-diarization.js';

/**
 * Маршрут для диаризации аудио (определения говорящих)
 * 
 * Использует внутренний JavaScript модуль упрощенной диаризации
 * без зависимости от внешнего микросервиса.
 */
router.post('/diarize', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    // Проверяем параметры запроса
    const minSpeakers = parseInt(req.body.min_speakers || '1', 10);
    const maxSpeakers = parseInt(req.body.max_speakers || '10', 10);
    const withTranscription = req.body.transcribe === 'true';
    const language = req.body.language || 'ru';
    const model = req.body.model || (language === 'ru' ? 'gpt-4o-transcribe' : 'whisper-1');
    
    log(`Получен запрос на диаризацию аудио: ${req.file.path}, с транскрипцией: ${withTranscription}, модель: ${model}`, 'diarization');
    
    try {
      let result;
      
      if (withTranscription && hasOpenAIKey()) {
        // Функция для транскрипции сегментов
        const transcribeSegment = async (segmentPath: string) => {
          try {
            const transcriptionResult = await transcribeWithAudioAPI(segmentPath, {
              model,
              language,
              prompt: `Расшифруй точно текст этого фрагмента на ${language === 'ru' ? 'русском' : 'английском'} языке.`
            });
            
            return transcriptionResult.text;
          } catch (error) {
            log(`Ошибка при транскрипции сегмента: ${error instanceof Error ? error.message : String(error)}`, 'error');
            return '';
          }
        };
        
        // Выполняем диаризацию и транскрипцию
        result = await simpleDiarizeAndTranscribe(
          req.file.path,
          { minSpeakers, maxSpeakers },
          transcribeSegment
        );
      } else {
        // Только диаризация без транскрипции
        result = await simpleDiarizeAudio(req.file.path, { minSpeakers, maxSpeakers });
      }
      
      // Форматируем ответ
      const response = {
        ...result,
        fileName: req.file.originalname,
        fileSize: req.file.size,
      };
      
      // Удаляем временные файлы
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (error) {
        log(`Ошибка при удалении временного файла: ${error instanceof Error ? error.message : String(error)}`, 'warning');
      }
      
      return res.json(response);
      
    } catch (processingError) {
      log(`Ошибка при обработке аудио: ${processingError instanceof Error ? processingError.message : String(processingError)}`, 'error');
      return res.status(500).json({
        error: 'Ошибка при обработке аудио',
        details: processingError instanceof Error ? processingError.message : String(processingError)
      });
    }
    
  } catch (error) {
    log(`Ошибка в маршруте /diarize: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * Маршрут для диаризации аудио с транскрипцией разными моделями
 * 
 * Этот маршрут использует упрощенную JavaScript-диаризацию и сравнивает
 * качество транскрипции сегментов разными моделями.
 */
router.post('/diarize/compare', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    // Проверяем параметры запроса
    const minSpeakers = parseInt(req.body.min_speakers || '1', 10);
    const maxSpeakers = parseInt(req.body.max_speakers || '10', 10);
    const language = req.body.language || 'ru';
    
    log(`Получен запрос на сравнительную диаризацию аудио: ${req.file.path}`, 'diarization');
    
    if (!hasOpenAIKey()) {
      return res.status(400).json({ 
        error: 'API ключ OpenAI не настроен',
        details: 'Для сравнительной транскрипции требуется ключ API OpenAI'
      });
    }
    
    try {
      // Функция для сравнительной транскрипции сегментов разными моделями
      const compareTranscriptionForSegment = async (segmentPath: string, options: {speakerIndex?: number} = {}) => {
        try {
          const speakerIndex = options.speakerIndex || 0;
          
          // Список моделей
          const models = ['whisper-1', 'gpt-4o-mini-transcribe', 'gpt-4o-transcribe'];
          
          // Результаты по каждой модели
          const results: { [key: string]: any } = {};
          
          // Транскрибируем сегмент каждой моделью
          for (const model of models) {
            try {
              // Оптимизируем файл для конкретной модели
              const optimizedPath = await optimizeAudio(segmentPath, {
                targetModel: model,
                highQuality: model === 'gpt-4o-transcribe'
              });
              
              // Формируем промпт для транскрипции
              let prompt = '';
              if (language === 'ru') {
                prompt = `Расшифруй точно текст этого фрагмента на русском языке. Это речь говорящего ${speakerIndex}.`;
              } else {
                prompt = `Transcribe this audio segment accurately in ${language}. This is speech from speaker ${speakerIndex}.`;
              }
              
              // Транскрибируем
              const result = await transcribeWithAudioAPI(optimizedPath, {
                model,
                language,
                prompt,
                skipOptimization: true // Уже оптимизировали выше
              });
              
              results[model] = result;
            } catch (error) {
              log(`Ошибка при транскрипции сегмента моделью ${model}: ${error instanceof Error ? error.message : String(error)}`, 'error');
              results[model] = { 
                error: error instanceof Error ? error.message : String(error),
                text: ''
              };
            }
          }
          
          return results;
        } catch (error) {
          log(`Ошибка при сравнительной транскрипции сегмента: ${error instanceof Error ? error.message : String(error)}`, 'error');
          return {
            error: error instanceof Error ? error.message : String(error)
          };
        }
      };
      
      // Выполняем диаризацию и сравнительную транскрипцию
      const result = await simpleDiarizeAndCompareModels(
        req.file.path,
        { minSpeakers, maxSpeakers },
        compareTranscriptionForSegment
      );
      
      // Форматируем ответ
      const response = {
        ...result,
        fileName: req.file.originalname,
        fileSize: req.file.size,
      };
      
      // Удаляем временные файлы
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (error) {
        log(`Ошибка при удалении временного файла: ${error instanceof Error ? error.message : String(error)}`, 'warning');
      }
      
      return res.json(response);
      
    } catch (processingError) {
      log(`Ошибка при обработке аудио: ${processingError instanceof Error ? processingError.message : String(processingError)}`, 'error');
      return res.status(500).json({
        error: 'Ошибка при обработке аудио',
        details: processingError instanceof Error ? processingError.message : String(processingError)
      });
    }
  } catch (error) {
    log(`Ошибка в маршруте /diarize/compare: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Экспортируем функцию compareTranscriptionModels для использования в других модулях
export { compareTranscriptionModels };

export default router;