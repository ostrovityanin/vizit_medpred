/**
 * Модуль для взаимодействия с микросервисом диаризации
 * 
 * Этот модуль предоставляет API для взаимодействия с микросервисом 
 * диаризации, проверки его состояния и обработки аудиофайлов.
 */

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Получаем путь к текущей директории (для ES модулей)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);

// Конфигурация сервиса
const DIARIZATION_SERVICE_URL = 'http://localhost:5050';
const SERVICE_DIR = path.join(__dirname, '..', '..', '..', 'services', 'audio-diarization');
const LOG_FILE = path.join(__dirname, '..', '..', '..', 'diarization-service.log');
const PID_FILE = path.join(__dirname, '..', '..', '..', 'diarization-service.pid');

// Максимальное количество попыток для проверки состояния сервиса
const MAX_HEALTH_CHECK_ATTEMPTS = 5;
const HEALTH_CHECK_INTERVAL = 1000; // 1 секунда

/**
 * Проверяет здоровье сервиса диаризации
 * @returns {Promise<object|null>} Информация о состоянии сервиса или null в случае ошибки
 */
async function checkServiceHealth() {
  try {
    const response = await axios.get(`${DIARIZATION_SERVICE_URL}/health`, { 
      timeout: 2000 
    });
    
    if (response.status === 200 && response.data.status === 'ok') {
      return response.data;
    }
    return null;
  } catch (error) {
    console.error(`Error checking diarization service health: ${error.message}`);
    return null;
  }
}

/**
 * Проверяет, запущен ли сервис диаризации
 * @returns {Promise<boolean>} Запущен ли сервис
 */
async function isServiceRunning() {
  try {
    // Проверяем PID файл
    if (fs.existsSync(PID_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
      
      // Проверяем существование процесса в системе
      try {
        process.kill(pid, 0); // Проверка существования процесса без отправки сигнала
        
        // Проверяем, что сервис отвечает на HTTP запросы
        const health = await checkServiceHealth();
        return health !== null;
      } catch (e) {
        // Процесс не существует
        return false;
      }
    }
    return false;
  } catch (error) {
    console.error(`Error checking if diarization service is running: ${error.message}`);
    return false;
  }
}

/**
 * Запускает сервис диаризации
 * @param {boolean} useSimplifiedVersion Использовать ли упрощенную версию сервиса
 * @returns {Promise<boolean>} Успешно ли запущен сервис
 */
async function startService(useSimplifiedVersion = true) {
  try {
    console.log('Starting diarization service...');
    
    // Если сервис уже запущен, возвращаем true
    if (await isServiceRunning()) {
      console.log('Diarization service is already running.');
      return true;
    }
    
    // Запускаем скрипт запуска сервиса
    const scriptName = useSimplifiedVersion ? 
      path.join(__dirname, '..', '..', '..', 'start-simplified-diarization-service.js') : 
      path.join(__dirname, '..', '..', '..', 'start-diarization-service.js');
    
    if (!fs.existsSync(scriptName)) {
      console.error(`Service start script not found: ${scriptName}`);
      return false;
    }
    
    // Запускаем скрипт в отдельном процессе
    const { stdout, stderr } = await execAsync(`node ${scriptName}`);
    console.log('Service start script output:', stdout);
    
    if (stderr) {
      console.error('Service start script error:', stderr);
    }
    
    // Проверяем, запустился ли сервис
    for (let i = 0; i < MAX_HEALTH_CHECK_ATTEMPTS; i++) {
      await new Promise(resolve => setTimeout(resolve, HEALTH_CHECK_INTERVAL));
      
      if (await isServiceRunning()) {
        console.log('Diarization service started successfully.');
        return true;
      }
    }
    
    console.error('Failed to start diarization service after multiple attempts.');
    return false;
  } catch (error) {
    console.error(`Error starting diarization service: ${error.message}`);
    return false;
  }
}

/**
 * Останавливает сервис диаризации
 * @returns {Promise<boolean>} Успешно ли остановлен сервис
 */
async function stopService() {
  try {
    console.log('Stopping diarization service...');
    
    // Если сервис не запущен, возвращаем true
    if (!(await isServiceRunning())) {
      console.log('Diarization service is not running.');
      return true;
    }
    
    // Запускаем скрипт остановки сервиса
    const scriptName = path.join(__dirname, '..', '..', '..', 'stop-simplified-diarization-service.js');
    
    if (!fs.existsSync(scriptName)) {
      console.error(`Service stop script not found: ${scriptName}`);
      return false;
    }
    
    // Запускаем скрипт в отдельном процессе
    const { stdout, stderr } = await execAsync(`node ${scriptName}`);
    console.log('Service stop script output:', stdout);
    
    if (stderr) {
      console.error('Service stop script error:', stderr);
    }
    
    // Проверяем, остановился ли сервис
    if (await isServiceRunning()) {
      console.error('Failed to stop diarization service.');
      return false;
    }
    
    console.log('Diarization service stopped successfully.');
    return true;
  } catch (error) {
    console.error(`Error stopping diarization service: ${error.message}`);
    return false;
  }
}

/**
 * Выполняет диаризацию аудиофайла
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {object} options Дополнительные параметры
 * @param {number} options.minSpeakers Минимальное количество говорящих (по умолчанию 1)
 * @param {number} options.maxSpeakers Максимальное количество говорящих (по умолчанию 10)
 * @returns {Promise<object>} Результат диаризации
 */
async function diarizeAudio(audioFilePath, options = {}) {
  try {
    console.log(`Diarizing audio file: ${audioFilePath}`);
    
    // Проверяем, существует ли файл
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }
    
    // Проверяем, запущен ли сервис
    if (!(await isServiceRunning())) {
      console.log('Diarization service is not running. Attempting to start...');
      const started = await startService();
      
      if (!started) {
        throw new Error('Failed to start diarization service.');
      }
    }
    
    // Создаем FormData для отправки файла
    const formData = new FormData();
    formData.append('audio_file', fs.createReadStream(audioFilePath));
    
    // Добавляем дополнительные параметры
    const minSpeakers = options.minSpeakers || 1;
    const maxSpeakers = options.maxSpeakers || 10;
    
    formData.append('min_speakers', minSpeakers.toString());
    formData.append('max_speakers', maxSpeakers.toString());
    
    // Отправляем запрос на диаризацию
    const response = await axios.post(`${DIARIZATION_SERVICE_URL}/diarize`, formData, {
      headers: formData.getHeaders(),
      timeout: 30000, // 30 секунд на обработку
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    // Проверяем успешность ответа
    if (response.status === 200 && response.data.status === 'success') {
      console.log('Diarization completed successfully.');
      return response.data;
    } else {
      throw new Error(`Diarization failed: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error(`Error during diarization: ${error.message}`);
    throw error;
  }
}

export {
  checkServiceHealth,
  isServiceRunning,
  startService,
  stopService,
  diarizeAudio
};