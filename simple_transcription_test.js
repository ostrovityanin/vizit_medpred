/**
 * Упрощенный тест транскрипции с использованием новых моделей GPT-4o
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Тестируемый аудиофайл
const originalAudioFile = './test_audio/test_ru.wav';
const mp3AudioFile = './test_audio/test_ru.mp3';

// Подготовка аудиофайла
async function prepareAudioFile() {
  try {
    await execPromise(`ffmpeg -i "${originalAudioFile}" -ar 16000 -ac 1 -b:a 32k "${mp3AudioFile}" -y`);
    console.log(`Аудиофайл оптимизирован: ${mp3AudioFile}`);
    return mp3AudioFile;
  } catch (error) {
    console.error('Ошибка при оптимизации аудио:', error);
    throw error;
  }
}

// Список моделей для тестирования
const models = [
  'whisper-1',
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
    console.log(`Транскрипция с моделью ${model}: ${path.basename(audioFilePath)}`);
    
    // Создаем объект FormData для мультичастного запроса
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model', model);
    formData.append('language', 'ru');
    
    const startTime = Date.now();
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    const endTime = Date.now();
    const elapsedTime = (endTime - startTime) / 1000; // в секундах
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка API OpenAI: ${response.status}\n${errorText}`);
    }
    
    const result = await response.json();
    
    return {
      text: result.text,
      elapsedTime,
      model
    };
  } catch (error) {
    console.error(`Ошибка при транскрибировании аудио: ${error.message}`);
    return { text: null, error: error.message, model };
  }
}

async function main() {
  console.log('=== Тестирование транскрипции с моделями OpenAI ===');

  try {
    // Подготовка аудиофайла в формате MP3
    const audioFile = await prepareAudioFile();
    
    // Результаты для всех моделей
    const results = [];
    
    // Тестируем каждую модель
    for (const model of models) {
      console.log(`\n--- Тестирование модели: ${model} ---`);
      
      try {
        // Транскрибируем
        const result = await transcribeWithAudioAPI(audioFile, model);
        results.push(result);
        
        if (result.text) {
          console.log(`Результат: "${result.text}"`);
          console.log(`Время выполнения: ${result.elapsedTime.toFixed(2)} секунд`);
        } else {
          console.error(`Ошибка: ${result.error}`);
        }
      } catch (modelError) {
        console.error(`Ошибка при тестировании модели ${model}: ${modelError.message}`);
      }
    }
    
    // Сводная таблица результатов
    console.log('\n=== Сравнение результатов ===');
    console.log('-'.repeat(80));
    console.log('| Модель                | Время (сек) | Результат');
    console.log('-'.repeat(80));
    
    for (const result of results) {
      if (result.text) {
        console.log(`| ${result.model.padEnd(22)} | ${result.elapsedTime.toFixed(2).padStart(11)} | ${result.text}`);
      } else {
        console.log(`| ${result.model.padEnd(22)} | ${'-'.padStart(11)} | Ошибка: ${result.error}`);
      }
    }
    
    console.log('-'.repeat(80));
    
  } catch (error) {
    console.error(`Общая ошибка: ${error.message}`);
  }
}

main();