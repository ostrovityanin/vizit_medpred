/**
 * Клиент для работы с GPT-4o Audio API
 */

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { logInfo, logError, logWarning, logDebug } from './logger.js';

/**
 * Проверяет, настроен ли API ключ OpenAI
 * @returns {boolean} Возвращает true, если API ключ настроен
 */
export function isOpenAIConfigured() {
  if (!process.env.OPENAI_API_KEY) {
    logWarning('OpenAI API ключ не настроен');
    return false;
  }
  return true;
}

/**
 * Кодирует аудиофайл в Base64
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {string} Строка в формате Base64
 */
export function encodeAudioToBase64(audioFilePath) {
  try {
    const audioBuffer = fs.readFileSync(audioFilePath);
    return audioBuffer.toString('base64');
  } catch (error) {
    logError(error, 'Ошибка при кодировании аудио в Base64');
    throw new Error(`Не удалось закодировать аудиофайл: ${error.message}`);
  }
}

/**
 * Форматирует текст транскрипции для улучшения читаемости
 * @param {string} text Исходный текст транскрипции
 * @returns {string} Отформатированный текст
 */
export function cleanText(text) {
  if (!text) return '';
  
  // Удаляем лишние пробелы и переносы строк
  let cleanedText = text.trim()
    .replace(/\s+/g, ' ')
    .replace(/(\r\n|\n|\r)/gm, ' ');
  
  // Добавляем точки в конце предложений, если их нет
  cleanedText = cleanedText.replace(/([а-яА-Яa-zA-Z0-9])\s+([А-ЯA-Z])/g, '$1. $2');
  
  // Разделяем текст на параграфы
  cleanedText = cleanedText.replace(/\.\s+/g, '.\n\n');
  
  return cleanedText;
}

/**
 * Извлекает диалог из текста транскрипции и форматирует его
 * @param {string} text Исходный текст транскрипции
 * @returns {string} Форматированный диалог
 */
export function parseDialogueFromText(text) {
  if (!text) return '';
  
  // Простая эвристика для разделения диалога
  const lines = text.split(/[\.\!\?]\s+/);
  let dialogue = '';
  let currentSpeaker = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Ищем маркеры смены говорящего (имена, "я", "говорящий" и т.д.)
    const speakerMatch = line.match(/^([A-ZА-Я][a-zа-я]+|Я):/i);
    
    if (speakerMatch) {
      // Явно указан говорящий
      currentSpeaker = speakerMatch[1];
      dialogue += `${currentSpeaker}: ${line.substring(speakerMatch[0].length).trim()}.\n\n`;
    } else {
      // Эвристика для определения смены говорящего
      const hasFirstPerson = line.match(/\b(я|меня|мне|мой|моя|моё|мои)\b/i);
      const hasQuestion = line.match(/\?$/);
      
      if (hasFirstPerson || hasQuestion) {
        // Вероятно, сменился говорящий
        currentSpeaker = currentSpeaker === 'Говорящий 1' ? 'Говорящий 2' : 'Говорящий 1';
      }
      
      if (!currentSpeaker) currentSpeaker = 'Говорящий 1';
      dialogue += `${currentSpeaker}: ${line}.\n\n`;
    }
  }
  
  return dialogue;
}

/**
 * Рассчитывает примерную стоимость транскрипции GPT-4o Audio
 * @param {number} durationSeconds Длительность аудио в секундах
 * @returns {string} Строка с информацией о стоимости
 */
export function calculateGPT4oTranscriptionCost(durationSeconds) {
  // Стоимость GPT-4o Audio: $15 за 1 млн токенов ввода, $75 за 1 млн токенов вывода
  // Аудио оценивается примерно в 50 токенов за секунду
  const inputTokens = Math.ceil(durationSeconds * 50);
  const outputTokens = Math.ceil(inputTokens * 0.5); // Примерная оценка
  
  const inputCost = (inputTokens / 1000000) * 15;
  const outputCost = (outputTokens / 1000000) * 75;
  const totalCost = inputCost + outputCost;
  
  return `Примерная стоимость: $${totalCost.toFixed(5)} (${inputTokens} входных токенов, ${outputTokens} выходных токенов)`;
}

/**
 * Отправляет аудиофайл в GPT-4o Audio Preview и получает транскрипцию
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {Object} Результат транскрипции с полями text, cost и tokensProcessed
 */
export async function transcribeWithGPT4o(audioFilePath) {
  if (!isOpenAIConfigured()) {
    throw new Error('OpenAI API ключ не настроен');
  }
  
  try {
    logInfo(`Начинаем транскрипцию файла: ${audioFilePath}`);
    const fileStats = fs.statSync(audioFilePath);
    const fileSizeMB = fileStats.size / (1024 * 1024);
    logDebug(`Размер файла: ${fileSizeMB.toFixed(2)} MB`);
    
    // Кодируем аудиофайл в base64
    const audioBase64 = encodeAudioToBase64(audioFilePath);
    
    // Определяем тип файла на основе расширения
    const fileExt = path.extname(audioFilePath).toLowerCase();
    let fileType;
    
    switch (fileExt) {
      case '.mp3':
        fileType = 'audio/mp3';
        break;
      case '.wav':
        fileType = 'audio/wav';
        break;
      case '.ogg':
        fileType = 'audio/ogg';
        break;
      case '.m4a':
        fileType = 'audio/mp4';
        break;
      case '.webm':
        fileType = 'audio/webm';
        break;
      default:
        fileType = 'audio/mpeg';
    }
    
    // Подготавливаем тело запроса
    const requestBody = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Транскрибируй это аудио на языке оригинала. Выдели говорящих, если это диалог.'
            },
            {
              type: 'input_audio',
              input_audio_data: {
                data: audioBase64,
                media_type: fileType
              }
            }
          ]
        }
      ],
      max_tokens: 4000
    };
    
    // Отправляем запрос к API
    logDebug('Отправляем запрос к OpenAI API');
    const startTime = Date.now();
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });
    
    const responseTime = Date.now() - startTime;
    logDebug(`Получен ответ от API за ${responseTime}ms`);
    
    if (!response.ok) {
      const error = await response.text();
      logError(new Error(error), `Ошибка API (${response.status})`);
      throw new Error(`Ошибка OpenAI API: ${response.status} ${error}`);
    }
    
    const data = await response.json();
    
    // Извлекаем текст из ответа
    const transcribedText = data.choices[0].message.content;
    
    // Рассчитываем использованные токены и стоимость
    const tokensProcessed = data.usage ? data.usage.total_tokens : 0;
    const durationSeconds = Math.ceil(fileSizeMB * 60); // Грубая оценка длительности
    const cost = calculateGPT4oTranscriptionCost(durationSeconds);
    
    logInfo(`Транскрипция завершена. Использовано ${tokensProcessed} токенов`);
    
    return {
      text: transcribedText,
      cost,
      tokensProcessed
    };
  } catch (error) {
    logError(error, 'Ошибка при транскрипции аудио с GPT-4o');
    throw error;
  }
}