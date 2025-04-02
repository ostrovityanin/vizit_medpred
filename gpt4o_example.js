/**
 * Пример использования GPT-4o Audio Preview API для транскрипции аудио
 * Основано на примерах из https://github.com/anarojoecheburua/OpenAI-gpt-4o-audio-preview-Model-Tutorial
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// Получение абсолютного пути к текущему каталогу
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Функция для кодирования аудио в base64
function encodeAudioToBase64(audioFilePath) {
  try {
    const audioBuffer = fs.readFileSync(audioFilePath);
    return audioBuffer.toString('base64');
  } catch (error) {
    console.error(`Ошибка при чтении файла ${audioFilePath}:`, error);
    return null;
  }
}

// Функция для транскрипции аудиофайла с использованием GPT-4o
async function transcribeWithGPT4o(audioFilePath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Ошибка: OPENAI_API_KEY не установлен в переменных окружения');
    return null;
  }

  try {
    console.log(`Транскрибируем файл: ${audioFilePath}`);
    
    // Определяем формат файла по расширению
    const fileFormat = path.extname(audioFilePath).substring(1).toLowerCase();
    const supportedFormats = ['mp3', 'wav'];
    
    const format = supportedFormats.includes(fileFormat) ? fileFormat : 'wav';
    
    // Кодируем аудиофайл в base64
    const audio_b64 = encodeAudioToBase64(audioFilePath);
    if (!audio_b64) {
      return null;
    }

    // Создаем структуру сообщения для отправки
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: "Транскрибируй это аудио, пожалуйста." },
          { type: "input_audio", input_audio: { data: audio_b64, format } }
        ]
      }
    ];

    // Отправляем запрос к OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-audio-preview',
        messages,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Ошибка API:', errorData);
      return null;
    }

    const data = await response.json();
    console.log('Результат транскрипции:', data);
    
    return {
      text: data.choices[0]?.message?.content || 'Не удалось получить текст транскрипции',
      usage: data.usage
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
  
  console.log('Начинаем транскрипцию...');
  const result = await transcribeWithGPT4o(testAudioFile);
  
  if (result) {
    console.log('Транскрипция завершена успешно:');
    console.log('Текст:', result.text);
    if (result.usage) {
      console.log('Использовано токенов:', result.usage);
    }
  } else {
    console.log('Не удалось выполнить транскрипцию');
  }
}

// Запуск основной функции
main().catch(console.error);