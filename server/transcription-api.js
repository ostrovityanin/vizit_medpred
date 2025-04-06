/**
 * Модуль для централизованной транскрипции аудио
 * 
 * Этот модуль предоставляет унифицированный API для транскрипции аудиофайлов
 * с использованием различных моделей OpenAI.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import { exec as execCb } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import FormData from 'form-data';

// Получаем путь к текущему файлу и директории
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Преобразуем callback-версию exec в Promise
const exec = promisify(execCb);

// Пути для временных файлов
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Подготовка аудиофайла для оптимальной транскрипции
 * @param {string} audioPath Путь к исходному аудиофайлу
 * @param {Object} options Опции оптимизации
 * @returns {Promise<string>} Путь к оптимизированному аудиофайлу
 */
async function prepareAudioFile(audioPath, options = {}) {
  try {
    const {
      convertToMp3 = true,
      normalize = true,
      removeSilence = false,
      sampleRate = 16000,
      mono = true
    } = options;
    
    // Определяем тип исходного файла
    const fileExt = path.extname(audioPath).toLowerCase();
    const needsConversion = convertToMp3 && fileExt !== '.mp3';
    
    // Если не требуется конвертация или нормализация, возвращаем исходный файл
    if (!needsConversion && !normalize && !removeSilence) {
      return audioPath;
    }
    
    // Генерируем имя для оптимизированного файла
    const optimizedFilename = `optimized_${uuidv4()}.mp3`;
    const optimizedPath = path.join(TEMP_DIR, optimizedFilename);
    
    // Формируем команду FFmpeg
    let ffmpegCommand = `ffmpeg -i "${audioPath}"`;
    
    // Добавляем параметры оптимизации
    if (mono) {
      ffmpegCommand += ' -ac 1';
    }
    
    if (sampleRate) {
      ffmpegCommand += ` -ar ${sampleRate}`;
    }
    
    // Нормализация аудио
    if (normalize) {
      ffmpegCommand += ' -filter:a loudnorm';
    }
    
    // Удаление тишины
    if (removeSilence) {
      ffmpegCommand += ' -af silenceremove=stop_periods=-1:stop_threshold=-50dB';
    }
    
    // Настройки кодирования MP3
    ffmpegCommand += ' -c:a libmp3lame -b:a 32k';
    
    // Путь для вывода
    ffmpegCommand += ` "${optimizedPath}" -y`;
    
    console.log(`[transcription-api] Оптимизация аудио: ${ffmpegCommand}`);
    
    // Выполняем команду
    await exec(ffmpegCommand);
    
    // Проверяем, что файл создался
    if (!fs.existsSync(optimizedPath)) {
      throw new Error('Не удалось оптимизировать аудиофайл');
    }
    
    return optimizedPath;
  } catch (error) {
    console.error(`[transcription-api] Ошибка при подготовке аудиофайла: ${error.message}`);
    // В случае ошибки, возвращаем исходный файл
    return audioPath;
  }
}

/**
 * Транскрипция аудио с использованием модели Whisper
 * @param {string} audioPath Путь к аудиофайлу
 * @param {Object} options Дополнительные опции
 * @returns {Promise<Object>} Результат транскрипции
 */
