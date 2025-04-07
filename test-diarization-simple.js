/**
 * Упрощенный скрипт для тестирования диаризации
 * 
 * Этот скрипт:
 * 1. Запускает микросервис диаризации
 * 2. Выполняет тестирование диаризации
 * 3. Останавливает микросервис
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';

// Определение путей для ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// URL и порт сервиса диаризации
const DIARIZATION_SERVICE_URL = 'http://localhost:5050';
const SERVICE_DIR = path.join(__dirname, 'services', 'audio-diarization');

// Путь к тестовому аудиофайлу
const TEST_AUDIO_FILE = path.join(__dirname, 'test_audio', 'test.mp3');

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
 * Тестирование диаризации аудио
 * @param {string} audioFile Путь к аудиофайлу
 */
async function testDiarization(audioFile) {
  try {
    console.log(`🔍 Тестирование диаризации для файла: ${audioFile}`);
    
    if (!fs.existsSync(audioFile)) {
      console.error(`❌ Файл не найден: ${audioFile}`);
      return;
    }
    
    const formData = new FormData();
    formData.append('audio_file', fs.createReadStream(audioFile));
    formData.append('min_speakers', 2);
    formData.append('max_speakers', 5);
    
    console.log(`🚀 Отправка запроса на диаризацию...`);
    
    const response = await axios.post(
      `${DIARIZATION_SERVICE_URL}/diarize`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    console.log(`✅ Диаризация выполнена успешно:`);
    console.log(`   - Количество говорящих: ${response.data.num_speakers}`);
    console.log(`   - Длительность аудио: ${response.data.duration.toFixed(2)} сек`);
    console.log(`   - Количество сегментов: ${response.data.segments.length}`);
    
    // Выводим первые 3 сегмента для примера
    console.log(`\n📝 Примеры сегментов:`);
    
    const sampleSegments = response.data.segments.slice(0, 3);
    for (const segment of sampleSegments) {
      console.log(`   - Говорящий ${segment.speaker}, с ${segment.start.toFixed(2)}с до ${segment.end.toFixed(2)}с (${(segment.end - segment.start).toFixed(2)}с)`);
    }
    
    // Сохраняем полный результат в файл
    const resultPath = path.join(__dirname, 'diarization-result.json');
    fs.writeFileSync(resultPath, JSON.stringify(response.data, null, 2));
    
    console.log(`\n💾 Полный результат сохранен в файл: ${resultPath}`);
    
    return response.data;
  } catch (error) {
    console.error(`❌ Ошибка при тестировании диаризации:`);
    
    if (error.response) {
      console.error(`   - Статус ошибки: ${error.response.status}`);
      console.error(`   - Сообщение: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`   - ${error.message}`);
    }
  }
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
 * Главная функция для запуска всего процесса тестирования
 */
async function runFullTest() {
  console.log('🔬 Запуск упрощенного тестирования диаризации\n');
  
  let serviceInfo = null;
  
  try {
    // Проверяем наличие тестового файла
    if (!fs.existsSync(TEST_AUDIO_FILE)) {
      console.error(`❌ Тестовый файл не найден: ${TEST_AUDIO_FILE}`);
      console.log(`💡 Сначала создайте тестовый файл: node generate-quick-test-audio.js`);
      return;
    }
    
    // Шаг 1: Запускаем микросервис диаризации
    serviceInfo = await startDiarizationService();
    
    // Шаг 2: Выполняем тестирование диаризации
    await testDiarization(TEST_AUDIO_FILE);
    
    console.log('\n✅ Тестирование успешно завершено');
  } catch (error) {
    console.error(`\n❌ Ошибка при выполнении тестирования: ${error.message}`);
  } finally {
    // Шаг 3: Останавливаем микросервис
    if (serviceInfo) {
      stopDiarizationService(serviceInfo);
    }
  }
}

// Запускаем упрощенное тестирование
runFullTest();