/**
 * Тест API для транскрипции
 * 
 * Этот скрипт тестирует API для транскрипции, которое доступно через HTTP
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { fileURLToPath } from 'url';

// Для работы с __dirname в ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// URL API
const API_URL = 'http://localhost:5000/api';

// Пути для тестовых аудиофайлов
const TEST_AUDIO_DIR = path.join(__dirname, 'test_audio');
const TEST_FILES = [
  path.join(TEST_AUDIO_DIR, 'short_russian.mp3'), // короткое аудио на русском
  path.join(TEST_AUDIO_DIR, 'short_english.mp3'), // короткое аудио на английском
];

/**
 * Проверка доступности сервера
 */
async function testHealth() {
  try {
    const response = await axios.get(`http://localhost:5000/health`);
    console.log('Статус сервера:', response.data.status);
    return true;
  } catch (error) {
    console.error('Ошибка при проверке доступности сервера:', error.message);
    return false;
  }
}

/**
 * Тест транскрипции с использованием API
 */
async function testTranscription(audioFile, options = {}) {
  try {
    if (!fs.existsSync(audioFile)) {
      console.error(`Ошибка: Файл ${audioFile} не найден`);
      return;
    }

    console.log(`Тестирование транскрипции файла ${path.basename(audioFile)}...`);

    const form = new FormData();
    form.append('audio', fs.createReadStream(audioFile));
    
    // Добавляем параметры
    if (options.language) {
      form.append('language', options.language);
    }
    
    if (options.prompt) {
      form.append('prompt', options.prompt);
    }
    
    if (options.detailed) {
      form.append('detailed', options.detailed);
    }
    
    if (options.speed) {
      form.append('speed', options.speed);
    }
    
    // Начало замера времени
    const startTime = Date.now();
    
    const response = await axios.post(
      `${API_URL}/transcribe`,
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    // Конец замера времени
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000; // в секундах
    
    console.log(`Результат транскрипции (${totalTime.toFixed(2)}s общее время):`);
    console.log(`Текст: ${response.data.text}`);
    console.log(`Модель: ${response.data.model}`);
    console.log(`Время обработки API: ${response.data.processingTime.toFixed(2)}s`);
    console.log(`Размер файла: ${(response.data.fileSize / 1024).toFixed(2)} KB`);
    console.log('---');
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при тестировании транскрипции:', error.message);
    if (error.response) {
      console.error('Ответ API:', error.response.data);
    }
  }
}

/**
 * Тест сравнения моделей транскрипции
 */
async function testComparisonEndpoint(audioFile, options = {}) {
  try {
    if (!fs.existsSync(audioFile)) {
      console.error(`Ошибка: Файл ${audioFile} не найден`);
      return;
    }

    console.log(`Тестирование сравнительной транскрипции файла ${path.basename(audioFile)}...`);

    const form = new FormData();
    form.append('audio', fs.createReadStream(audioFile));
    
    // Добавляем параметры
    if (options.language) {
      form.append('language', options.language);
    }
    
    if (options.prompt) {
      form.append('prompt', options.prompt);
    }
    
    // Начало замера времени
    const startTime = Date.now();
    
    const response = await axios.post(
      `${API_URL}/transcribe/compare`,
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    // Конец замера времени
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000; // в секундах
    
    console.log(`Результаты сравнительной транскрипции (${totalTime.toFixed(2)}s общее время):`);
    
    // Выводим результаты по каждой модели
    for (const model of Object.keys(response.data)) {
      if (model === 'fileSize' || model === 'fileName') continue;
      
      const result = response.data[model];
      if (result.error) {
        console.log(`${model}: Ошибка - ${result.error}`);
      } else {
        console.log(`${model}:`);
        console.log(`  Текст: ${result.text}`);
        console.log(`  Время обработки: ${result.processingTime.toFixed(2)}s`);
      }
    }
    
    console.log(`Размер файла: ${(response.data.fileSize / 1024).toFixed(2)} KB`);
    console.log('---');
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при тестировании сравнения моделей:', error.message);
    if (error.response) {
      console.error('Ответ API:', error.response.data);
    }
  }
}

/**
 * Подготовка тестовых аудиофайлов, если они не существуют
 */
async function prepareTestFiles() {
  // Проверяем наличие директории для тестовых файлов
  if (!fs.existsSync(TEST_AUDIO_DIR)) {
    fs.mkdirSync(TEST_AUDIO_DIR, { recursive: true });
    console.log(`Создана директория для тестовых файлов: ${TEST_AUDIO_DIR}`);
  }
  
  // Здесь можно добавить логику для подготовки тестовых файлов,
  // например, загрузку примеров или копирование из других мест
}

/**
 * Основная функция
 */
async function main() {
  try {
    // Проверяем доступность сервера
    const isHealthy = await testHealth();
    if (!isHealthy) {
      console.error('Сервер недоступен. Прерываем тесты.');
      return;
    }
    
    // Подготавливаем тестовые файлы
    await prepareTestFiles();
    
    // Проверяем наличие тестовых файлов
    let testFile = null;
    for (const file of TEST_FILES) {
      if (fs.existsSync(file)) {
        testFile = file;
        break;
      }
    }
    
    if (!testFile) {
      console.error('Не найдены тестовые аудио файлы. Пожалуйста, создайте файлы в директории test_audio/');
      return;
    }
    
    console.log('Начинаем тестирование API для транскрипции...');
    
    // Тест обычной транскрипции
    await testTranscription(testFile, { language: 'ru' });
    
    // Тест сравнения моделей
    await testComparisonEndpoint(testFile, { language: 'ru' });
    
    console.log('Тестирование завершено.');
  } catch (error) {
    console.error('Ошибка при выполнении тестов:', error.message);
  }
}

// Запускаем тесты
main();