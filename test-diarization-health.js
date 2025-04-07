/**
 * Тестирование доступности сервиса диаризации
 */

import axios from 'axios';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

// Определение путей для ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// URL и порт сервиса диаризации
const DIARIZATION_SERVICE_URL = 'http://localhost:5050';
const SERVICE_DIR = path.join(__dirname, 'services', 'audio-diarization');

/**
 * Запускает микросервис диаризации и возвращает процесс
 * @returns {Promise<Object>} Объект с информацией о процессе
 */
async function startDiarizationService() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Запуск микросервиса диаризации...');
    
    const python = process.platform === 'win32' ? 'python' : 'python3';
    const serviceProcess = spawn(python, ['run.py'], {
      cwd: SERVICE_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1'
      }
    });
    
    console.log(`✅ Процесс запущен с PID: ${serviceProcess.pid}`);
    
    // Логируем stdout
    serviceProcess.stdout.on('data', (data) => {
      console.log(`[Диаризация] ${data.toString().trim()}`);
    });
    
    // Логируем stderr
    serviceProcess.stderr.on('data', (data) => {
      console.error(`[Диаризация ERR] ${data.toString().trim()}`);
    });
    
    // Проверяем доступность сервиса
    let attempts = 0;
    const maxAttempts = 10;
    const checkInterval = setInterval(async () => {
      try {
        attempts++;
        const response = await axios.get(`${DIARIZATION_SERVICE_URL}/health`, { timeout: 1000 });
        
        if (response.status === 200) {
          clearInterval(checkInterval);
          console.log(`✅ Сервис диаризации доступен после ${attempts} попытки`);
          console.log(`   - Статус: ${response.data.status}`);
          console.log(`   - Время работы: ${response.data.uptime.toFixed(2)} сек`);
          
          // Возвращаем объект с процессом и информацией
          resolve({
            process: serviceProcess,
            pid: serviceProcess.pid,
            url: DIARIZATION_SERVICE_URL,
            status: response.data
          });
        }
      } catch (error) {
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          console.error(`❌ Не удалось дождаться запуска сервиса после ${maxAttempts} попыток`);
          
          // Завершаем процесс
          try {
            serviceProcess.kill();
          } catch (killError) {
            console.error(`   - Ошибка при завершении процесса: ${killError.message}`);
          }
          
          reject(new Error(`Сервис не запустился после ${maxAttempts} попыток`));
        } else {
          console.log(`⏳ Ожидание запуска сервиса (попытка ${attempts}/${maxAttempts})...`);
        }
      }
    }, 1000);
    
    // Устанавливаем таймаут на запуск
    setTimeout(() => {
      clearInterval(checkInterval);
      if (attempts >= maxAttempts) {
        console.error(`⏱️ Превышено время ожидания запуска сервиса (${maxAttempts} секунд)`);
        reject(new Error('Превышено время ожидания запуска сервиса'));
      }
    }, (maxAttempts + 1) * 1000);
    
    // Обрабатываем завершение процесса
    serviceProcess.on('close', (code) => {
      if (code !== 0) {
        clearInterval(checkInterval);
        console.error(`❌ Процесс завершился с кодом: ${code}`);
        reject(new Error(`Процесс завершился с кодом: ${code}`));
      }
    });
  });
}

/**
 * Останавливает процесс микросервиса
 * @param {Object} serviceInfo Информация о сервисе
 */
function stopDiarizationService(serviceInfo) {
  try {
    console.log(`🛑 Остановка микросервиса диаризации (PID: ${serviceInfo.pid})...`);
    
    if (serviceInfo.process) {
      serviceInfo.process.kill();
      console.log('✅ Микросервис остановлен');
    }
  } catch (error) {
    console.error(`❌ Ошибка при остановке микросервиса: ${error.message}`);
  }
}

/**
 * Главная функция для проверки доступности сервиса
 */
async function runHealthTest() {
  console.log('🔬 Проверка доступности сервиса диаризации\n');
  
  let serviceInfo = null;
  
  try {
    // Шаг 1: Запускаем микросервис диаризации
    serviceInfo = await startDiarizationService();
    
    // Шаг 2: Повторно проверяем здоровье сервиса с интервалом в 1 секунду
    for (let i = 0; i < 5; i++) {
      try {
        const response = await axios.get(`${DIARIZATION_SERVICE_URL}/health`, { timeout: 1000 });
        console.log(`\n📊 Проверка #${i+1}:`);
        console.log(`   - Статус: ${response.data.status}`);
        console.log(`   - Время работы: ${response.data.uptime.toFixed(2)} сек`);
        console.log(`   - Временная метка: ${response.data.timestamp}`);
      } catch (error) {
        console.error(`❌ Ошибка при проверке #${i+1}: ${error.message}`);
      }
      
      if (i < 4) {
        console.log(`\n⏳ Ожидание 1 секунду...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('\n✅ Тестирование доступности успешно завершено');
  } catch (error) {
    console.error(`\n❌ Ошибка при выполнении тестирования: ${error.message}`);
  } finally {
    // Шаг 3: Останавливаем микросервис
    if (serviceInfo) {
      stopDiarizationService(serviceInfo);
    }
  }
}

// Запускаем тестирование доступности
runHealthTest();