/**
 * Тест транскрипции через микросервис с разными моделями
 * 
 * Этот скрипт тестирует как обычную транскрипцию, так и сравнительную транскрипцию
 * через endpoint /api/transcribe/compare
 */

import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { spawn } from 'child_process';

// Конфигурация
const SERVICE_URL = 'http://localhost:3100';
const TEST_FILES = [
  './test_audio/test_ru.mp3',
  './test_audio/privet.mp3'
];

/**
 * Проверка готовности сервиса
 * @returns {Promise<boolean>} Готовность сервиса
 */
async function isServiceReady() {
  try {
    const response = await fetch(`${SERVICE_URL}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Задержка выполнения
 * @param {number} ms Время задержки в миллисекундах
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Запуск микросервиса
 * @returns {Promise<ChildProcess>} Процесс микросервиса
 */
async function startService() {
  console.log('🚀 Запуск микросервиса...');
  
  const serviceProcess = spawn('node', ['start-gpt4o-service.js'], {
    detached: false,
    stdio: 'inherit'
  });
  
  serviceProcess.on('error', (error) => {
    console.error(`🔴 Ошибка запуска сервиса: ${error.message}`);
  });
  
  // Ждем запуска сервиса
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    attempts++;
    
    if (await isServiceReady()) {
      console.log('✅ Микросервис успешно запущен');
      return serviceProcess;
    }
    
    console.log(`⏳ Ожидание запуска сервиса (${attempts}/${maxAttempts})...`);
    await sleep(1000);
  }
  
  throw new Error('🔴 Не удалось запустить микросервис');
}

/**
 * Остановка микросервиса
 * @param {ChildProcess} serviceProcess Процесс микросервиса
 */
function stopService(serviceProcess) {
  console.log('🛑 Остановка микросервиса...');
  
  if (serviceProcess) {
    serviceProcess.kill();
  }
}

/**
 * Тест обычной транскрипции
 * @param {string} audioFile Путь к аудиофайлу
 */
async function testStandardTranscription(audioFile) {
  console.log(`\n🔍 Тест стандартной транскрипции файла: ${audioFile}`);
  
  try {
    if (!fs.existsSync(audioFile)) {
      console.error(`🔴 Файл не существует: ${audioFile}`);
      return;
    }
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFile));
    formData.append('language', 'ru');
    
    console.log('📤 Отправка запроса на /api/transcribe...');
    const response = await fetch(`${SERVICE_URL}/api/transcribe`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`🔴 Ошибка API (${response.status}): ${errorText}`);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Результат транскрипции:');
    console.log(`  📝 Текст: "${result.text}"`);
    console.log(`  ⏱️ Время обработки: ${result.processingTime} сек`);
    console.log(`  🏷️ Модель: ${result.model}`);
  } catch (error) {
    console.error(`🔴 Ошибка при выполнении теста: ${error.message}`);
  }
}

/**
 * Тест сравнительной транскрипции
 * @param {string} audioFile Путь к аудиофайлу
 */
async function testComparisonEndpoint(audioFile) {
  console.log(`\n🔍 Тест сравнительной транскрипции файла: ${audioFile}`);
  
  try {
    if (!fs.existsSync(audioFile)) {
      console.error(`🔴 Файл не существует: ${audioFile}`);
      return;
    }
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFile));
    formData.append('language', 'ru');
    
    console.log('📤 Отправка запроса на /api/transcribe/compare...');
    const response = await fetch(`${SERVICE_URL}/api/transcribe/compare`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`🔴 Ошибка API (${response.status}): ${errorText}`);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Результаты сравнительной транскрипции:');
    console.log(`  ⏱️ Общее время обработки: ${result.totalProcessingTime} сек\n`);
    
    // Выводим результаты для каждой модели
    for (const [model, data] of Object.entries(result.results)) {
      if (data.error) {
        console.log(`  🔴 Модель ${model}: Ошибка - ${data.error}`);
      } else {
        console.log(`  🏷️ Модель ${model} (${data.processingTime} сек):`);
        console.log(`     "${data.text}"`);
      }
    }
  } catch (error) {
    console.error(`🔴 Ошибка при выполнении теста: ${error.message}`);
  }
}

/**
 * Тест транскрипции с опцией detailed
 * @param {string} audioFile Путь к аудиофайлу
 */
async function testDetailedTranscription(audioFile) {
  console.log(`\n🔍 Тест расширенной транскрипции файла: ${audioFile}`);
  
  try {
    if (!fs.existsSync(audioFile)) {
      console.error(`🔴 Файл не существует: ${audioFile}`);
      return;
    }
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFile));
    formData.append('language', 'ru');
    formData.append('detailed', 'true');
    
    console.log('📤 Отправка запроса на /api/transcribe с detailed=true...');
    const response = await fetch(`${SERVICE_URL}/api/transcribe`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`🔴 Ошибка API (${response.status}): ${errorText}`);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Результат расширенной транскрипции:');
    console.log(`  📝 Текст: "${result.text}"`);
    console.log(`  ⏱️ Время обработки: ${result.processingTime} сек`);
    console.log(`  🏷️ Модель: ${result.model}`);
  } catch (error) {
    console.error(`🔴 Ошибка при выполнении теста: ${error.message}`);
  }
}

/**
 * Основная функция
 */
async function main() {
  console.log('🚀 Запуск тестирования микросервиса с разными моделями транскрипции');
  
  let serviceProcess;
  
  try {
    // Проверяем, запущен ли уже сервис
    if (await isServiceReady()) {
      console.log('✅ Сервис уже запущен, используем его');
    } else {
      serviceProcess = await startService();
    }
    
    // Тесты с разными файлами
    for (const file of TEST_FILES) {
      if (!fs.existsSync(file)) {
        console.log(`⚠️ Файл не найден, пропускаем: ${file}`);
        continue;
      }
      
      // Выполняем тесты
      await testStandardTranscription(file);
      await testDetailedTranscription(file);
      await testComparisonEndpoint(file);
    }
    
    console.log('\n🏁 Тесты успешно завершены');
  } catch (error) {
    console.error(`🔴 Необработанная ошибка: ${error.message}`);
  } finally {
    // Останавливаем сервис только если мы его запустили
    if (serviceProcess) {
      stopService(serviceProcess);
    }
  }
}

// Запуск основной функции
main().catch(error => {
  console.error(`🔴 Фатальная ошибка: ${error.message}`);
});