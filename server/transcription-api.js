/**
 * API для транскрипции аудио с использованием различных моделей
 * 
 * Этот модуль обеспечивает унифицированный интерфейс для транскрипции
 * аудиофайлов с использованием различных моделей OpenAI (whisper, gpt-4o, gpt-4o-mini)
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Получаем путь к текущей директории (для ES модулей)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);

// Импортируем переменные окружения
dotenv.config();

// Ключ API OpenAI
const API_KEY = process.env.OPENAI_API_KEY;

// URLs для API
const OPENAI_API_URL = 'https://api.openai.com/v1';
const AUDIO_API_URL = `${OPENAI_API_URL}/audio/transcriptions`;
const CHAT_API_URL = `${OPENAI_API_URL}/chat/completions`;

/**
 * Конвертирует аудиофайл в формат MP3 для лучшей совместимости с API
 * @param {string} inputPath Путь к исходному аудиофайлу
 * @returns {Promise<string>} Путь к конвертированному файлу или исходному, если уже MP3
 */
async function convertToMp3(inputPath) {
  try {
    // Если файл уже в формате MP3, просто возвращаем путь
    if (path.extname(inputPath).toLowerCase() === '.mp3') {
      return inputPath;
    }
    
    const outputPath = `${inputPath.substring(0, inputPath.lastIndexOf('.'))}.mp3`;
    
    console.log(`Converting ${inputPath} to MP3 format: ${outputPath}`);
    
    // Используем FFmpeg для конвертации в MP3 формат
    await execAsync(`ffmpeg -y -i "${inputPath}" -ar 16000 -ac 1 -c:a libmp3lame -b:a 32k "${outputPath}"`);
    
    console.log(`File converted to MP3: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`Error converting to MP3: ${error.message}`);
    // В случае ошибки возвращаем исходный путь
    return inputPath;
  }
}

/**
 * Кодирует аудиофайл в Base64
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {string|null} Закодированные данные или null в случае ошибки
 */
function encodeAudioToBase64(audioFilePath) {
  try {
    // Проверяем существование файла
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`File not found: ${audioFilePath}`);
    }
    
    // Читаем и кодируем файл
    const audioData = fs.readFileSync(audioFilePath);
    return audioData.toString('base64');
  } catch (error) {
    console.error(`Error encoding audio to Base64: ${error.message}`);
    return null;
  }
}

/**
 * Получает формат файла на основе расширения
 * @param {string} filePath Путь к файлу
 * @returns {string} Формат файла (mp3, wav, и т.д.)
 */
function getAudioFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ext.startsWith('.') ? ext.substring(1) : ext;
}

/**
 * Транскрибирует аудиофайл с использованием Whisper API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {string} language Код языка (ru, en и т.д.), необязательно
 * @returns {Promise<object>} Результат транскрипции
 */
async function transcribeWithWhisper(audioFilePath, language = null) {
  try {
    console.log(`Transcribing with Whisper API: ${audioFilePath}`);
    
    // Проверяем ключ API
    if (!API_KEY) {
      throw new Error('OpenAI API key is not set. Please set OPENAI_API_KEY environment variable.');
    }
    
    // Замеряем время выполнения
    const startTime = Date.now();
    
    // Создаем FormData для отправки файла
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model', 'whisper-1');
    
    // Добавляем язык, если указан
    if (language) {
      formData.append('language', language);
    }
    
    // Отправляем запрос
    const response = await axios.post(AUDIO_API_URL, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${API_KEY}`
      }
    });
    
    // Рассчитываем время выполнения
    const processingTime = Date.now() - startTime;
    
    // Получаем метаданные аудио
    const audioDuration = await getAudioDuration(audioFilePath);
    
    return {
      text: response.data.text,
      duration: audioDuration,
      processingTime,
      model: 'whisper-1'
    };
  } catch (error) {
    console.error(`Error transcribing with Whisper API: ${error.message}`);
    
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    
    throw error;
  }
}

/**
 * Транскрибирует аудиофайл с использованием GPT-4o через Chat API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {string} modelName Название модели (gpt-4o, gpt-4o-mini)
 * @param {string} language Код языка (ru, en и т.д.), необязательно
 * @returns {Promise<object>} Результат транскрипции
 */
