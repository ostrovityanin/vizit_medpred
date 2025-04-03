/**
 * Тестирование микросервиса аудио-диаризации
 * 
 * Этот скрипт запускает микросервис, тестирует его функциональность и затем останавливает
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// URL микросервиса
const SERVICE_URL = 'http://localhost:5001';
const HEALTH_URL = `${SERVICE_URL}/health`;
const DIARIZE_URL = `${SERVICE_URL}/diarize`;

// Путь к тестовому аудиофайлу
const TEST_AUDIO_FILE = path.join(__dirname, 'test_audio', 'sample.mp3');

/**
 * Задержка выполнения
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Запуск микросервиса
 */
async function startService() {
  console.log('Запуск микросервиса аудио-диаризации...');
  
  // Запускаем скрипт start-diarization-service.js
  const startScript = path.join(__dirname, 'start-diarization-service.js');
  const startProcess = spawn('node', [startScript]);
  
  // Выводим лог запуска
  startProcess.stdout.on('data', (data) => {
    console.log(`[Запуск] ${data.toString().trim()}`);
  });
  
  startProcess.stderr.on('data', (data) => {
    console.error(`[Запуск ERR] ${data.toString().trim()}`);
  });
  
  await new Promise((resolve) => {
    startProcess.on('close', (code) => {
      console.log(`Скрипт запуска завершился с кодом: ${code}`);
      resolve();
    });
  });
  
  // Даем время на запуск микросервиса
  console.log('Ожидание запуска микросервиса...');
  await sleep(3000);
}

/**
 * Остановка микросервиса
 */
async function stopService() {
  console.log('Остановка микросервиса аудио-диаризации...');
  
  // Запускаем скрипт stop-diarization-service.js
  const stopScript = path.join(__dirname, 'stop-diarization-service.js');
  const stopProcess = spawn('node', [stopScript]);
  
  // Выводим лог остановки
  stopProcess.stdout.on('data', (data) => {
    console.log(`[Остановка] ${data.toString().trim()}`);
  });
  
  stopProcess.stderr.on('data', (data) => {
    console.error(`[Остановка ERR] ${data.toString().trim()}`);
  });
  
  await new Promise((resolve) => {
    stopProcess.on('close', (code) => {
      console.log(`Скрипт остановки завершился с кодом: ${code}`);
      resolve();
    });
  });
  
  // Даем время на остановку микросервиса
  await sleep(2000);
}

/**
 * Проверка доступности сервиса
 */
async function checkHealth() {
  try {
    console.log('Проверка доступности микросервиса...');
    const response = await axios.get(HEALTH_URL);
    
    if (response.status === 200 && response.data.status === 'ok') {
      console.log('Микросервис доступен и работает');
      console.log(`Версия: ${response.data.version}`);
      console.log(`Сервис: ${response.data.service}`);
      return true;
    } else {
      console.error('Микросервис отвечает, но статус не "ok"');
      console.error('Ответ сервиса:', response.data);
      return false;
    }
  } catch (error) {
    console.error('Ошибка при проверке доступности микросервиса:');
    if (error.response) {
      console.error('Статус ответа:', error.response.status);
      console.error('Данные ответа:', error.response.data);
    } else {
      console.error('Ошибка:', error.message);
    }
    return false;
  }
}

/**
 * Тестирование диаризации аудио
 */
async function testDiarization(audioFile) {
  try {
    console.log(`Тестирование диаризации файла: ${audioFile}`);
    
    // Проверяем существует ли файл
    if (!fs.existsSync(audioFile)) {
      console.error(`Файл не найден: ${audioFile}`);
      console.log('Сначала сгенерируйте тестовый файл с помощью generate-test-audio.js');
      return false;
    }
    
    // Создаем FormData для отправки файла
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFile));
    formData.append('min_speakers', 2);
    formData.append('max_speakers', 5);
    
    console.log('Отправка запроса на диаризацию...');
    
    // Отправляем запрос
    const startTime = Date.now();
    const response = await axios.post(DIARIZE_URL, formData, {
      headers: {
        ...formData.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    const endTime = Date.now();
    
    console.log(`Запрос выполнен за ${(endTime - startTime) / 1000} секунд\n`);
    
    // Выводим результат
    console.log('Результат диаризации:');
    console.log(`- Обнаружено ${response.data.speakers.length} говорящих`);
    console.log(`- Найдено ${response.data.segments.length} сегментов речи`);
    console.log(`- Время обработки: ${response.data.processing_time.toFixed(2)} сек`);
    
    // Выводим детали первых 5 сегментов
    console.log('\nПримеры сегментов:');
    for (let i = 0; i < Math.min(5, response.data.segments.length); i++) {
      const segment = response.data.segments[i];
      console.log(`Сегмент ${i+1}: Говорящий ${segment.speaker}, ${segment.start.toFixed(2)}-${segment.end.toFixed(2)} сек (${(segment.end - segment.start).toFixed(2)} сек)`);
    }
    
    return true;
  } catch (error) {
    console.error('Ошибка при тестировании диаризации:');
    if (error.response) {
      console.error('Статус ответа:', error.response.status);
      console.error('Данные ответа:', error.response.data);
    } else {
      console.error('Ошибка:', error.message);
    }
    return false;
  }
}

/**
 * Основная функция тестирования
 */
async function runTest() {
  let serviceStarted = false;
  
  try {
    // Проверяем наличие тестового аудиофайла
    if (!fs.existsSync(TEST_AUDIO_FILE)) {
      console.error(`Тестовый аудиофайл не найден: ${TEST_AUDIO_FILE}`);
      console.log('Сначала создайте тестовый аудиофайл:');
      console.log('  node generate-test-audio.js');
      return;
    }
    
    // Запускаем микросервис
    await startService();
    serviceStarted = true;
    
    // Проверяем доступность сервиса
    const isHealthy = await checkHealth();
    if (!isHealthy) {
      console.error('Микросервис не отвечает на запросы. Тестирование прервано.');
      return;
    }
    
    // Тестируем диаризацию
    console.log('\n===== Тестирование диаризации аудио =====\n');
    const result = await testDiarization(TEST_AUDIO_FILE);
    
    if (result) {
      console.log('\n✅ Тестирование успешно завершено. Микросервис аудио-диаризации работает корректно.');
    } else {
      console.error('\n❌ Тестирование завершено с ошибками. Микросервис аудио-диаризации работает некорректно.');
    }
  } catch (error) {
    console.error('Общая ошибка при тестировании микросервиса:', error);
  } finally {
    // Останавливаем микросервис, если он был запущен
    if (serviceStarted) {
      await stopService();
    }
  }
}

// Запускаем тестирование
runTest().catch(console.error);