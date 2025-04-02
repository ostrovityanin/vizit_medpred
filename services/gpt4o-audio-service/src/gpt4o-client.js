/**
 * Клиент для работы с GPT-4o Audio Preview API
 */

import fs from 'fs';
import path from 'path';
import { FormData, File } from 'formdata-node';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import logger from './logger.js';

// Загрузка переменных окружения
dotenv.config();

/**
 * Проверка наличия API ключа OpenAI
 * @returns {boolean} Результат проверки
 */
function hasOpenAIKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.error('OPENAI_API_KEY не установлен в переменных окружения');
    return false;
  }
  return true;
}

/**
 * Кодирование аудиофайла в Base64
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {string|null} Закодированные данные или null в случае ошибки
 */
function encodeAudioToBase64(audioFilePath) {
  try {
    logger.debug(`Кодирование файла ${audioFilePath} в Base64`);
    const audioBuffer = fs.readFileSync(audioFilePath);
    return audioBuffer.toString('base64');
  } catch (error) {
    logger.error(`Ошибка при чтении файла ${audioFilePath}: ${error.message}`);
    return null;
  }
}

/**
 * Определение формата аудиофайла по расширению
 * @param {string} filePath Путь к файлу
 * @returns {string} Формат аудио ('mp3', 'wav', etc.)
 */
function getAudioFormat(filePath) {
  const fileExt = path.extname(filePath).substring(1).toLowerCase();
  const supportedFormats = ['mp3', 'wav', 'm4a', 'webm', 'mp4', 'mpga', 'mpeg'];
  
  return supportedFormats.includes(fileExt) ? fileExt : 'wav';
}

/**
 * Расчет примерной стоимости транскрипции аудио с использованием GPT-4o
 * @param {number} durationSeconds Длительность аудио в секундах
 * @returns {string} Строка с примерной стоимостью
 */
function calculateTranscriptionCost(durationSeconds) {
  // Примерно 50 токенов на секунду аудио
  const estimatedTokens = durationSeconds * 50;
  
  // Стоимость GPT-4o Audio: $15 за 1 млн токенов ввода, $75 за 1 млн токенов вывода
  const inputCost = (estimatedTokens / 1000000) * 15;
  // Предполагаем, что выходные токены составляют около 25% от входных для транскрипции
  const outputCost = (estimatedTokens * 0.25 / 1000000) * 75;
  
  const totalCost = inputCost + outputCost;
  
  return `$${totalCost.toFixed(5)} (примерно ${estimatedTokens} токенов)`;
}

/**
 * Транскрипция аудио с использованием GPT-4o через chat/completions API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Дополнительные параметры
 * @returns {Promise<Object|null>} Результат транскрипции или null в случае ошибки
 */
async function transcribeWithChatAPI(audioFilePath, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.error('OPENAI_API_KEY не установлен в переменных окружения');
    return null;
  }

  const { prompt = 'Транскрибируй это аудио.', model = 'gpt-4o-audio-preview' } = options;

  try {
    logger.info(`Транскрипция через chat/completions API: ${audioFilePath}`);
    
    // Определяем формат файла
    const format = getAudioFormat(audioFilePath);
    
    // Кодируем аудиофайл в base64
    const audio_b64 = encodeAudioToBase64(audioFilePath);
    if (!audio_b64) {
      return null;
    }

    // Создаем структуру сообщения для отправки
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "input_audio", input_audio: { data: audio_b64, format } }
        ]
      }
    ];

    logger.debug(`Отправка запроса на транскрипцию с форматом: ${format}`);
    
    // Отправляем запрос к OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options.maxTokens || 4096
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error(`Ошибка API: ${JSON.stringify(errorData)}`);
      return null;
    }

    const data = await response.json();
    logger.debug(`Получен ответ от API: ${JSON.stringify(data)}`);
    
    return {
      text: data.choices[0]?.message?.content || 'Не удалось получить текст транскрипции',
      usage: data.usage,
      model: data.model
    };
  } catch (error) {
    logger.error(`Ошибка при вызове API: ${error.message}`);
    return null;
  }
}

