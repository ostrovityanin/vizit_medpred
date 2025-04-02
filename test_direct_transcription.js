/**
 * Прямое тестирование транскрипции аудио с использованием GPT-4o Audio Preview
 * 
 * Этот скрипт демонстрирует прямое использование API OpenAI для транскрипции
 * аудиофайлов без использования микросервиса. Поддерживаются два метода:
 * 1. Через chat/completions API с моделью GPT-4o Audio Preview
 * 2. Через audio/transcriptions API с моделью Whisper
 */

import fs from 'fs';
import path from 'path';
import { FormData, File } from 'formdata-node';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Загрузка переменных окружения
dotenv.config();

// Путь к тестовому аудиофайлу
const testAudioFile = './test_audio/sample.wav';
// Второй тестовый файл
const testAudioFile2 = './test_audio/sample2.wav';

/**
 * Кодирование аудиофайла в Base64
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {string|null} Закодированные данные или null в случае ошибки
 */
function encodeAudioToBase64(audioFilePath) {
  try {
    console.log(`Кодирование файла ${audioFilePath} в Base64`);
    const audioBuffer = fs.readFileSync(audioFilePath);
    return audioBuffer.toString('base64');
  } catch (error) {
    console.error(`Ошибка при чтении файла ${audioFilePath}: ${error.message}`);
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
  const supportedFormats = ['mp3', 'wav', 'm4a', 'webm', 'mp4', 'mpga', 'mpeg'];
  
  return supportedFormats.includes(fileExt) ? fileExt : 'wav';
}

/**
 * Транскрипция аудио с использованием GPT-4o через chat/completions API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {Promise<string>} Результат транскрипции
 */
async function transcribeWithGPT4o(audioFilePath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('API ключ OpenAI не установлен в переменной окружения OPENAI_API_KEY');
    return 'Ошибка: API ключ не найден';
  }

  try {
    console.log(`Транскрипция через GPT-4o (chat/completions): ${audioFilePath}`);
    
    // Определяем формат файла
    const format = getAudioFormat(audioFilePath);
    
    // Кодируем аудиофайл в base64
    const audio_b64 = encodeAudioToBase64(audioFilePath);
    if (!audio_b64) {
      return 'Ошибка: не удалось закодировать аудиофайл';
    }

    // Создаем структуру сообщения для отправки
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: "Транскрибируй этот аудиофайл максимально точно." },
          { type: "input_audio", input_audio: { data: audio_b64, format } }
        ]
      }
    ];

    console.log(`Отправка запроса на транскрипцию с форматом: ${format}`);
    console.time('gpt4o-transcription');
    
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
      console.error(`Ошибка API: ${JSON.stringify(errorData)}`);
      return `Ошибка API: ${JSON.stringify(errorData)}`;
    }

    const data = await response.json();
    console.timeEnd('gpt4o-transcription');
    
    console.log('Информация об использовании токенов:', data.usage);
    
    return data.choices[0]?.message?.content || 'Не удалось получить текст транскрипции';
  } catch (error) {
    console.error(`Ошибка при вызове API: ${error.message}`);
    return `Ошибка при вызове API: ${error.message}`;
  }
}

/**
 * Транскрипция аудио с использованием OpenAI Audio API (/v1/audio/transcriptions)
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {Promise<string>} Результат транскрипции
 */
async function transcribeWithWhisper(audioFilePath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('API ключ OpenAI не установлен в переменной окружения OPENAI_API_KEY');
    return 'Ошибка: API ключ не найден';
  }

  try {
    console.log(`Транскрипция через Whisper (audio/transcriptions): ${audioFilePath}`);
    
    if (!fs.existsSync(audioFilePath)) {
      console.error(`Файл не найден: ${audioFilePath}`);
      return 'Ошибка: файл не найден';
    }
    
    // Чтение файла и создание объекта File
    const fileBuffer = fs.readFileSync(audioFilePath);
    const fileBasename = path.basename(audioFilePath);
    const fileType = 'audio/' + getAudioFormat(audioFilePath);
    
    const file = new File([fileBuffer], fileBasename, { type: fileType });
    
    // Создаем FormData для передачи аудиофайла
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');
    formData.append('language', 'ru');
    
    // Отправляем запрос к OpenAI Audio API
    const url = 'https://api.openai.com/v1/audio/transcriptions';
    console.log(`Отправка запроса на: ${url}`);
    console.time('whisper-transcription');
    
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
        console.error(`Ошибка API: ${JSON.stringify(errorData)}`);
      } catch {
        console.error(`Ошибка API: ${errorText}`);
      }
      return `Ошибка API: ${response.status} ${response.statusText}`;
    }

    const data = await response.json();
    console.timeEnd('whisper-transcription');
    
    return data.text || 'Не удалось получить текст транскрипции';
  } catch (error) {
    console.error(`Ошибка при вызове API: ${error.message}`);
    return `Ошибка при вызове API: ${error.message}`;
  }
}

/**
 * Основная функция для запуска тестов
 */
async function runTests() {
  console.log('=== Тестирование транскрипции аудио ===');
  
  // Проверяем наличие API ключа
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('API ключ OpenAI не установлен в переменной окружения OPENAI_API_KEY');
    return;
  }
  
  // Проверяем наличие тестового файла
  if (!fs.existsSync(testAudioFile)) {
    console.error(`Тестовый файл не найден: ${testAudioFile}`);
    return;
  }
  
  console.log('1. Тестирование транскрипции через GPT-4o Audio Preview (chat/completions API)');
  const gpt4oResult = await transcribeWithGPT4o(testAudioFile);
  
  console.log('\n=== Результат транскрипции GPT-4o Audio Preview ===');
  console.log(gpt4oResult);
  console.log('===============================================\n');
  
  // Если есть второй тестовый файл, тестируем и его
  if (fs.existsSync(testAudioFile2)) {
    console.log('2. Тестирование транскрипции второго файла через GPT-4o Audio Preview');
    const gpt4oResult2 = await transcribeWithGPT4o(testAudioFile2);
    
    console.log('\n=== Результат транскрипции второго файла (GPT-4o) ===');
    console.log(gpt4oResult2);
    console.log('===============================================\n');
  }
  
  console.log('3. Тестирование транскрипции через Whisper (audio/transcriptions API)');
  const whisperResult = await transcribeWithWhisper(testAudioFile);
  
  console.log('\n=== Результат транскрипции Whisper API ===');
  console.log(whisperResult);
  console.log('===============================================\n');
  
  console.log('Тестирование завершено!');
}

// Запуск тестов
runTests();