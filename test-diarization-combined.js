/**
 * Комбинированный скрипт для тестирования диаризации
 * 
 * Этот скрипт:
 * 1. Генерирует тестовый аудиофайл
 * 2. Запускает микросервис диаризации
 * 3. Выполняет тестирование диаризации
 * 4. Останавливает микросервис
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';
import { execSync } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';

// Определение путей для ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// URL и порт сервиса диаризации
const DIARIZATION_SERVICE_URL = 'http://localhost:5050';
const SERVICE_DIR = path.join(__dirname, 'services', 'audio-diarization');

// Путь к тестовому аудиофайлу
const TEST_AUDIO_DIR = path.join(__dirname, 'test_audio');
const TEST_AUDIO_FILE = path.join(TEST_AUDIO_DIR, 'test_dialog.mp3');

/**
 * Создает директорию, если она не существует
 * @param {string} dir Путь к директории
 */
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Генерация тестового аудио с определенной частотой и длительностью
 * @param {string} outputPath Путь для сохранения аудиофайла
 * @param {number} frequency Частота тона в Гц
 * @param {number} duration Длительность в секундах
 * @returns {Promise<string>} Путь к созданному файлу
 */
function generateTestAudio(outputPath, frequency = 440, duration = 5, volume = 1.0) {
  return new Promise((resolve, reject) => {
    console.log(`📝 Генерация тестового аудио: ${outputPath} (${frequency} Гц, ${duration}с)`);
    
    ffmpeg()
      .audioFilter([
        `sine=frequency=${frequency}:duration=${duration}`, 
        `volume=${volume}`
      ])
      .toFormat('mp3')
      .on('error', (err) => {
        console.error(`❌ Ошибка при генерации аудио: ${err.message}`);
        reject(err);
      })
      .on('end', () => {
        console.log(`✅ Файл создан: ${outputPath}`);
        resolve(outputPath);
      })
      .save(outputPath);
  });
}

/**
 * Создание файла с несколькими тональными сигналами для имитации диалога
 * @param {string} outputPath Путь для сохранения аудиофайла
 * @returns {Promise<string>} Путь к созданному файлу
 */
async function generateClearDialog(outputPath) {
  console.log('🎵 Генерация тестового диалога...');
  
  // Директория для временных файлов
  const tempDir = path.join(__dirname, 'temp');
  ensureDirectoryExists(tempDir);
  
  // Создаем файлы с разными тонами
  const speaker1File = path.join(tempDir, 'speaker1.mp3');
  const speaker2File = path.join(tempDir, 'speaker2.mp3');
  const pauseFile = path.join(tempDir, 'pause.mp3');
  
  // Очищаем временные файлы, если они существуют
  for (const file of [speaker1File, speaker2File, pauseFile]) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
  
  // Генерируем файлы для каждого говорящего и паузы
  await generateTestAudio(speaker1File, 320, 3.0, 0.9);  // Низкий тон (мужской голос)
  await generateTestAudio(speaker2File, 620, 2.5, 0.8);  // Высокий тон (женский голос)
  await generateTestAudio(pauseFile, 1, 1.0, 0.01);      // Почти тишина для паузы
  
  // Создаем диалог: speaker1 -> pause -> speaker2 -> pause -> speaker1 -> pause -> speaker2
  // Используем ffmpeg для конкатенации файлов с паузами между ними
  const dialogCommand = `ffmpeg -y -i "${speaker1File}" -i "${pauseFile}" -i "${speaker2File}" -i "${pauseFile}" -i "${speaker1File}" -i "${pauseFile}" -i "${speaker2File}" -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a]concat=n=7:v=0:a=1[out]" -map "[out]" "${outputPath}"`;
  
  console.log('⏳ Сборка диалогового аудиофайла...');
  
  try {
    // Выполняем команду ffmpeg
    execSync(dialogCommand, { stdio: 'pipe' });
    console.log(`✅ Тестовый диалог успешно создан: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`❌ Ошибка при создании диалога: ${error.message}`);
    throw error;
  }
}

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
  console.log('🔬 Запуск комплексного тестирования диаризации\n');
  
  // Создаем тестовую директорию
  ensureDirectoryExists(TEST_AUDIO_DIR);
  
  let serviceInfo = null;
  
  try {
    // Шаг 1: Генерируем тестовый файл диалога
    await generateClearDialog(TEST_AUDIO_FILE);
    
    // Шаг 2: Запускаем микросервис диаризации
    serviceInfo = await startDiarizationService();
    
    // Шаг 3: Выполняем тестирование диаризации
    await testDiarization(TEST_AUDIO_FILE);
    
    console.log('\n✅ Комплексное тестирование успешно завершено');
  } catch (error) {
    console.error(`\n❌ Ошибка при выполнении тестирования: ${error.message}`);
  } finally {
    // Шаг 4: Останавливаем микросервис
    if (serviceInfo) {
      stopDiarizationService(serviceInfo);
    }
  }
}

// Запускаем полное тестирование
runFullTest();