/**
 * Тест транскрипции с использованием OpenAI Audio API
 */

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

async function testTranscriptionAPI() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY не найден в переменных окружения');
    }

    // Тестовый аудиофайл (MP3 формат)
    const audioFile = path.join(process.cwd(), 'test_audio', 'short_test.mp3');
    if (!fs.existsSync(audioFile)) {
      throw new Error(`Аудиофайл не найден: ${audioFile}`);
    }

    console.log(`Используем аудиофайл: ${audioFile}`);
    
    // Создаем FormData для отправки файла
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFile));
    formData.append('model', 'whisper-1'); // whisper-1 или gpt-4o-mini или gpt-4o
    formData.append('response_format', 'json');
    formData.append('language', 'ru');
    
    console.log('Отправка запроса к OpenAI Audio API...');
    
    // Отправляем запрос к OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
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
        console.error('❌ Ошибка при запросе к OpenAI Audio API:');
        console.error(`Статус: ${response.status} ${response.statusText}`);
        console.error('Детали ошибки API:');
        console.error(JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.error('❌ Ошибка при запросе к OpenAI Audio API:');
        console.error(`Статус: ${response.status} ${response.statusText}`);
        console.error('Ответ:', errorText);
      }
      return;
    }

    const data = await response.json();
    console.log('✅ Успешный ответ от OpenAI Audio API:');
    console.log(data.text);
    
    // Теперь попробуем с моделью gpt-4o-mini-transcribe
    console.log('\nТестирование транскрипции с использованием gpt-4o-mini-transcribe...');
    await testGPT4oTranscription('gpt-4o-mini-transcribe', audioFile, apiKey);
    
    // И с моделью gpt-4o-transcribe
    console.log('\nТестирование транскрипции с использованием gpt-4o-transcribe...');
    await testGPT4oTranscription('gpt-4o-transcribe', audioFile, apiKey);
    
  } catch (error) {
    console.error('❌ Ошибка при запросе к OpenAI API:');
    console.error(`Сообщение: ${error.message}`);
  }
}

/**
 * Тестирование транскрипции с моделями gpt-4o и gpt-4o-mini
 */
async function testGPT4oTranscription(model, audioFile, apiKey) {
  try {
    // Создаем FormData для отправки файла
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFile));
    formData.append('model', model);
    formData.append('response_format', 'json');
    formData.append('language', 'ru');
    
    // Отправляем запрос
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
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
        console.error(`❌ Ошибка при запросе с моделью ${model}:`);
        console.error(`Статус: ${response.status} ${response.statusText}`);
        console.error('Детали ошибки API:');
        console.error(JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.error(`❌ Ошибка при запросе с моделью ${model}:`);
        console.error(`Статус: ${response.status} ${response.statusText}`);
        console.error('Ответ:', errorText);
      }
      return;
    }
    
    const data = await response.json();
    console.log(`✅ Успешный ответ от модели ${model}:`);
    console.log(data.text);
  } catch (error) {
    console.error(`❌ Ошибка при запросе с моделью ${model}:`);
    console.error(`Сообщение: ${error.message}`);
  }
}

// Запускаем тест
testTranscriptionAPI();