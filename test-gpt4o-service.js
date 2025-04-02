/**
 * Тестирование микросервиса GPT-4o Audio
 * 
 * Этот скрипт запускает микросервис, тестирует его функциональность и затем останавливает
 */

import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import dotenv from 'dotenv';

// Загрузка переменных окружения
dotenv.config();

// Путь к директории микросервиса
const serviceDir = './services/gpt4o-audio-service';
// URL сервиса
const serviceUrl = 'http://localhost:3100';
// Путь к тестовому аудиофайлу
const testAudioFile = './test_audio/sample.wav';

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
  console.log('Запуск микросервиса GPT-4o Audio...');
  
  return new Promise((resolve, reject) => {
    const start = spawn('node', ['start-gpt4o-service.js'], {
      stdio: 'inherit'
    });
    
    start.on('exit', (code) => {
      if (code === 0) {
        console.log('Скрипт запуска выполнен успешно');
        // Даем время на запуск сервиса
        setTimeout(resolve, 2000);
      } else {
        reject(new Error(`Ошибка запуска сервиса, код: ${code}`));
      }
    });
  });
}

/**
 * Остановка микросервиса
 */
async function stopService() {
  console.log('Остановка микросервиса GPT-4o Audio...');
  
  return new Promise((resolve, reject) => {
    const stop = spawn('node', ['stop-gpt4o-service.js'], {
      stdio: 'inherit'
    });
    
    stop.on('exit', (code) => {
      if (code === 0) {
        console.log('Скрипт остановки выполнен успешно');
        resolve();
      } else {
        reject(new Error(`Ошибка остановки сервиса, код: ${code}`));
      }
    });
  });
}

/**
 * Проверка доступности сервиса
 */
async function checkHealth() {
  try {
    console.log('Проверка работоспособности сервиса...');
    
    const response = await fetch(`${serviceUrl}/health`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Статус сервиса:', data);
    
    if (!data.apiAvailable) {
      console.warn('⚠️ ВНИМАНИЕ: API OpenAI недоступен. Убедитесь, что API ключ установлен в переменной окружения OPENAI_API_KEY');
    }
    
    return data.status === 'ok';
  } catch (error) {
    console.error(`Ошибка при проверке сервиса: ${error.message}`);
    return false;
  }
}

/**
 * Тестирование транскрипции аудио
 */
async function testTranscription() {
  try {
    console.log(`Тестирование транскрипции аудиофайла: ${testAudioFile}`);
    
    // Проверяем наличие тестового файла
    if (!fs.existsSync(testAudioFile)) {
      // Если тестовый файл не существует, используем другой аудиофайл из директории
      const testDir = path.dirname(testAudioFile);
      if (fs.existsSync(testDir)) {
        const files = fs.readdirSync(testDir);
        const audioFiles = files.filter(file => 
          ['.mp3', '.wav', '.m4a', '.webm'].includes(path.extname(file).toLowerCase())
        );
        
        if (audioFiles.length > 0) {
          const alternativeFile = path.join(testDir, audioFiles[0]);
          console.log(`Используем альтернативный файл: ${alternativeFile}`);
          testTranscriptionWithFile(alternativeFile);
          return;
        }
      }
      
      console.error('Тестовый аудиофайл не найден!');
      return;
    }
    
    testTranscriptionWithFile(testAudioFile);
  } catch (error) {
    console.error(`Ошибка при тестировании транскрипции: ${error.message}`);
  }
}

/**
 * Тестирование транскрипции конкретного аудиофайла
 */
async function testTranscriptionWithFile(filePath) {
  try {
    // Проверяем доступность API ключа OpenAI
    if (!process.env.OPENAI_API_KEY) {
      console.error('API ключ OpenAI не установлен в переменных окружения!');
      console.log('Для тестирования необходимо установить переменную окружения OPENAI_API_KEY');
      return;
    }
    
    // Создаем FormData для отправки файла
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('optimize', 'true');
    formData.append('model', 'auto'); // auto = gpt-4o-audio-preview
    formData.append('preferredMethod', 'auto');
    formData.append('splitLargeFiles', 'true');
    
    console.log('Отправка запроса на транскрипцию...');
    
    // Отправляем запрос к сервису
    const response = await fetch(`${serviceUrl}/api/transcribe`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      let errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(`Ошибка при транскрипции: ${JSON.stringify(errorData)}`);
      } catch {
        throw new Error(`Ошибка при транскрипции: ${errorText}`);
      }
    }
    
    const result = await response.json();
    
    console.log('\n========== Результат транскрипции ==========');
    console.log(`Модель: ${result.model}`);
    console.log(`Длительность: ${result.duration ? Math.round(result.duration) + ' сек' : 'Неизвестно'}`);
    console.log(`Время обработки: ${result.processingTime}`);
    console.log(`Примерная стоимость: ${result.estimatedCost}`);
    console.log('-------------------------------------------');
    console.log('Транскрипция:');
    console.log(result.transcription);
    console.log('===========================================\n');
  } catch (error) {
    console.error(`Ошибка при тестировании транскрипции: ${error.message}`);
  }
}

/**
 * Основная функция тестирования
 */
async function runTest() {
  try {
    // Запуск сервиса
    await startService();
    
    // Ожидание запуска сервиса
    await sleep(2000);
    
    // Проверка работоспособности
    const isHealthy = await checkHealth();
    
    if (isHealthy) {
      // Тестирование транскрипции
      await testTranscription();
    } else {
      console.error('Сервис недоступен, тестирование транскрипции пропущено');
    }
    
    // Остановка сервиса
    await stopService();
    
    console.log('Тестирование завершено');
  } catch (error) {
    console.error(`Ошибка при тестировании: ${error.message}`);
    
    // Попытка остановить сервис в случае ошибки
    try {
      await stopService();
    } catch (e) {
      console.error(`Не удалось остановить сервис: ${e.message}`);
    }
  }
}

// Запуск тестирования
runTest();