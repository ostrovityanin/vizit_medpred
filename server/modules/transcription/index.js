/**
 * Модуль транскрипции аудио
 * 
 * Отвечает за преобразование аудио в текст с использованием
 * различных моделей транскрипции и оптимизации для русского языка.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { log } from '../../vite';
import { transcribeAudio, transcribeWithModel } from '../../openai';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Транскрибирует аудиофайл с использованием указанной модели
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Опции транскрипции
 * @returns {Promise<Object>} Результат транскрипции
 */
export async function transcribe(audioFilePath, options = {}) {
  try {
    const { 
      model = 'whisper-1', 
      language = 'ru',
      speakerIndex = null,
      prompt = ''
    } = options;
    
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Аудиофайл не существует: ${audioFilePath}`);
    }
    
    // Создаем специфичный промпт для модели с учетом индекса говорящего
    let effectivePrompt = prompt;
    
    if (language === 'ru') {
      // Базовый промпт для русского языка
      if (!effectivePrompt) {
        effectivePrompt = 'Распознай речь на русском языке';
      }
      
      // Если указан индекс говорящего, добавляем его в промпт
      if (speakerIndex !== null) {
        effectivePrompt += `. Этот фрагмент произносит Говорящий ${speakerIndex + 1}`;
      }
    }
    
    log(`Транскрипция файла: ${audioFilePath} с моделью ${model}`, 'transcription');
    log(`Язык: ${language}, Промпт: ${effectivePrompt}`, 'transcription');
    
    // Засекаем время
    const startTime = Date.now();
    
    // Выбираем метод транскрипции
    let result;
    if (model === 'whisper-1' || model === 'default') {
      result = await transcribeAudio(audioFilePath, language, effectivePrompt);
    } else {
      result = await transcribeWithModel(audioFilePath, model, { language, prompt: effectivePrompt });
    }
    
    // Рассчитываем время обработки
    const processingTime = (Date.now() - startTime) / 1000; // в секундах
    
    // Пост-обработка текста
    let processedText = result.text || '';
    
    // Обработка результата для удаления повторений промпта и специальных маркеров
    processedText = cleanTranscriptionOutput(processedText, effectivePrompt);
    
    // Добавляем индекс говорящего, если нужно, и его еще нет в тексте
    if (speakerIndex !== null && !processedText.includes('[Говорящий')) {
      // Проверка на пустоту или шум
      if (!processedText || 
          processedText.toLowerCase().includes('[тишина]') || 
          processedText.toLowerCase().includes('[шум]') ||
          processedText.includes('запись без распознаваемой речи')) {
        // Не добавляем метку говорящего для шума или тишины
      } else {
        // Добавляем метку говорящего только если это осмысленный текст
        processedText = `[Говорящий ${speakerIndex + 1}]: ${processedText}`;
      }
    }
    
    return {
      text: processedText,
      model,
      language,
      processingTime,
      tokensProcessed: result.tokensProcessed || 0,
      cost: result.cost || 0
    };
  } catch (error) {
    log(`Ошибка при транскрипции: ${error}`, 'transcription');
    throw error;
  }
}

/**
 * Очищает результат транскрипции от повторений промпта и специальных маркеров
 * @param {string} text Текст транскрипции
 * @param {string} prompt Использованный промпт
 * @returns {string} Очищенный текст
 */
function cleanTranscriptionOutput(text, prompt) {
  if (!text) return '';
  
  let cleanedText = text;
  
  // Удаляем промпт, если он повторяется в начале текста
  if (prompt && cleanedText.toLowerCase().startsWith(prompt.toLowerCase())) {
    cleanedText = cleanedText.substring(prompt.length).trim();
  }
  
  // Удаляем фразы вида "Говорящий 1:" если они повторяются
  const speakerRegex = /^(говорящий \d+:?\s*)+/i;
  cleanedText = cleanedText.replace(speakerRegex, '');
  
  // Проверяем, является ли текст пустым или содержит только шум/тишину
  const lowerText = cleanedText.toLowerCase();
  if (lowerText.includes('нет речи') || 
      lowerText.includes('нет аудио') || 
      lowerText.includes('тишина') || 
      lowerText.includes('шум') || 
      lowerText.includes('без речи')) {
    
    // Стандартизируем метки шума и тишины
    if (lowerText.includes('тишина')) {
      return '[Тишина]';
    } else if (lowerText.includes('шум')) {
      return '[Шум]';
    } else {
      return '[Запись без распознаваемой речи]';
    }
  }
  
  return cleanedText;
}

/**
 * Сравнивает результаты транскрипции разных моделей
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Опции сравнения
 * @returns {Promise<Object>} Результаты сравнения
 */
export async function compareTranscriptionModels(audioFilePath, options = {}) {
  try {
    const { 
      language = 'ru',
      speakerIndex = null,
      models = ['whisper-1', 'gpt-4o-mini-transcribe', 'gpt-4o-transcribe']
    } = options;
    
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Аудиофайл не существует: ${audioFilePath}`);
    }
    
    log(`Сравнение моделей транскрипции для файла: ${audioFilePath}`, 'transcription');
    log(`Язык: ${language}, Количество моделей: ${models.length}`, 'transcription');
    
    // Результаты для каждой модели
    const results = {};
    
    // Запускаем транскрипцию для каждой модели
    for (const model of models) {
      try {
        const result = await transcribe(audioFilePath, { 
          model, 
          language,
          speakerIndex 
        });
        
        results[model] = result;
        
        log(`Модель ${model} выполнила транскрипцию за ${result.processingTime.toFixed(2)} сек`, 'transcription');
      } catch (modelError) {
        log(`Ошибка транскрипции с моделью ${model}: ${modelError}`, 'transcription');
        results[model] = { 
          error: modelError.message,
          model 
        };
      }
    }
    
    return results;
  } catch (error) {
    log(`Ошибка при сравнении моделей транскрипции: ${error}`, 'transcription');
    throw error;
  }
}

export default {
  transcribe,
  compareTranscriptionModels
};