async function transcribeWithGPT4o(audioFilePath, modelName = 'gpt-4o', language = null) {
  try {
    console.log(`Transcribing with ${modelName} Chat API: ${audioFilePath}`);
    
    // Проверяем ключ API
    if (!API_KEY) {
      throw new Error('OpenAI API key is not set. Please set OPENAI_API_KEY environment variable.');
    }
    
    // Конвертируем в MP3, если файл не в этом формате
    const mp3FilePath = await convertToMp3(audioFilePath);
    
    // Кодируем файл в Base64
    const audioBase64 = encodeAudioToBase64(mp3FilePath);
    if (!audioBase64) {
      throw new Error('Failed to encode audio file to Base64');
    }
    
    // Получаем формат аудио
    const audioFormat = getAudioFormat(mp3FilePath);
    
    // Замеряем время выполнения
    const startTime = Date.now();
    
    // Формируем системное сообщение с инструкцией для транскрипции
    let systemMessage = "Transcribe the audio file accurately. Output only the transcription, without any additional text.";
    
    // Добавляем указание языка, если указан
    if (language) {
      systemMessage += ` The audio is in ${language} language.`;
    }
    
    // Формируем запрос к API
    const requestData = {
      model: modelName === 'gpt-4o-mini' ? 'gpt-4o-mini' : 'gpt-4o',
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              input_audio: {
                format: audioFormat,
                data: audioBase64
              }
            }
          ]
        }
      ]
    };
    
    // Отправляем запрос
    const response = await axios.post(CHAT_API_URL, requestData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      }
    });
    
    // Рассчитываем время выполнения
    const processingTime = Date.now() - startTime;
    
    // Получаем метаданные аудио
    const audioDuration = await getAudioDuration(audioFilePath);
    
    // Удаляем временный MP3-файл, если он был создан
    if (mp3FilePath !== audioFilePath && fs.existsSync(mp3FilePath)) {
      fs.unlinkSync(mp3FilePath);
    }
    
    // Извлекаем транскрипцию из ответа
    const transcription = response.data.choices[0].message.content;
    
    return {
      text: transcription,
      duration: audioDuration,
      processingTime,
      model: modelName
    };
  } catch (error) {
    console.error(`Error transcribing with ${modelName} Chat API: ${error.message}`);
    
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    
    throw error;
  }
}

/**
 * Получает длительность аудиофайла в секундах
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {Promise<number>} Длительность в секундах
 */
async function getAudioDuration(audioFilePath) {
  try {
    // Используем ffprobe для получения информации о длительности
    const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioFilePath}"`;
    
    const { stdout } = await execAsync(command);
    return parseFloat(stdout.trim());
  } catch (error) {
    console.error(`Error getting audio duration: ${error.message}`);
    return 0;
  }
}

/**
 * Единый метод для транскрипции аудио с выбором модели
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {string} model Модель для транскрипции
 * @param {string} language Код языка (ru, en и т.д.), необязательно
 * @returns {Promise<object>} Результат транскрипции
 */
async function transcribeAudio(audioFilePath, model = 'whisper-1', language = null) {
  // Проверяем существование файла
  if (!fs.existsSync(audioFilePath)) {
    throw new Error(`Audio file not found: ${audioFilePath}`);
  }
  
  // Выбираем метод транскрипции в зависимости от модели
  switch (model) {
    case 'whisper-1':
      return await transcribeWithWhisper(audioFilePath, language);
    
    case 'gpt-4o-transcribe':
      return await transcribeWithGPT4o(audioFilePath, 'gpt-4o', language);
    
    case 'gpt-4o-mini-transcribe':
      return await transcribeWithGPT4o(audioFilePath, 'gpt-4o-mini', language);
    
    default:
      throw new Error(`Unknown transcription model: ${model}`);
  }
}

/**
 * Получает список доступных моделей для транскрипции
 * @returns {array} Список моделей
 */
function getAvailableModels() {
  return [
    {
      id: 'whisper-1',
      name: 'Whisper',
      description: 'OpenAI Whisper model, оптимизирована для транскрипции речи',
      apiType: 'audio'
    },
    {
      id: 'gpt-4o-mini-transcribe',
      name: 'GPT-4o Mini Transcribe',
      description: 'Облегченная GPT-4o модель с возможностью транскрипции',
      apiType: 'chat'
    },
    {
      id: 'gpt-4o-transcribe',
      name: 'GPT-4o Transcribe',
      description: 'Полная GPT-4o модель с возможностью транскрипции',
      apiType: 'chat'
    }
  ];
}

export {
  transcribeAudio,
  transcribeWithWhisper,
  transcribeWithGPT4o,
  convertToMp3,
  encodeAudioToBase64,
  getAvailableModels
};