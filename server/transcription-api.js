/**
 * API для транскрипции аудио с помощью различных моделей OpenAI
 * 
 * Этот модуль предоставляет прямой доступ к функциям транскрипции
 * без необходимости запуска отдельного микросервиса.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);

// API ключ OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Базовый URL API OpenAI
const OPENAI_API_URL = 'https://api.openai.com/v1';

/**
 * Проверка наличия API ключа OpenAI
 * @returns {boolean} Результат проверки
 */
function hasOpenAIKey() {
  return !!OPENAI_API_KEY;
}

/**
 * Оптимизация аудиофайла для транскрипции
 * @param {string} inputPath Путь к исходному файлу
 * @returns {Promise<string>} Путь к оптимизированному файлу
 */
async function optimizeAudio(inputPath) {
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
    const cmd = `ffmpeg -y -i "${inputPath}" -ac 1 -ar 16000 -b:a 32k "${optimizedPath}"`;
    
    console.log(`Оптимизируем аудио: ${cmd}`);
    
    // Выполняем конвертацию
    await execAsync(cmd);
    
    // Проверяем размер оптимизированного файла
    if (fs.existsSync(optimizedPath)) {
      const stats = fs.statSync(optimizedPath);
      if (stats.size > 0) {
        console.log(`Аудио успешно оптимизировано: ${optimizedPath} (${Math.round(stats.size / 1024)} KB)`);
        return optimizedPath;
      } else {
        console.error(`Оптимизированный файл имеет нулевой размер: ${optimizedPath}`);
      }
    } else {
      console.error(`Оптимизированный файл не был создан: ${optimizedPath}`);
    }
    
    // Если что-то пошло не так, возвращаем исходный путь
    return inputPath;
  } catch (error) {
    console.error(`Ошибка при оптимизации аудио: ${error.message}`);
    return inputPath; // Возвращаем исходный путь в случае ошибки
  }
}

/**
 * Транскрипция аудио с использованием audio/transcriptions API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Опции транскрипции
 * @returns {Promise<Object>} Результат транскрипции
 */
async function transcribeWithAudioAPI(audioFilePath, options = {}) {
  try {
    console.log(`Транскрипция файла ${audioFilePath} с моделью ${options.model || 'whisper-1'}`);
    
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
    const result = {
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
    console.error('Ошибка при транскрипции аудио:', error.message);
    if (error.response) {
      console.error('Ответ API:', error.response.data);
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
async function compareTranscriptionModels(audioFilePath, options = {}) {
  try {
    // Оптимизируем аудиофайл один раз для всех моделей
    const optimizedPath = await optimizeAudio(audioFilePath);
    
    console.log(`Сравнительная транскрипция файла ${optimizedPath} с использованием всех моделей`);
    
    // Список моделей для сравнения
    const models = [
      'whisper-1',              // Базовая модель
      'gpt-4o-mini-transcribe', // Быстрая модель
      'gpt-4o-transcribe'       // Высокоточная модель
    ];
    
    // Собираем результаты от всех моделей
    const results = {};
    
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
        console.error(`Ошибка при транскрипции с моделью ${model}:`, error.message);
        results[model] = { error: error.message };
      });
    });
    
    // Ждем завершения всех запросов
    await Promise.all(transcriptionPromises);
    
    return results;
  } catch (error) {
    console.error('Ошибка при сравнительной транскрипции:', error.message);
    throw error;
  }
}

/**
 * Выполняет транскрипцию аудиофайла с автоматическим выбором лучшей модели
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Опции транскрипции
 * @returns {Promise<Object>} Результат транскрипции
 */
async function transcribeAudio(audioFilePath, options = {}) {
  try {
    // Выбор модели на основе предпочтений пользователя
    let model = 'whisper-1'; // Модель по умолчанию
    
    // Если указан параметр speed, выбираем модель в зависимости от него
    if (options.speed) {
      if (options.speed === 'fast') {
        model = 'gpt-4o-mini-transcribe'; // Быстрая модель
      } else if (options.speed === 'accurate') {
        model = 'gpt-4o-transcribe'; // Точная модель
      }
    } else {
      // Если скорость не указана, выбираем по умолчанию gpt-4o-mini-transcribe
      // как хороший баланс между скоростью и точностью
      model = 'gpt-4o-mini-transcribe';
    }
    
    console.log(`Автоматический выбор модели: ${model} для транскрипции файла ${audioFilePath}`);
    
    // Выполняем транскрипцию с выбранной моделью
    return await transcribeWithAudioAPI(audioFilePath, {
      ...options,
      model
    });
  } catch (error) {
    console.error('Ошибка при транскрипции:', error.message);
    
    // Если ошибка связана с моделью (например, модель не существует),
    // пробуем с базовой моделью whisper-1
    if (error.response && error.response.status === 404) {
      console.log('Пробуем с базовой моделью whisper-1');
      return await transcribeWithAudioAPI(audioFilePath, {
        ...options,
        model: 'whisper-1'
      });
    }
    
    throw error;
  }
}

module.exports = {
  hasOpenAIKey,
  optimizeAudio,
  transcribeWithAudioAPI,
  compareTranscriptionModels,
  transcribeAudio
};