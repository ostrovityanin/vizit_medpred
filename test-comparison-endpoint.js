/**
 * Тест сравнительного API для транскрипции
 * 
 * Этот скрипт тестирует endpoint /api/transcribe/compare,
 * который сравнивает результаты транскрипции от всех трех моделей.
 */

import fs from 'fs';
import path from 'path';
import { FormData } from 'formdata-node';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

// ES модули не имеют доступа к __dirname, создаем аналог
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Настройки сервиса
const SERVICE_URL = 'http://localhost:3100';
const TEST_AUDIO = './test_audio/test_ru.mp3';

/**
 * Проверка доступности сервиса
 * @returns {Promise<boolean>} Результат проверки
 */
async function checkServiceAvailability() {
  try {
    console.log(`Проверка доступности микросервиса на ${SERVICE_URL}/health...`);
    const response = await fetch(`${SERVICE_URL}/health`);
    if (response.ok) {
      const data = await response.json();
      console.log(`Микросервис доступен: ${data.message}, версия ${data.version}`);
      return true;
    } else {
      console.error(`Микросервис недоступен: HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`Ошибка при проверке доступности: ${error.message}`);
    return false;
  }
}

/**
 * Тестирование эндпоинта сравнения моделей транскрипции
 */
async function testComparisonEndpoint() {
  try {
    console.log(`\nТестирование сравнительного API с файлом: ${TEST_AUDIO}`);
    
    // Проверяем существование тестового файла
    if (!fs.existsSync(TEST_AUDIO)) {
      console.error(`Тестовый файл не найден: ${TEST_AUDIO}`);
      return;
    }
    
    // Создаем объект FormData для отправки файла
    const form = new FormData();
    form.append('audio', fs.createReadStream(TEST_AUDIO));
    form.append('language', 'ru');
    
    console.log('Отправка запроса на сравнительную транскрипцию...');
    const startTime = Date.now();
    
    // Отправляем запрос
    const response = await fetch(`${SERVICE_URL}/api/transcribe/compare`, {
      method: 'POST',
      body: form
    });
    
    const elapsedTime = (Date.now() - startTime) / 1000;
    
    if (response.ok) {
      const data = await response.json();
      console.log(`\nСравнительная транскрипция выполнена за ${elapsedTime.toFixed(2)} секунд`);
      
      console.log('\n=== Результаты сравнения моделей ===');
      console.log('-'.repeat(80));
      console.log('| Модель                | Время (сек) | Результат');
      console.log('-'.repeat(80));
      
      for (const [model, result] of Object.entries(data.results)) {
        if (result.text) {
          console.log(`| ${model.padEnd(22)} | ${result.processingTime.toFixed(2).padStart(11)} | ${result.text}`);
        } else {
          console.log(`| ${model.padEnd(22)} | ${'-'.padStart(11)} | Ошибка: ${result.error}`);
        }
      }
      
      console.log('-'.repeat(80));
      console.log(`Общее время обработки: ${data.totalProcessingTime.toFixed(2)} секунд`);
    } else {
      const errorText = await response.text();
      console.error(`Ошибка при запросе: HTTP ${response.status}\n${errorText}`);
    }
  } catch (error) {
    console.error(`Ошибка при тестировании сравнительного API: ${error.message}`);
  }
}

/**
 * Основная функция
 */
async function main() {
  console.log('=== Тестирование сравнительного API для транскрипции ===');
  
  // Проверяем доступность сервиса
  const isAvailable = await checkServiceAvailability();
  if (!isAvailable) {
    console.error('Микросервис недоступен. Запустите его с помощью run-gpt4o-service.sh');
    return;
  }
  
  // Тестируем сравнительный API
  await testComparisonEndpoint();
}

main();