/**
 * Транскрипция аудио с использованием OpenAI Audio API (/v1/audio/transcriptions)
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Дополнительные параметры
 * @returns {Promise<Object|null>} Результат транскрипции или null в случае ошибки
 */
async function transcribeWithAudioAPI(audioFilePath, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.error('OPENAI_API_KEY не установлен в переменных окружения');
    return null;
  }

  const { 
    prompt = '', 
    language = '', 
    model = 'whisper-1' 
  } = options;

  try {
    logger.info(`Транскрипция через Audio API: ${audioFilePath}`);
    
    if (!fs.existsSync(audioFilePath)) {
      logger.error(`Файл не найден: ${audioFilePath}`);
      return null;
    }
    
    // Чтение файла и создание объекта File
    const fileBuffer = fs.readFileSync(audioFilePath);
    const fileBasename = path.basename(audioFilePath);
    const fileType = 'audio/' + getAudioFormat(audioFilePath);
    
    const file = new File([fileBuffer], fileBasename, { type: fileType });
    
    // Создаем FormData для передачи аудиофайла
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', model);
    
    // Добавляем дополнительные параметры, если они указаны
    if (prompt) {
      formData.append('prompt', prompt);
    }
    
    if (language) {
      formData.append('language', language);
    }
    
    // Отправляем запрос к OpenAI Audio API
    const url = 'https://api.openai.com/v1/audio/transcriptions';
    logger.debug(`Отправка запроса на: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      let errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        logger.error(`Ошибка API: ${JSON.stringify(errorData)}`);
      } catch {
        logger.error(`Ошибка API: ${errorText}`);
      }
      return null;
    }

    const data = await response.json();
    logger.debug(`Получен ответ от API: ${JSON.stringify(data)}`);
    
    return {
      text: data.text || 'Не удалось получить текст транскрипции',
      model: model
    };
  } catch (error) {
    logger.error(`Ошибка при вызове API: ${error.message}`);
    return null;
  }
}

/**
 * Единая функция для транскрипции аудио, выбирающая наиболее подходящий API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Дополнительные параметры
 * @returns {Promise<Object|null>} Результат транскрипции или null в случае ошибки
 */
async function transcribeAudio(audioFilePath, options = {}) {
  logger.info(`Запуск транскрипции для файла: ${audioFilePath}`);
  
  if (!hasOpenAIKey()) {
    return {
      error: 'API ключ OpenAI не найден',
      success: false
    };
  }
  
  const { 
    preferredMethod = 'auto', 
    model = 'auto'
  } = options;
  
  const transcriptionOptions = { ...options };
  
  // Автоматический выбор модели и метода транскрипции
  if (model === 'auto') {
    transcriptionOptions.model = 'gpt-4o-audio-preview';
  }
  
  // Выбор метода транскрипции на основе предпочтений или автоматически
  if (preferredMethod === 'chat' || 
      (preferredMethod === 'auto' && 
       (transcriptionOptions.model.includes('gpt-4o') || transcriptionOptions.model.includes('gpt-4')))) {
    logger.info(`Используем метод chat/completions с моделью ${transcriptionOptions.model}`);
    return transcribeWithChatAPI(audioFilePath, transcriptionOptions);
  } else {
    if (model === 'auto') {
      transcriptionOptions.model = 'whisper-1';
    }
    logger.info(`Используем метод audio/transcriptions с моделью ${transcriptionOptions.model}`);
    return transcribeWithAudioAPI(audioFilePath, transcriptionOptions);
  }
}

export default {
  hasOpenAIKey,
  encodeAudioToBase64,
  getAudioFormat,
  transcribeWithChatAPI,
  transcribeWithAudioAPI,
  transcribeAudio,
  calculateTranscriptionCost
};