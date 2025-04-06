/**
 * Модуль для работы с OpenAI API
 * 
 * Этот модуль предоставляет функции для транскрипции аудио с использованием разных моделей OpenAI:
 * - whisper-1 (через Audio API)
 * - gpt-4o (через Chat API с поддержкой аудио)
 * - gpt-4o-mini (через Chat API с поддержкой аудио)
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { AxiosError } from 'axios';

const exec = promisify(execCallback);

// Тип для ошибок API запросов
interface ApiError {
  response?: {
    data?: any;
  };
  message?: string;
}

// Пути для временных файлов
const TEMP_DIR = path.join(process.cwd(), 'temp');

// Создаем временную директорию, если она не существует
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Конвертирует аудиофайл в MP3 формат
 * @param {string} inputPath Путь к исходному файлу
 * @returns {Promise<string>} Путь к конвертированному файлу
 */
async function convertToMp3(inputPath: string): Promise<string> {
  const outputPath = path.join(TEMP_DIR, `${uuidv4()}.mp3`);
  
  try {
    // Оптимизация аудио для транскрипции:
    // - Конвертируем в MP3 формат (стандарт для сервисов транскрипции)
    // - Используем моно канал (достаточно для транскрипции речи)
    // - Устанавливаем частоту дискретизации 16 кГц (оптимально для моделей распознавания речи)
    // - Устанавливаем битрейт 32 кбит/с (достаточно для качественной транскрипции)
    await exec(`ffmpeg -i "${inputPath}" -ac 1 -ar 16000 -b:a 32k "${outputPath}"`);
    
    return outputPath;
  } catch (error: any) {
    console.error('Ошибка при конвертации аудиофайла в MP3:', error);
    throw new Error('Не удалось конвертировать аудиофайл в MP3 формат');
  }
}

/**
 * Транскрибирует аудиофайл с использованием Whisper API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Дополнительные опции
 * @returns {Promise<string>} Результат транскрипции
 */
export async function transcribeWithWhisper(audioFilePath: string, options: any = {}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('API ключ OpenAI не найден. Установите переменную окружения OPENAI_API_KEY.');
  }
  
  try {
    // Конвертируем аудиофайл в MP3 формат, если это необходимо
    let fileToTranscribe = audioFilePath;
    
    const audioFormat = path.extname(audioFilePath).toLowerCase();
    if (audioFormat !== '.mp3') {
      console.log(`Конвертируем аудиофайл из ${audioFormat} в MP3...`);
      fileToTranscribe = await convertToMp3(audioFilePath);
    }
    
    // Создаем Form Data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(fileToTranscribe));
    formData.append('model', 'whisper-1');
    
    // Добавляем дополнительные параметры, если они предоставлены
    if (options.language) {
      formData.append('language', options.language);
    }
    
    if (options.prompt) {
      formData.append('prompt', options.prompt);
    }
    
    // Отправляем запрос к API
    const startTime = Date.now();
    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    const endTime = Date.now();
    
    console.log(`Время транскрипции Whisper: ${(endTime - startTime) / 1000} секунд`);
    
    // Проверяем случай, когда временный файл был создан
    if (fileToTranscribe !== audioFilePath) {
      fs.unlinkSync(fileToTranscribe);
    }
    
    return response.data.text;
  } catch (error: ApiError | any) {
    console.error('Ошибка при транскрипции аудио с Whisper API:', error.response?.data || error.message);
    throw new Error('Не удалось выполнить транскрипцию с помощью Whisper API');
  }
}

/**
 * Кодирует аудиофайл в формат Base64
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {string} Закодированный аудиофайл
 */
function encodeAudioToBase64(audioFilePath: string): string {
  try {
    const audioData = fs.readFileSync(audioFilePath);
    return audioData.toString('base64');
  } catch (error: any) {
    console.error('Ошибка при кодировании аудиофайла в Base64:', error);
    throw new Error('Не удалось закодировать аудиофайл в Base64');
  }
}

/**
 * Транскрибирует аудиофайл с использованием GPT-4o Audio API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {string} model Модель для транскрипции ('gpt-4o-mini' или 'gpt-4o')
 * @param {Object} options Дополнительные опции
 * @returns {Promise<string>} Результат транскрипции
 */
export async function transcribeWithGPT4o(audioFilePath: string, model = 'gpt-4o', options: any = {}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('API ключ OpenAI не найден. Установите переменную окружения OPENAI_API_KEY.');
  }
  
  try {
    // Конвертируем аудиофайл в MP3 формат, если это необходимо
    let fileToTranscribe = audioFilePath;
    
    const audioFormat = path.extname(audioFilePath).toLowerCase();
    if (audioFormat !== '.mp3') {
      console.log(`Конвертируем аудиофайл из ${audioFormat} в MP3...`);
      fileToTranscribe = await convertToMp3(audioFilePath);
    }
    
    // Кодируем аудиофайл в Base64
    const audioBase64 = encodeAudioToBase64(fileToTranscribe);
    
    // Создаем запрос к Chat API для транскрипции
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: options.prompt || 'Пожалуйста, дословно транскрибируй это аудио.'
          },
          {
            type: 'audio',
            audio_data: `data:audio/mp3;base64,${audioBase64}`
          }
        ]
      }
    ];
    
    // Отправляем запрос к API
    const startTime = Date.now();
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: model,
        messages,
        temperature: 0,
        max_tokens: 4096,
        language: options.language || 'ru'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    const endTime = Date.now();
    
    console.log(`Время транскрипции ${model}: ${(endTime - startTime) / 1000} секунд`);
    
    // Проверяем случай, когда временный файл был создан
    if (fileToTranscribe !== audioFilePath) {
      fs.unlinkSync(fileToTranscribe);
    }
    
    // Извлекаем транскрипцию из ответа
    const transcription = response.data.choices[0]?.message?.content || '';
    return transcription;
  } catch (error: ApiError | any) {
    console.error(`Ошибка при транскрипции аудио с ${model}:`, error.response?.data || error.message);
    throw new Error(`Не удалось выполнить транскрипцию с помощью ${model}`);
  }
}

/**
 * Транскрибирует аудиофайл с использованием указанной модели
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {string} model Модель для транскрипции ('whisper-1', 'gpt-4o-mini-transcribe', 'gpt-4o-transcribe')
 * @param {Object} options Дополнительные опции
 * @returns {Promise<string>} Результат транскрипции
 */
export async function transcribeWithModel(audioFilePath: string, model: string, options: any = {}): Promise<string> {
  switch (model) {
    case 'whisper-1':
      return transcribeWithWhisper(audioFilePath, options);
    case 'gpt-4o-mini-transcribe':
      return transcribeWithGPT4o(audioFilePath, 'gpt-4o-mini', options);
    case 'gpt-4o-transcribe':
      return transcribeWithGPT4o(audioFilePath, 'gpt-4o', options);
    default:
      throw new Error(`Неизвестная модель транскрипции: ${model}`);
  }
}