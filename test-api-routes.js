/**
 * Тестирование API маршрутов
 * 
 * Этот скрипт проверяет работоспособность всех ключевых API маршрутов.
 */

import fetch from 'node-fetch';
import fs from 'fs';
import FormData from 'form-data';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Получаем путь к текущему файлу и директории
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Базовый URL API
const API_URL = 'http://localhost:5000/api';

// Функция для форматированного вывода в консоль
function log(message, type = 'info') {
  const types = {
    info: '📝',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    request: '📤',
    response: '📥'
  };
  
  const icon = types[type] || types.info;
  console.log(`${icon} ${message}`);
}

/**
 * Проверка работоспособности API
 */
async function testHealthEndpoint() {
  log('Тестирование эндпоинта /health...', 'info');
  
  try {
    const response = await fetch(`${API_URL}/health`);
    
    if (!response.ok) {
      log(`Ошибка при запросе: ${response.status} ${response.statusText}`, 'error');
      return false;
    }
    
    const data = await response.json();
    log(`Сервер работает: ${JSON.stringify(data)}`, 'success');
    return true;
  } catch (error) {
    log(`Не удалось подключиться к API: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Тестирование получения списка записей
 */
async function testGetRecordings() {
  log('Тестирование получения записей...', 'info');
  
  try {
    const response = await fetch(`${API_URL}/admin/recordings`);
    
    if (!response.ok) {
      log(`Ошибка при запросе: ${response.status} ${response.statusText}`, 'error');
      return;
    }
    
    const recordings = await response.json();
    
    log(`Получено ${recordings.length} записей`, 'success');
    
    // Выводим информацию о первых 3 записях
    if (recordings.length > 0) {
      const recentRecordings = recordings.slice(0, 3);
      
      log('Последние записи:', 'info');
      recentRecordings.forEach((recording, index) => {
        log(`${index + 1}. ID: ${recording.id}, Время: ${recording.timestamp}, Статус: ${recording.status}`, 'info');
      });
    }
  } catch (error) {
    log(`Ошибка при получении записей: ${error.message}`, 'error');
  }
}

/**
 * Тестирование транскрипции с моделью Whisper
 */
async function testWhisperTranscription() {
  log('Тестирование транскрипции с Whisper...', 'info');
  
  // Путь к тестовому аудио
  const testAudioPath = path.join(__dirname, 'test_audio', 'short_test.mp3');
  
  // Проверяем наличие тестового файла
  if (!fs.existsSync(testAudioPath)) {
    log('Тестовый аудиофайл не найден. Создайте директорию test_audio и добавьте файл short_test.mp3', 'error');
    return;
  }
  
  try {
    // Создаем форму для отправки файла
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testAudioPath));
    formData.append('model', 'whisper-1');
    formData.append('language', 'ru');
    
    log('Отправка запроса на транскрипцию...', 'request');
    
    const response = await fetch(`${API_URL}/transcribe`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`Ошибка при транскрипции: ${response.status} ${response.statusText}`, 'error');
      log(`Детали ошибки: ${errorText}`, 'error');
      return;
    }
    
    const result = await response.json();
    
    log('Результат транскрипции:', 'response');
    log(`Текст: ${result.text}`, 'success');
    log(`Модель: ${result.model}`, 'info');
    log(`Время обработки: ${result.processingTime} сек`, 'info');
  } catch (error) {
    log(`Ошибка при тестировании транскрипции: ${error.message}`, 'error');
  }
}

/**
 * Тестирование сравнительной транскрипции с разными моделями
 */
async function testComparisonTranscription() {
  log('Тестирование сравнительной транскрипции...', 'info');
  
  // Путь к тестовому аудио
  const testAudioPath = path.join(__dirname, 'test_audio', 'short_test.mp3');
  
  // Проверяем наличие тестового файла
  if (!fs.existsSync(testAudioPath)) {
    log('Тестовый аудиофайл не найден. Создайте директорию test_audio и добавьте файл short_test.mp3', 'error');
    return;
  }
  
  try {
    // Создаем форму для отправки файла
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testAudioPath));
    formData.append('language', 'ru');
    
    log('Отправка запроса на сравнительную транскрипцию...', 'request');
    
    const response = await fetch(`${API_URL}/transcribe/compare`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`Ошибка при сравнительной транскрипции: ${response.status} ${response.statusText}`, 'error');
      log(`Детали ошибки: ${errorText}`, 'error');
      return;
    }
    
    const result = await response.json();
    
    log('Результаты сравнительной транскрипции:', 'response');
    
    // Проверяем результаты каждой модели
    for (const [model, data] of Object.entries(result.results)) {
      if (data.error) {
        log(`${model}: Ошибка - ${data.error}`, 'error');
      } else {
        log(`${model}: "${data.text}"`, 'success');
        log(`  Время обработки: ${data.processingTime} сек`, 'info');
      }
    }
  } catch (error) {
    log(`Ошибка при тестировании сравнительной транскрипции: ${error.message}`, 'error');
  }
}

/**
 * Тестирование диаризации с сравнительной транскрипцией
 */
async function testDiarizationCompare() {
  log('Тестирование диаризации с сравнительной транскрипцией...', 'info');
  
  // Путь к тестовому аудио с диалогом
  const testAudioPath = path.join(__dirname, 'test_audio', 'dialog_test.mp3');
  
  // Проверяем наличие тестового файла
  if (!fs.existsSync(testAudioPath)) {
    log('Тестовый аудиофайл не найден. Создайте директорию test_audio и добавьте файл dialog_test.mp3', 'error');
    return;
  }
  
  try {
    // Создаем форму для отправки файла
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testAudioPath));
    formData.append('minSpeakers', '2');
    formData.append('maxSpeakers', '4');
    
    log('Отправка запроса на диаризацию с транскрипцией...', 'request');
    
    const response = await fetch(`${API_URL}/diarize/compare`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`Ошибка при диаризации: ${response.status} ${response.statusText}`, 'error');
      log(`Детали ошибки: ${errorText}`, 'error');
      return;
    }
    
    const result = await response.json();
    
    log('Результаты диаризации с транскрипцией:', 'response');
    log(`Количество говорящих: ${result.metadata.num_speakers}`, 'info');
    log(`Количество сегментов: ${result.metadata.total_segments}`, 'info');
    
    // Выводим первые 3 сегмента
    const segments = result.segments.slice(0, 3);
    segments.forEach((segment, index) => {
      log(`Сегмент ${index + 1} (Говорящий ${segment.speaker}):`, 'info');
      log(`  Whisper: "${segment.transcriptions.whisper}"`, 'info');
      log(`  GPT-4o-mini: "${segment.transcriptions.gpt4o_mini}"`, 'info');
      log(`  GPT-4o: "${segment.transcriptions.gpt4o}"`, 'info');
    });
  } catch (error) {
    log(`Ошибка при тестировании диаризации: ${error.message}`, 'error');
  }
}

/**
 * Основная функция
 */
async function main() {
  log('Начало тестирования API маршрутов', 'info');
  
  // Сначала проверяем доступность API
  const isApiAvailable = await testHealthEndpoint();
  
  if (!isApiAvailable) {
    log('API недоступен, прерываем тестирование', 'error');
    return;
  }
  
  // Тестируем API админки
  await testGetRecordings();
  
  // Тестируем API транскрипции
  await testWhisperTranscription();
  
  // Тестируем API сравнительной транскрипции
  await testComparisonTranscription();
  
  // Тестируем API диаризации с сравнительной транскрипцией
  await testDiarizationCompare();
  
  log('Тестирование API маршрутов завершено', 'info');
}

// Запускаем тестирование
main().catch(error => {
  log(`Критическая ошибка при тестировании: ${error.stack || error.message}`, 'error');
});