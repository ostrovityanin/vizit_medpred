/**
 * Пример прямого использования OpenAI Audio API для транскрипции
 * с поддержкой GPT-4o Audio Preview
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { FormData, File } from 'formdata-node';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// Получение абсолютного пути к текущему каталогу
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Функция для транскрипции аудиофайла через /v1/audio/transcriptions API
async function transcribeWithAudioAPI(audioFilePath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Ошибка: OPENAI_API_KEY не установлен в переменных окружения');
    return null;
  }

  try {
    console.log(`Транскрибируем файл через Audio API: ${audioFilePath}`);
    
    if (!fs.existsSync(audioFilePath)) {
      console.error(`Файл не найден: ${audioFilePath}`);
      return null;
    }
    
    // Чтение файла и создание объекта File
    const fileBuffer = fs.readFileSync(audioFilePath);
    const fileBasename = path.basename(audioFilePath);
    const fileType = 'audio/' + path.extname(audioFilePath).substring(1);
    
    const file = new File([fileBuffer], fileBasename, { type: fileType });
    
    // Создаем FormData для передачи аудиофайла
    const formData = new FormData();
    formData.append('file', file);
    
    // Используем модель whisper-1 для транскрипции (или gpt-4o-audio-preview, если поддерживается)
    formData.append('model', 'whisper-1');
    
    // Дополнительные параметры (опционально)
    // formData.append('language', 'ru'); // указать язык аудио
    // formData.append('prompt', 'Транскрибируй это аудио точно'); // подсказка для улучшения транскрипции
    
    // Отправляем запрос к OpenAI Audio API
    const url = 'https://api.openai.com/v1/audio/transcriptions';
    console.log(`Отправка запроса на: ${url}`);
    
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
        console.error('Ошибка API:', errorData);
      } catch {
        console.error('Ошибка API:', errorText);
      }
      return null;
    }

    const data = await response.json();
    console.log('Результат транскрипции:', data);
    
    return {
      text: data.text || 'Не удалось получить текст транскрипции'
    };
  } catch (error) {
    console.error('Ошибка при вызове API:', error);
    return null;
  }
}

// Основная функция
async function main() {
  // Пример использования с демо-файлом из репозитория
  const testAudioFile = path.join(__dirname, 'temp/tutorial/math_joke_audio.wav');
  
  if (!fs.existsSync(testAudioFile)) {
    console.error(`Тестовый аудиофайл не найден: ${testAudioFile}`);
    return;
  }
  
  console.log('Начинаем транскрипцию через API /v1/audio/transcriptions...');
  const result = await transcribeWithAudioAPI(testAudioFile);
  
  if (result) {
    console.log('Транскрипция завершена успешно:');
    console.log('Текст:', result.text);
  } else {
    console.log('Не удалось выполнить транскрипцию');
  }
}

// Запуск основной функции
main().catch(console.error);