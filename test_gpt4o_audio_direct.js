/**
 * Прямое тестирование GPT-4o Audio Preview для транскрипции аудио
 * 
 * Этот скрипт использует OpenAI API для выполнения транскрипции аудиофайлов
 * с помощью модели GPT-4o, а также сравнивает результаты с другими моделями.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// API ключ OpenAI из .env
import dotenv from 'dotenv';
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Кодирует аудиофайл в формате Base64
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {string|null} Закодированные данные или null при ошибке
 */
function encodeAudioToBase64(audioFilePath) {
  try {
    const audioData = fs.readFileSync(audioFilePath);
    return audioData.toString('base64');
  } catch (error) {
    console.error(`Ошибка при кодировании аудиофайла: ${error.message}`);
    return null;
  }
}

/**
 * Выполняет транскрипцию аудио с использованием OpenAI Audio API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {string} model Модель для транскрипции (whisper-1, gpt-4o, gpt-4o-mini)
 * @returns {Promise<object>} Результат транскрипции
 */
async function transcribeWithAudioAPI(audioFilePath, model = 'whisper-1') {
  try {
    console.log(`📝 Начинаем транскрипцию с моделью ${model}...`);
    const startTime = Date.now();
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model', model);
    formData.append('language', 'ru');
    formData.append('response_format', 'json');
    
    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          ...formData.getHeaders()
        }
      }
    );
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Транскрипция завершена за ${duration} сек`);
    
    return {
      model,
      duration: parseFloat(duration),
      transcript: response.data.text
    };
  } catch (error) {
    console.error(`❌ Ошибка при транскрипции (${model}): ${error.message}`);
    
    if (error.response) {
      console.error(`Статус: ${error.response.status}`);
      console.error(`Данные: ${JSON.stringify(error.response.data)}`);
    }
    
    return {
      model,
      duration: 0,
      transcript: `Ошибка: ${error.message}`,
      error: true
    };
  }
}

/**
 * Выполняет транскрипцию аудио с использованием GPT-4o Chat API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {string} modelName Название модели (gpt-4o, gpt-4o-mini)
 * @returns {Promise<object>} Результат транскрипции
 */
async function transcribeWithGPT4oChat(audioFilePath, modelName = 'gpt-4o') {
  try {
    console.log(`📝 Начинаем транскрипцию с моделью ${modelName} через Chat API...`);
    const startTime = Date.now();
    
    // Кодируем аудиофайл в Base64
    const audioBase64 = encodeAudioToBase64(audioFilePath);
    if (!audioBase64) {
      throw new Error('Не удалось закодировать аудиофайл');
    }
    
    // Получаем расширение файла для определения MIME-типа
    const fileExtension = path.extname(audioFilePath).toLowerCase();
    let mimeType;
    
    switch (fileExtension) {
      case '.mp3':
        mimeType = 'audio/mp3';
        break;
      case '.mp4':
      case '.m4a':
        mimeType = 'audio/mp4';
        break;
      case '.mpeg':
        mimeType = 'audio/mpeg';
        break;
      case '.mpga':
        mimeType = 'audio/mpeg';
        break;
      case '.wav':
        mimeType = 'audio/wav';
        break;
      case '.webm':
        mimeType = 'audio/webm';
        break;
      default:
        mimeType = 'audio/mp3'; // Значение по умолчанию
    }
    
    const payload = {
      model: modelName,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Пожалуйста, расшифруйте аудио и предоставьте полную транскрипцию. Только текст из аудио, без комментариев."
            },
            {
              type: "input_audio",
              input_audio: `data:${mimeType};base64,${audioBase64}`
            }
          ]
        }
      ]
    };
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Транскрипция через Chat API завершена за ${duration} сек`);
    
    return {
      model: modelName,
      duration: parseFloat(duration),
      transcript: response.data.choices[0].message.content
    };
  } catch (error) {
    console.error(`❌ Ошибка при транскрипции через Chat API (${modelName}): ${error.message}`);
    
    if (error.response) {
      console.error(`Статус: ${error.response.status}`);
      console.error(`Данные: ${JSON.stringify(error.response.data)}`);
    }
    
    return {
      model: modelName,
      duration: 0,
      transcript: `Ошибка: ${error.message}`,
      error: true
    };
  }
}

/**
 * Функция для запуска тестирования транскрипции
 */
async function runTests() {
  if (!OPENAI_API_KEY) {
    console.error('❌ Отсутствует OPENAI_API_KEY в переменных окружения');
    console.log('Для работы скрипта необходимо установить переменную окружения OPENAI_API_KEY.');
    return;
  }
  
  // Путь к тестовому аудиофайлу
  const testAudioFile = path.join(__dirname, 'test_audio', 'test.mp3');
  
  // Проверяем наличие тестового файла
  if (!fs.existsSync(testAudioFile)) {
    console.error(`❌ Тестовый аудиофайл не найден: ${testAudioFile}`);
    console.log('Создайте тестовый файл с помощью скрипта generate-quick-test-audio.js');
    return;
  }
  
  console.log('🔍 Тестирование транскрипции для разных моделей\n');
  
  // Список тестируемых моделей и методов
  const tests = [
    { method: transcribeWithAudioAPI, args: [testAudioFile, 'whisper-1'], name: 'Whisper API' },
    { method: transcribeWithGPT4oChat, args: [testAudioFile, 'gpt-4o'], name: 'GPT-4o через Chat API' },
    { method: transcribeWithGPT4oChat, args: [testAudioFile, 'gpt-4o-mini'], name: 'GPT-4o-mini через Chat API' }
  ];
  
  const results = [];
  
  // Запускаем все тесты последовательно
  for (const test of tests) {
    console.log(`\n🔄 Тестирование ${test.name}...`);
    
    try {
      const result = await test.method(...test.args);
      results.push(result);
      
      // Выводим результат
      console.log(`📊 Результат транскрипции (${result.model}):`);
      console.log(`   Длительность: ${result.duration} сек`);
      console.log(`   Текст: "${result.transcript}"`);
    } catch (error) {
      console.error(`❌ Ошибка при выполнении теста ${test.name}: ${error.message}`);
    }
  }
  
  // Сохраняем результаты в файл
  const resultPath = path.join(__dirname, 'transcription-comparison.json');
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
  
  console.log(`\n💾 Результаты сохранены в файл: ${resultPath}`);
  
  // Выводим сравнение
  console.log('\n📋 Сравнение результатов:');
  console.log('┌────────────────────┬────────────┬───────────────────────────────────────────────────┐');
  console.log('│ Модель             │ Время (с)  │ Транскрипция                                      │');
  console.log('├────────────────────┼────────────┼───────────────────────────────────────────────────┤');
  
  for (const result of results) {
    // Обрезаем транскрипцию для вывода в таблице
    const shortTranscript = result.transcript.substring(0, 50) + 
                          (result.transcript.length > 50 ? '...' : '');
    
    // Форматируем строку таблицы с фиксированной шириной
    console.log(
      `│ ${result.model.padEnd(18)} │ ${result.duration.toString().padEnd(10)} │ ${shortTranscript.padEnd(45)} │`
    );
  }
  
  console.log('└────────────────────┴────────────┴───────────────────────────────────────────────────┘');
}

// Запускаем тесты
runTests();