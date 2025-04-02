/**
 * Тестирование микросервиса GPT-4o Audio
 * 
 * Этот скрипт запускает микросервис, тестирует его функциональность и затем останавливает
 */
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// Получаем путь к текущему файлу и директории
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к тестовому аудиофайлу
// Используем реальный записанный с микрофона файл
const sampleAudioPath = path.join(__dirname, 'server', 'uploads', 'dbbdcdc0-3e44-49d8-96c4-07afe0f3943d.wav');
// URL микросервиса
const serviceUrl = 'http://localhost:3200';
// Путь к директории микросервиса
const servicePath = path.join(__dirname, 'services', 'gpt4o-audio-service');
// PID файл
const pidFile = path.join(__dirname, 'gpt4o-service.pid');

/**
 * Задержка выполнения
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Запуск микросервиса
 */
async function startService() {
  console.log('Запуск микросервиса GPT-4o Audio...');
  
  const child = spawn('node', ['src/index.js'], {
    cwd: servicePath,
    detached: true,
    stdio: 'inherit'
  });
  
  // Сохранение PID процесса
  fs.writeFileSync(pidFile, child.pid.toString());
  
  console.log(`Микросервис запущен с PID: ${child.pid}`);
  
  // Освобождаем процесс от родительского
  child.unref();
  
  // Ждем несколько секунд для запуска сервиса
  await delay(5000);
}

/**
 * Остановка микросервиса
 */
async function stopService() {
  // Проверка существования PID файла
  if (!fs.existsSync(pidFile)) {
    console.error('Файл PID не найден. Возможно, сервис не запущен.');
    return;
  }

  // Чтение PID из файла
  const pid = fs.readFileSync(pidFile, 'utf-8').trim();

  try {
    // Отправка сигнала завершения процессу
    process.kill(parseInt(pid), 'SIGTERM');
    console.log(`Отправлен сигнал завершения процессу с PID: ${pid}`);
    
    // Удаление PID файла
    fs.unlinkSync(pidFile);
    console.log('Микросервис GPT-4o Audio успешно остановлен.');
  } catch (err) {
    console.error(`Ошибка при остановке микросервиса: ${err.message}`);
    
    // Если процесс не существует, удаляем PID файл
    if (err.code === 'ESRCH') {
      fs.unlinkSync(pidFile);
      console.log('PID файл удален.');
    }
  }
}

/**
 * Проверка доступности сервиса
 */
async function checkHealth() {
  try {
    console.log('Проверка доступности сервиса...');
    const response = await fetch(`${serviceUrl}/health`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Сервис доступен:', data);
      return true;
    } else {
      console.error(`Сервис недоступен. Статус: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('Ошибка при проверке сервиса:', error.message);
    return false;
  }
}

/**
 * Тестирование транскрипции аудио
 */
async function testTranscription() {
  try {
    console.log('Тестирование транскрипции аудио...');
    
    // Проверка существования тестового файла
    if (!fs.existsSync(sampleAudioPath)) {
      console.error(`Тестовый файл не найден: ${sampleAudioPath}`);
      return false;
    }
    
    // Создаем FormData для отправки файла
    const formData = new FormData();
    formData.append('audioFile', fs.createReadStream(sampleAudioPath));
    formData.append('optimize', 'false'); // Отключаем оптимизацию для тестирования
    
    // Отправляем запрос на транскрипцию
    const response = await fetch(`${serviceUrl}/api/transcribe`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Результат транскрипции:', result);
      return true;
    } else {
      const error = await response.text();
      console.error(`Ошибка при транскрипции. Статус: ${response.status}`, error);
      return false;
    }
  } catch (error) {
    console.error('Ошибка при тестировании транскрипции:', error.message);
    return false;
  }
}

/**
 * Основная функция тестирования
 */
async function runTest() {
  try {
    // Запуск сервиса
    await startService();
    
    // Проверка доступности
    if (await checkHealth()) {
      // Тестирование транскрипции
      await testTranscription();
    }
  } catch (error) {
    console.error('Ошибка при тестировании:', error.message);
  } finally {
    // Остановка сервиса
    await stopService();
  }
}

// Запуск тестирования
runTest();