/**
 * Тестирование упрощенной версии сервиса диаризации
 */

import axios from 'axios';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import fs from 'fs';
import FormData from 'form-data';

// Определение путей для ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// URL и порт сервиса диаризации
const DIARIZATION_SERVICE_URL = 'http://localhost:5050';
const SERVICE_DIR = path.join(__dirname, 'services', 'audio-diarization');

// Путь к тестовому аудиофайлу
const TEST_AUDIO_DIR = path.join(__dirname, 'test_audio');
const TEST_AUDIO_FILE = path.join(TEST_AUDIO_DIR, 'test_simple.mp3');
const RESULT_FILE = 'diarization_result_simplified.json';

// Создаем директории, если не существуют
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Создана директория: ${dir}`);
  }
}

/**
 * Создает простой тональный сигнал с помощью ffmpeg
 * @param {string} outputPath Путь для сохранения выходного файла
 * @param {number} frequency Частота тона (Гц)
 * @param {number} duration Длительность (секунды)
 */
async function generateTestAudio(outputPath, frequency = 440, duration = 1) {
  return new Promise((resolve, reject) => {
    ensureDirectoryExists(path.dirname(outputPath));
    
    console.log(`🔊 Создание тестового аудио (${frequency} Гц, ${duration} сек)...`);
    
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', `sine=frequency=${frequency}:duration=${duration}`,
      '-c:a', 'libmp3lame',
      '-b:a', '32k',
      '-ac', '1',
      '-ar', '16000',
      outputPath
    ]);
    
    ffmpeg.stderr.on('data', (data) => {
      // FFmpeg пишет лог в stderr, необязательно это ошибка
      // console.log(`[FFmpeg] ${data.toString().trim()}`);
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Создан тестовый аудиофайл: ${outputPath}`);
        resolve(outputPath);
      } else {
        console.error(`❌ Ошибка при создании аудиофайла, код: ${code}`);
        reject(new Error(`Ошибка FFmpeg с кодом ${code}`));
      }
    });
  });
}

/**
 * Запускает упрощенный микросервис диаризации и возвращает процесс
 * @returns {Promise<Object>} Объект с информацией о процессе
 */
async function startSimplifiedDiarizationService() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Запуск упрощенного микросервиса диаризации...');
    
    const python = process.platform === 'win32' ? 'python' : 'python3';
    const serviceProcess = spawn(python, ['run_simplified.py'], {
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
          console.log(`   - Сервис: ${response.data.service}`);
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
 * Тестирование диаризации с упрощенным сервисом
 * @param {string} audioFile Путь к аудиофайлу
 * @param {string} serviceUrl URL сервиса диаризации
 */
async function testSimplifiedDiarization(audioFile, serviceUrl) {
  try {
    console.log(`🔍 Тестирование диаризации для файла: ${audioFile}`);
    
    // Формируем данные для отправки
    const formData = new FormData();
    formData.append('audio_file', fs.createReadStream(audioFile));
    
    console.log('🚀 Отправка запроса на диаризацию...');
    
    // Отправляем запрос с таймаутом 5 секунд (должно хватить для упрощенной версии)
    const response = await axios.post(`${serviceUrl}/diarize`, formData, {
      headers: formData.getHeaders(),
      timeout: 5000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    console.log('✅ Запрос успешно обработан');
    console.log('\n📊 Результаты диаризации:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Сохраняем результаты в файл
    fs.writeFileSync(RESULT_FILE, JSON.stringify(response.data, null, 2));
    console.log(`✅ Результаты сохранены в файл: ${RESULT_FILE}`);
    
    return response.data;
  } catch (error) {
    console.error(`❌ Ошибка при тестировании диаризации:`);
    
    if (error.response) {
      console.error(`   - Статус: ${error.response.status}`);
      console.error(`   - Сообщение: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.error(`   - ${error.message}`);
    } else {
      console.error(`   - ${error.message}`);
    }
    
    throw error;
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
 * Главная функция для запуска упрощенного тестирования
 */
async function runSimplifiedTest() {
  console.log('🔬 Запуск тестирования упрощенной диаризации\n');
  
  let serviceInfo = null;
  
  try {
    // Шаг 1: Генерируем простой тестовый аудиофайл
    await generateTestAudio(TEST_AUDIO_FILE, 440, 1);
    
    // Шаг 2: Запускаем упрощенный микросервис диаризации
    serviceInfo = await startSimplifiedDiarizationService();
    
    // Шаг 3: Тестируем диаризацию с упрощенным сервисом
    await testSimplifiedDiarization(TEST_AUDIO_FILE, serviceInfo.url);
    
    console.log('\n✅ Тестирование успешно завершено');
  } catch (error) {
    console.error(`\n❌ Ошибка при выполнении тестирования: ${error.message}`);
  } finally {
    // Шаг 4: Останавливаем микросервис
    if (serviceInfo) {
      stopDiarizationService(serviceInfo);
    }
  }
}

// Запускаем упрощенное тестирование
runSimplifiedTest();