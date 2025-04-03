/**
 * Быстрое тестирование микросервиса аудио-диаризации
 * без запуска/остановки сервиса
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

// URL сервиса
const SERVICE_URL = 'http://localhost:5001';

// Директория для тестовых аудиофайлов
const TEST_AUDIO_DIR = path.join(__dirname, 'test_audio');

/**
 * Проверка доступности сервиса
 */
async function checkHealth() {
  try {
    const response = await axios.get(`${SERVICE_URL}/health`);
    console.log('Статус сервиса:', response.data);
    return response.data.status === 'ok';
  } catch (error) {
    console.error('Ошибка при проверке сервиса:', error.message);
    return false;
  }
}

/**
 * Тестирование диаризации аудио
 */
async function testDiarization(audioFile) {
  try {
    console.log(`Тестирование диаризации для файла: ${audioFile}`);
    
    // Проверяем существование файла
    if (!fs.existsSync(audioFile)) {
      throw new Error(`Файл не найден: ${audioFile}`);
    }
    
    // Создаем форму для отправки файла
    const form = new FormData();
    form.append('audio', fs.createReadStream(audioFile));
    form.append('min_speakers', 1);
    form.append('max_speakers', 5);
    
    // Отправляем запрос на диаризацию
    const startTime = Date.now();
    const response = await axios.post(`${SERVICE_URL}/diarize`, form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 60000, // 60 секунд таймаут
    });
    const elapsedTime = (Date.now() - startTime) / 1000;
    
    console.log(`Диаризация завершена за ${elapsedTime.toFixed(2)} секунд`);
    console.log(`Обнаружено говорящих: ${response.data.num_speakers}`);
    console.log('Сегменты:');
    
    response.data.segments.forEach((segment, index) => {
      console.log(`  ${index + 1}. Говорящий ${segment.speaker}, время: ${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s (${(segment.end - segment.start).toFixed(2)}s)`);
    });
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при тестировании диаризации:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
    throw error;
  }
}

/**
 * Основная функция тестирования
 */
async function runTest() {
  try {
    console.log('Запуск теста диаризации...');
    
    // Проверяем доступность сервиса
    const isHealthy = await checkHealth();
    if (!isHealthy) {
      console.error('Сервис аудио-диаризации недоступен');
      return;
    }
    
    // Пути к тестовым аудиофайлам
    const singleSpeakerPath = path.join(TEST_AUDIO_DIR, 'sample.mp3');
    const multiSpeakerPath = path.join(TEST_AUDIO_DIR, 'multi_speaker.mp3');
    
    // Тестируем диаризацию
    console.log('\n=== Тест 1: Один говорящий ===');
    await testDiarization(singleSpeakerPath);
    
    console.log('\n=== Тест 2: Несколько говорящих ===');
    await testDiarization(multiSpeakerPath);
    
    console.log('\nТесты успешно завершены');
    
  } catch (error) {
    console.error('Ошибка при тестировании:', error);
  }
}

// Запускаем тесты
runTest();