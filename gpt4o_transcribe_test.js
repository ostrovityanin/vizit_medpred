/**
 * Тест транскрипции аудио с использованием GPT-4o Audio Preview API.
 * Этот скрипт отправляет аудиофайл в OpenAI API и получает транскрипцию.
 */

// Импортируем необходимые модули
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Получаем текущую директорию для работы с относительными путями
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Кодирует аудиофайл в Base64
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
    console.log(`Транскрипция файла через GPT-4o (chat/completions): ${audioFilePath}`);
    
    // Определяем формат файла по расширению
    const format = path.extname(audioFilePath).substring(1).toLowerCase();
    
    // Кодируем аудиофайл в base64
    const audio_b64 = encodeAudioToBase64(audioFilePath);
    if (!audio_b64) {
      return 'Ошибка: не удалось закодировать аудиофайл';
    }

    // Создаем структуру сообщения для отправки с обновленным форматом API
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: "Пожалуйста, точно транскрибируй содержание данного аудиофайла." },
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
        model: 'gpt-4o-mini-realtime-preview',
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
 * Основная функция для запуска тестов
 */
async function runTests() {
  console.log('=== Тестирование транскрипции аудио с GPT-4o Audio Preview ===');
  
  // Путь к тестовому аудиофайлу
  const testAudioFile = './test_audio/sample.wav';
  
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
  
  try {
    console.log('Тестирование транскрипции через GPT-4o Audio Preview (chat/completions API)');
    const gpt4oResult = await transcribeWithGPT4o(testAudioFile);
    
    console.log('\n=== Результат транскрипции GPT-4o Audio Preview ===');
    console.log(gpt4oResult);
    console.log('===============================================\n');
    
    console.log('Тестирование завершено!');
  } catch (error) {
    console.error(`Ошибка при выполнении тестов: ${error.message}`);
  }
}

// Запуск тестов
runTests();