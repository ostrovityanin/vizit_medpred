/**
 * Сравнительный тест моделей транскрипции
 * 
 * Этот скрипт тестирует и сравнивает результаты транскрипции с разными моделями:
 * - whisper-1 (базовая модель)
 * - gpt-4o-transcribe (более точная модель)
 * - gpt-4o-mini-transcribe (более быстрая модель)
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import dotenv from 'dotenv';

// Загрузка переменных окружения
dotenv.config();

// Проверка наличия API ключа OpenAI
function hasOpenAIKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('🔴 OPENAI_API_KEY не установлен в переменных окружения');
    return false;
  }
  return true;
}

/**
 * Прогоняет файл через все три модели транскрипции и сравнивает результаты
 * @param {string} audioFilePath Путь к аудиофайлу для транскрипции
 */
async function compareTranscriptionModels(audioFilePath) {
  console.log(`🔄 Сравнение моделей транскрипции для файла: ${audioFilePath}`);
  
  // Проверяем файл
  if (!fs.existsSync(audioFilePath)) {
    console.error(`🔴 Файл не существует: ${audioFilePath}`);
    return;
  }
  
  // Модели для сравнения
  const models = [
    'whisper-1',
    'gpt-4o-transcribe',
    'gpt-4o-mini-transcribe'
  ];
  
  for (const model of models) {
    console.log(`\n🎯 Тестирование модели: ${model}`);
    
    try {
      const startTime = Date.now();
      const result = await transcribeWithModel(audioFilePath, model);
      const elapsedTime = (Date.now() - startTime) / 1000;
      
      if (result) {
        console.log(`✅ Результат (${elapsedTime.toFixed(2)}с): "${result}"`);
      } else {
        console.log(`❌ Транскрипция не удалась для модели ${model}`);
      }
    } catch (error) {
      console.error(`🔴 Ошибка при транскрипции с моделью ${model}: ${error.message}`);
    }
  }
}

/**
 * Транскрибирует аудиофайл с использованием указанной модели
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {string} model Модель для транскрипции
 * @returns {Promise<string|null>} Результат транскрипции или null в случае ошибки
 */
async function transcribeWithModel(audioFilePath, model) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('🔴 API ключ OpenAI не установлен');
    return null;
  }
  
  try {
    // Создаем FormData для отправки файла
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model', model);
    formData.append('language', 'ru'); // Опционально указываем язык
    
    // Отправляем запрос
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`🔴 Ошибка API (${response.status}): ${errorText}`);
      return null;
    }
    
    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error(`🔴 Ошибка при транскрипции: ${error.message}`);
    return null;
  }
}

/**
 * Основная функция
 */
async function main() {
  console.log('🚀 Запуск сравнительного теста моделей транскрипции');
  
  if (!hasOpenAIKey()) {
    console.error('🔴 Невозможно выполнить тесты без API ключа OpenAI');
    return;
  }
  
  // Тестируем разные аудиофайлы, если они существуют
  const testFiles = [
    './test_audio/test_ru.mp3',
    './test_audio/test_ru.wav',
    './test_audio/privet.mp3'
  ];
  
  for (const file of testFiles) {
    if (fs.existsSync(file)) {
      await compareTranscriptionModels(file);
    } else {
      console.log(`⚠️ Файл не найден, пропускаем: ${file}`);
    }
  }
  
  console.log('\n🏁 Сравнительный тест моделей завершен');
}

// Запуск основной функции
main().catch(error => {
  console.error(`🔴 Необработанная ошибка: ${error.message}`);
});