async function transcribeWithWhisper(audioPath, options = {}) {
  try {
    console.log(`[transcription-api] Транскрипция Whisper для файла: ${audioPath}`);
    
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Отсутствует ключ API OpenAI');
    }
    
    const {
      model = 'whisper-1',
      language = 'ru',
      prompt = 'Это русская речь. Транскрибируйте максимально точно.'
    } = options;
    
    // Оптимизируем аудио для Whisper (WAV часто работает лучше)
    const optimizedAudioPath = await prepareAudioFile(audioPath, {
      convertToMp3: true,
      normalize: true,
      sampleRate: 16000
    });
    
    // Создаем форму для запроса
    const formData = new FormData();
    formData.append('file', fs.createReadStream(optimizedAudioPath));
    formData.append('model', model);
    
    if (language) {
      formData.append('language', language);
    }
    
    if (prompt) {
      formData.append('prompt', prompt);
    }
    
    // Параметры запроса
    formData.append('response_format', 'verbose_json');
    
    // Отправляем запрос к API
    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...formData.getHeaders()
        },
        maxBodyLength: Infinity
      }
    );
    
    // Удаляем оптимизированный файл, если это не исходный файл
    if (optimizedAudioPath !== audioPath && fs.existsSync(optimizedAudioPath)) {
      fs.unlinkSync(optimizedAudioPath);
    }
    
    // Возвращаем текст и сегменты
    return {
      text: response.data.text,
      segments: response.data.segments,
      language: response.data.language,
      model: model
    };
  } catch (error) {
    console.error(`[transcription-api] Ошибка при транскрипции с Whisper: ${error.message}`);
    if (error.response) {
      console.error(`[transcription-api] Детали ошибки API: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Транскрипция аудио с использованием GPT-4o Audio Preview
 * @param {string} audioPath Путь к аудиофайлу
 * @param {Object} options Дополнительные опции
 * @returns {Promise<Object>} Результат транскрипции
 */
async function transcribeWithGPT4o(audioPath, options = {}) {
  try {
    const {
      model = 'gpt-4o',
      language = 'ru',
      prompt = 'Пожалуйста, сделайте транскрипцию этого аудио. Это русская речь.'
    } = options;
    
    console.log(`[transcription-api] Транскрипция с моделью ${model} для файла: ${audioPath}`);
    
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Отсутствует ключ API OpenAI');
    }
    
    // Определяем модель
    const apiModel = model.includes('mini') ? 'gpt-4o-mini' : 'gpt-4o';
    
    // Оптимизируем аудио для GPT-4o
    const optimizedAudioPath = await prepareAudioFile(audioPath, {
      convertToMp3: true,
      normalize: true
    });
    
    // Чтение файла и кодирование в base64
    const audioData = fs.readFileSync(optimizedAudioPath);
    const base64Audio = audioData.toString('base64');
    
    // Запрос к API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: apiModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'input_audio',
                input_audio: `data:audio/mp3;base64,${base64Audio}`
              }
            ]
          }
        ],
        temperature: 0,
        max_tokens: 4096
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    
    // Удаляем оптимизированный файл, если это не исходный файл
    if (optimizedAudioPath !== audioPath && fs.existsSync(optimizedAudioPath)) {
      fs.unlinkSync(optimizedAudioPath);
    }
    
    // Получаем текст
    const transcription = response.data.choices[0].message.content;
    
    return {
      text: transcription,
      model: apiModel
    };
  } catch (error) {
    console.error(`[transcription-api] Ошибка при транскрипции с GPT-4o: ${error.message}`);
    if (error.response) {
      console.error(`[transcription-api] Детали ошибки API: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Основная функция для транскрипции аудио с выбором модели
 * @param {string} audioPath Путь к аудиофайлу
 * @param {Object} options Дополнительные опции
 * @returns {Promise<Object>} Результат транскрипции
 */
export async function transcribeAudio(audioPath, options = {}) {
  const { model = 'whisper-1' } = options;
  
  console.log(`[transcription-api] Запрос на транскрипцию с моделью ${model}`);
  
  try {
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Файл не найден: ${audioPath}`);
    }
    
    // Выбираем нужную функцию в зависимости от модели
    if (model === 'whisper-1') {
      return await transcribeWithWhisper(audioPath, options);
    } else if (model.includes('gpt-4o')) {
      if (model === 'gpt-4o-mini-transcribe') {
        return await transcribeWithGPT4o(audioPath, { ...options, model: 'gpt-4o-mini' });
      } else {
        return await transcribeWithGPT4o(audioPath, options);
      }
    } else {
      throw new Error(`Неподдерживаемая модель: ${model}`);
    }
  } catch (error) {
    console.error(`[transcription-api] Ошибка при транскрипции: ${error.message}`);
    throw error;
  }
}

export {
  transcribeWithWhisper,
  transcribeWithGPT4o,
  prepareAudioFile
};