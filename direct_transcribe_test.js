/**
 * Прямое тестирование транскрипции с использованием Whisper API
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import dotenv from 'dotenv';

dotenv.config();

// Тестируемый аудиофайл
const audioFile = './test_audio/sample.wav';

async function transcribeWithWhisper(audioFilePath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY не найден в переменных окружения');
  }

  if (!fs.existsSync(audioFilePath)) {
    throw new Error(`Файл не существует: ${audioFilePath}`);
  }

  try {
    console.log(`Транскрибирование файла через Whisper API: ${audioFilePath}`);
    
    // Создаем объект FormData для мультичастного запроса
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model', 'whisper-1');
    formData.append('language', 'ru'); // можно указать язык или оставить пустым для автодетекции
    
    console.log('Отправка запроса к Whisper API...');
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
      elapsedTime
    };
  } catch (error) {
    console.error(`Ошибка при транскрибировании аудио: ${error.message}`);
    if (error.stack) console.error(error.stack);
    return { text: null, error: error.message };
  }
}

async function main() {
  console.log('=== Тестирование транскрипции с Whisper API ===');

  try {
    // Получаем информацию о файле
    if (fs.existsSync(audioFile)) {
      const stats = fs.statSync(audioFile);
      console.log(`Размер файла: ${Math.round(stats.size / 1024)} КБ`);
      
      // Транскрибируем
      const result = await transcribeWithWhisper(audioFile);
      
      if (result.text) {
        console.log('\nРезультат транскрипции:');
        console.log('-'.repeat(50));
        console.log(result.text);
        console.log('-'.repeat(50));
        console.log(`Время выполнения: ${result.elapsedTime.toFixed(2)} секунд`);
      } else {
        console.error(`Транскрипция не удалась: ${result.error}`);
      }
    } else {
      console.error(`Файл не найден: ${audioFile}`);
    }
  } catch (error) {
    console.error(`Ошибка при выполнении тестов: ${error.message}`);
  }
}

main();