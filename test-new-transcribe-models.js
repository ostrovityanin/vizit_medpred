/**
 * Тест новых моделей транскрипции OpenAI
 * 
 * Этот скрипт проверяет работу новых специализированных моделей транскрипции:
 * - gpt-4o-transcribe     - более качественная транскрипция
 * - gpt-4o-mini-transcribe - более быстрая транскрипция
 * 
 * Оба API используют endpoint /v1/audio/transcriptions для транскрипции.
 */

import fs from 'fs';
import path from 'path';
import { FormData, File } from 'formdata-node';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Загрузка переменных окружения
dotenv.config();

// API ключ OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Транскрипция аудиофайла с помощью указанной модели
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {string} model Модель для транскрипции ('gpt-4o-transcribe', 'gpt-4o-mini-transcribe' или 'whisper-1')
 * @param {Object} options Дополнительные опции
 * @returns {Promise<Object>} Результат транскрипции
 */
async function transcribeAudio(audioFilePath, model = 'whisper-1', options = {}) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY не установлен в переменных окружения');
  }
  
  if (!fs.existsSync(audioFilePath)) {
    throw new Error(`Файл не найден: ${audioFilePath}`);
  }
  
  // Диагностика файла
  const stats = fs.statSync(audioFilePath);
  console.log(`📄 Файл: ${audioFilePath}`);
  console.log(`   Размер: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`   Модификация: ${stats.mtime}`);
  
  // Проверка модели
  const validModels = ['whisper-1', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe'];
  if (!validModels.includes(model)) {
    throw new Error(`Неподдерживаемая модель: ${model}. Допустимые значения: ${validModels.join(', ')}`);
  }
  
  try {
    // Настройки запроса
    const fileBuffer = fs.readFileSync(audioFilePath);
    const fileBasename = path.basename(audioFilePath);
    const fileExt = path.extname(audioFilePath).slice(1).toLowerCase();
    const fileType = `audio/${fileExt === 'wav' ? 'wav' : 'mpeg'}`;
    
    console.log(`🎵 Тип файла: ${fileType}`);
    
    // Создание объекта File и FormData
    const file = new File([fileBuffer], fileBasename, { type: fileType });
    const formData = new FormData();
    
    // Добавление параметров
    formData.append('file', file);
    formData.append('model', model);
    
    // Опциональные параметры
    if (options.language) {
      formData.append('language', options.language);
    }
    
    if (options.prompt) {
      formData.append('prompt', options.prompt);
    }
    
    // Отправка запроса в API
    console.log(`🔄 Отправка запроса на транскрипцию с моделью ${model}...`);
    const startTime = Date.now();
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: formData
    });
    
    const elapsedTime = (Date.now() - startTime) / 1000;
    console.log(`⏱️ Время ответа: ${elapsedTime.toFixed(2)} секунд`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Ошибка API (${response.status}): ${errorText}`);
      throw new Error(`Ошибка API: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    return {
      text: data.text,
      processingTime: elapsedTime,
      model
    };
  } catch (error) {
    console.error(`❌ Ошибка при транскрипции: ${error.message}`);
    throw error;
  }
}

/**
 * Сравнение всех моделей на одном файле
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Дополнительные опции
 */
async function compareAllModels(audioFilePath, options = {}) {
  console.log(`\n🔍 Сравнение всех моделей на файле: ${audioFilePath}`);
  
  const models = ['whisper-1', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe'];
  const results = {};
  
  for (const model of models) {
    try {
      console.log(`\n🎯 Модель: ${model}`);
      const result = await transcribeAudio(audioFilePath, model, options);
      
      console.log(`✓ Транскрипция: "${result.text}"`);
      
      results[model] = result;
    } catch (error) {
      console.error(`❌ Не удалось выполнить транскрипцию с моделью ${model}: ${error.message}`);
      results[model] = { error: error.message, model };
    }
  }
  
  // Сводная таблица результатов
  console.log('\n📊 Сводка результатов:');
  console.log('┌────────────────────────┬─────────────┬────────────────────────────────────────────────────────────┐');
  console.log('│ Модель                 │ Время (сек) │ Результат                                                  │');
  console.log('├────────────────────────┼─────────────┼────────────────────────────────────────────────────────────┤');
  
  for (const [model, result] of Object.entries(results)) {
    const time = result.processingTime ? result.processingTime.toFixed(2) : 'N/A';
    const text = result.text ? result.text.substring(0, 50) + (result.text.length > 50 ? '...' : '') : result.error || 'Ошибка';
    const modelPadded = model.padEnd(22);
    const timePadded = time.padStart(11);
    console.log(`│ ${modelPadded} │ ${timePadded} │ ${text.padEnd(60)} │`);
  }
  
  console.log('└────────────────────────┴─────────────┴────────────────────────────────────────────────────────────┘');
  
  return results;
}

/**
 * Основная функция
 */
async function main() {
  console.log('🚀 Запуск теста новых моделей транскрипции OpenAI');
  
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY не установлен. Невозможно продолжить тестирование.');
    return;
  }
  
  // Опции тестирования
  const options = {
    language: 'ru'
  };
  
  // Список тестовых файлов
  const testFiles = [
    './test_audio/test_ru.mp3',
    './test_audio/test_ru.wav',
    './test_audio/privet.mp3'
  ];
  
  // Проверяем наличие файлов
  const existingFiles = testFiles.filter(file => fs.existsSync(file));
  
  if (existingFiles.length === 0) {
    console.error('❌ Ни один из тестовых файлов не найден. Невозможно продолжить тестирование.');
    return;
  }
  
  // Тестируем каждый найденный файл
  for (const file of existingFiles) {
    await compareAllModels(file, options);
  }
  
  console.log('\n✅ Тестирование завершено.');
}

// Запуск программы
main().catch(error => {
  console.error(`❌ Необработанная ошибка: ${error.message}`);
  process.exit(1);
});