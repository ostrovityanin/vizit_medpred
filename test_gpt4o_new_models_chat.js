/**
 * Тест транскрипции с новыми моделями GPT-4o (gpt-4o-transcribe и gpt-4o-mini-transcribe) через Chat API
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// Тестируемый аудиофайл
const audioFile = './test_audio/sample.wav';

// Список моделей для тестирования
const models = [
  'gpt-4o',
  'gpt-4o-transcribe',
  'gpt-4o-mini-transcribe'
];

/**
 * Кодирование аудиофайла в Base64
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {string|null} Закодированные данные или null в случае ошибки
 */
function encodeAudioToBase64(audioFilePath) {
  try {
    // Читаем файл как бинарные данные
    const audioBuffer = fs.readFileSync(audioFilePath);
    // Кодируем в Base64
    return audioBuffer.toString('base64');
  } catch (error) {
    console.error(`Ошибка при кодировании аудио в Base64: ${error.message}`);
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
  return fileExt;
}

/**
 * Транскрипция аудио с использованием Chat API
 */
async function transcribeWithChatAPI(audioFilePath, model) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY не найден в переменных окружения');
  }

  if (!fs.existsSync(audioFilePath)) {
    throw new Error(`Файл не существует: ${audioFilePath}`);
  }

  try {
    console.log(`Транскрибирование файла через Chat API с моделью ${model}: ${audioFilePath}`);
    
    // Кодируем аудиофайл в Base64
    const base64Audio = encodeAudioToBase64(audioFilePath);
    if (!base64Audio) {
      throw new Error('Ошибка при кодировании аудио в Base64');
    }
    
    const format = getAudioFormat(audioFilePath);
    
    // Создаем объект запроса
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Транскрибируй этот аудиофайл точно. Выдай только текст транскрипции без дополнительных комментариев.' },
            { type: 'input_audio', input_audio: { data: base64Audio, format } }
          ]
        }
      ],
      max_tokens: 4096
    };
    
    console.log('Отправка запроса к Chat API...');
    const startTime = Date.now();
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
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
      text: result.choices[0].message.content,
      elapsedTime,
      model,
      usage: result.usage
    };
  } catch (error) {
    console.error(`Ошибка при транскрибировании аудио: ${error.message}`);
    if (error.stack) console.error(error.stack);
    return { text: null, error: error.message, model };
  }
}

async function main() {
  console.log('=== Тестирование транскрипции с новыми моделями GPT-4o через Chat API ===');

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
          const result = await transcribeWithChatAPI(audioFile, model);
          
          if (result.text) {
            console.log('\nРезультат транскрипции:');
            console.log('-'.repeat(50));
            console.log(result.text);
            console.log('-'.repeat(50));
            console.log(`Время выполнения: ${result.elapsedTime.toFixed(2)} секунд`);
            if (result.usage) {
              console.log(`Использование токенов:`, result.usage);
            }
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