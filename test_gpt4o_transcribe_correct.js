/**
 * Тест транскрипции с использованием новых моделей GPT-4o через audio/transcriptions API
 * 
 * Этот скрипт тестирует модели gpt-4o-transcribe и gpt-4o-mini-transcribe
 * через правильный формат запроса к API /v1/audio/transcriptions
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import dotenv from 'dotenv';

dotenv.config();

// Тестируемый аудиофайл
const audioFile = './temp/sample_converted.mp3';

// Список моделей для тестирования
const models = [
  'whisper-1', // Для сравнения
  'gpt-4o-transcribe',
  'gpt-4o-mini-transcribe'
];

/**
 * Транскрипция аудио с использованием Audio API
 */
async function transcribeWithAudioAPI(audioFilePath, model) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY не найден в переменных окружения');
  }

  if (!fs.existsSync(audioFilePath)) {
    throw new Error(`Файл не существует: ${audioFilePath}`);
  }

  try {
    console.log(`Транскрибирование файла через Audio API с моделью ${model}: ${audioFilePath}`);
    
    // Создаем объект FormData для мультичастного запроса
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model', model);
    formData.append('language', 'ru'); // можно указать язык или оставить пустым для автодетекции
    
    console.log('Отправка запроса к Audio API...');
    const startTime = Date.now();
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка API OpenAI: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    const result = await response.json();
    const endTime = Date.now();
    const elapsedTime = (endTime - startTime) / 1000; // в секундах
    
    console.log(`Запрос выполнен за ${elapsedTime.toFixed(2)} секунд`);
    
    return {
      text: result.text,
      elapsedTime,
      model
    };
  } catch (error) {
    console.error(`Ошибка при транскрибировании аудио: ${error.message}`);
    if (error.stack) console.error(error.stack);
    return { text: null, error: error.message, model };
  }
}

async function main() {
  console.log('=== Тестирование транскрипции с новыми моделями GPT-4o ===');

  try {
    // Получаем информацию о файле
    if (fs.existsSync(audioFile)) {
      const stats = fs.statSync(audioFile);
      console.log(`Размер файла: ${Math.round(stats.size / 1024)} КБ`);
      
      // Тестируем каждую модель
      for (const model of models) {
        console.log(`\n--- Тестирование модели: ${model} ---`);
        
        try {
          // Транскрибируем
          const result = await transcribeWithAudioAPI(audioFile, model);
          
          if (result.text) {
            console.log('\nРезультат транскрипции:');
            console.log('-'.repeat(50));
            console.log(result.text);
            console.log('-'.repeat(50));
            console.log(`Время выполнения: ${result.elapsedTime.toFixed(2)} секунд`);
          } else {
            console.error(`Транскрипция не удалась: ${result.error}`);
          }
        } catch (modelError) {
          console.error(`Ошибка при тестировании модели ${model}: ${modelError.message}`);
        }
      }
    } else {
      console.error(`Файл не найден: ${audioFile}`);
    }
  } catch (error) {
    console.error(`Ошибка при выполнении тестов: ${error.message}`);
  }
}

main();