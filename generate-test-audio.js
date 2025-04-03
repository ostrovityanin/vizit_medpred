/**
 * Генерация тестового аудиофайла для диаризации
 * 
 * Этот скрипт создает тестовый аудиофайл с несколькими "говорящими"
 * (разные частоты тонального сигнала имитируют разных говорящих).
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Директория для тестовых аудиофайлов
const TEST_AUDIO_DIR = path.join(__dirname, 'test_audio');

/**
 * Генерация тестового аудиофайла с помощью FFmpeg
 * @param {string} outputPath Путь для сохранения аудиофайла
 * @param {number} frequency Частота тона в Гц
 * @param {number} duration Длительность в секундах
 * @returns {Promise<string>} Путь к созданному файлу
 */
    
    ffmpeg.stdout.on('data', (data) => {
      console.log(`FFmpeg: ${data.toString()}`);
    });
    
    ffmpeg.stderr.on('data', (data) => {
      // FFmpeg пишет лог в stderr, но это не обязательно ошибка
      // console.log(`FFmpeg stderr: ${data.toString()}`);
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`Тестовый аудиофайл успешно создан: ${outputPath}`);
        // Проверяем размер файла
        const stats = fs.statSync(outputPath);
        console.log(`Размер файла: ${(stats.size / 1024).toFixed(2)} KB`);
        resolve();
      } else {
        console.error(`FFmpeg завершился с кодом: ${code}`);
        reject(new Error(`FFmpeg завершился с кодом: ${code}`));
      }
    });
    
    ffmpeg.on('error', (err) => {
      console.error('Ошибка запуска FFmpeg:', err);
      reject(err);
    });
  });
}

/**
 * Основная функция
 */
/**
 * Создание файла с несколькими тональными сигналами
 * для имитации разных говорящих
 */
async function generateMultiSpeakerAudio(outputPath) {
  try {
    console.log(`Генерация файла с несколькими говорящими: ${outputPath}`);
    
    // Создаем три временных файла с разными тонами
    const speaker1Path = path.join(TEST_AUDIO_DIR, 'temp_speaker1.mp3');
    const speaker2Path = path.join(TEST_AUDIO_DIR, 'temp_speaker2.mp3');
    const speaker3Path = path.join(TEST_AUDIO_DIR, 'temp_speaker3.mp3');
    
    // Генерируем тоны для трех разных говорящих
    await generateTestAudio(speaker1Path, 300, 2); // Низкий тон
    await generateTestAudio(speaker2Path, 800, 2); // Высокий тон
    await generateTestAudio(speaker3Path, 500, 2); // Средний тон
    
    // Объединяем все файлы
    const ffmpeg = spawn('ffmpeg', [
      '-y',                // Перезаписывать выходной файл
      '-i', speaker1Path,  // Первый говорящий
      '-i', speaker2Path,  // Второй говорящий
      '-i', speaker3Path,  // Третий говорящий
      '-filter_complex', 'concat=n=3:v=0:a=1', // Конкатенация аудио
      '-ac', '1',          // Моно
      '-ar', '16000',      // Частота дискретизации 16 кГц
      outputPath           // Выходной файл
    ]);
    
    await new Promise((resolve, reject) => {
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`Файл с несколькими говорящими создан: ${outputPath}`);
          resolve();
        } else {
          console.error(`Ошибка при объединении файлов: ${code}`);
          reject(new Error(`FFmpeg concat завершился с кодом: ${code}`));
        }
      });
      
      ffmpeg.on('error', (err) => {
        reject(err);
      });
    });
    
    // Удаляем временные файлы
    for (const file of [speaker1Path, speaker2Path, speaker3Path]) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
    
    return outputPath;
  } catch (error) {
    console.error('Ошибка при создании файла с несколькими говорящими:', error);
    throw error;
  }
}

/**
 * Генерация тестового аудио с определенной частотой и длительностью
 */
function generateTestAudio(outputPath, frequency = 440, duration = 5) {
  return new Promise((resolve, reject) => {
    console.log(`Генерация тестового аудиофайла: ${outputPath} (${frequency} Гц, ${duration} сек)`);
    
    const ffmpeg = spawn('ffmpeg', [
      '-y',                // Перезаписывать файл, если существует
      '-f', 'lavfi',       // Использование libavfilter
      '-i', `sine=frequency=${frequency}:duration=${duration}`,  // Синусоида
      '-ac', '1',          // Моно
      '-ar', '16000',      // Частота дискретизации 16 кГц
      outputPath           // Выходной файл
    ]);
    
    ffmpeg.stdout.on('data', (data) => {
      console.log(`FFmpeg (${frequency} Гц): ${data.toString()}`);
    });
    
    ffmpeg.stderr.on('data', (data) => {
      // Игнорируем стандартный вывод FFmpeg
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`Тестовый аудиофайл успешно создан: ${outputPath}`);
        const stats = fs.statSync(outputPath);
        console.log(`Размер файла: ${(stats.size / 1024).toFixed(2)} KB`);
        resolve(outputPath);
      } else {
        console.error(`FFmpeg завершился с кодом: ${code}`);
        reject(new Error(`FFmpeg завершился с кодом: ${code}`));
      }
    });
    
    ffmpeg.on('error', (err) => {
      console.error('Ошибка запуска FFmpeg:', err);
      reject(err);
    });
  });
}

async function main() {
  try {
    // Создаем директорию, если не существует
    if (!fs.existsSync(TEST_AUDIO_DIR)) {
      fs.mkdirSync(TEST_AUDIO_DIR, { recursive: true });
    }
    
    // Путь для тестовых аудиофайлов
    const singleSpeakerPath = path.join(TEST_AUDIO_DIR, 'sample.mp3');
    const multiSpeakerPath = path.join(TEST_AUDIO_DIR, 'multi_speaker.mp3');
    
    // Генерируем тестовые аудиофайлы
    await generateTestAudio(singleSpeakerPath);
    await generateMultiSpeakerAudio(multiSpeakerPath);
    
    console.log('\nТестовые аудиофайлы успешно созданы и готовы для использования в тестах диаризации:');
    console.log(`1. ${singleSpeakerPath} - файл с одним говорящим`);
    console.log(`2. ${multiSpeakerPath} - файл с несколькими говорящими`);
    console.log('\nВы можете запустить:');
    console.log('1. `node test-diarization-service.js` для тестирования микросервиса диаризации напрямую');
    console.log('2. `node test-api-diarization.js` для тестирования API диаризации через основной сервер');
    
  } catch (error) {
    console.error('Ошибка при генерации тестовых аудиофайлов:', error);
  }
}

// Запускаем скрипт
main();