/**
 * Генерация тестового диалога для проверки диаризации
 * 
 * Этот скрипт создает тестовый аудиофайл с четко различимыми говорящими
 * и паузами между репликами для улучшенного тестирования диаризации.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

// Получаем абсолютный путь к текущему файлу и директории
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Директория для тестовых аудиофайлов
const TEST_AUDIO_DIR = path.join(__dirname, 'test_audio');
const TEMP_DIR = path.join(TEST_AUDIO_DIR, 'temp_segments');

// Создаем необходимые директории, если их нет
if (!fs.existsSync(TEST_AUDIO_DIR)) {
  fs.mkdirSync(TEST_AUDIO_DIR, { recursive: true });
}

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Генерация тестового аудиофайла с синусоидой определенной частоты
 * @param {string} outputPath Путь для сохранения аудиофайла
 * @param {number} frequency Частота тона в Гц
 * @param {number} duration Длительность в секундах
 * @param {number} volume Громкость от 0 до 1
 * @returns {Promise<string>} Путь к созданному файлу
 */
function generateTestAudio(outputPath, frequency = 440, duration = 5, volume = 1.0) {
  return new Promise((resolve, reject) => {
    console.log(`Генерация тестового аудиофайла: ${outputPath} (${frequency} Гц, ${duration} сек, громкость ${volume})`);
    
    // Создаем синусоиду указанной частоты и длительности
    const ffmpeg = spawn('ffmpeg', [
      '-f', 'lavfi',
      '-i', `sine=frequency=${frequency}:sample_rate=44100:duration=${duration}`,
      '-af', `volume=${volume}`,
      '-c:a', 'libmp3lame',
      '-q:a', '2',
      outputPath
    ]);
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        // Выводим информацию о созданном файле
        const stats = fs.statSync(outputPath);
        console.log(`Тестовый аудиофайл успешно создан: ${outputPath}`);
        console.log(`Размер файла: ${(stats.size / 1024).toFixed(2)} KB`);
        resolve(outputPath);
      } else {
        reject(new Error(`FFmpeg завершился с ошибкой: ${code}`));
      }
    });
    
    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Создание файла с идеальным диалогом с длинными паузами между репликами
 * для лучшего тестирования диаризации
 * @param {string} outputPath Путь для сохранения аудиофайла
 * @returns {Promise<string>} Путь к созданному файлу
 */
async function generateClearDialog(outputPath) {
  // Структура диалога: говорящий 1, пауза, говорящий 2, пауза, говорящий 1, пауза, говорящий 2
  // Используем ОЧЕНЬ резко различающиеся частоты для лучшего разделения говорящих
  
  // Определение параметров диалога (частота, длительность для каждого сегмента)
  const segments = [
    { speaker: 1, freq: 200, duration: 3.0, volume: 1.0 },  // 1-й говорящий (низкий голос)
    { speaker: 'silence', duration: 1.0 },                  // пауза
    { speaker: 2, freq: 1200, duration: 2.5, volume: 1.0 }, // 2-й говорящий (высокий голос)
    { speaker: 'silence', duration: 1.0 },                  // пауза
    { speaker: 1, freq: 220, duration: 2.0, volume: 1.0 },  // снова 1-й говорящий (низкий голос)
    { speaker: 'silence', duration: 1.5 },                  // пауза
    { speaker: 2, freq: 1300, duration: 3.0, volume: 1.0 }  // снова 2-й говорящий (высокий голос)
  ];
  
  let totalDuration = segments.reduce((total, segment) => total + segment.duration, 0);
  console.log(`Генерация идеального диалога: ${outputPath}`);
  console.log(`Общая длительность составит: ${totalDuration} сек`);
  
  // Создаем все сегменты
  const segmentFiles = [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    if (segment.speaker === 'silence') {
      // Для тишины используем специальный файл
      const silenceFile = path.join(TEMP_DIR, `silence_${i}.mp3`);
      await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-f', 'lavfi',
          '-i', `anullsrc=r=44100:cl=stereo:duration=${segment.duration}`,
          '-c:a', 'libmp3lame',
          '-q:a', '2',
          silenceFile
        ]);
        
        ffmpeg.on('close', (code) => {
          if (code === 0) {
            segmentFiles.push(silenceFile);
            resolve();
          } else {
            reject(new Error(`FFmpeg завершился с ошибкой при создании тишины: ${code}`));
          }
        });
        
        ffmpeg.on('error', reject);
      });
    } else {
      // Для говорящих - файлы с синусоидами разных частот
      const speakerFile = path.join(TEMP_DIR, `segment_${i}_speaker_${segment.speaker}.mp3`);
      await generateTestAudio(speakerFile, segment.freq, segment.duration, segment.volume);
      segmentFiles.push(speakerFile);
    }
  }
  
  // Объединяем все сегменты
  await new Promise((resolve, reject) => {
    // Создаем список файлов для ffmpeg
    const fileList = path.join(TEMP_DIR, 'file_list.txt');
    fs.writeFileSync(fileList, segmentFiles.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
    
    // Конкатенируем файлы
    const ffmpeg = spawn('ffmpeg', [
      '-f', 'concat',
      '-safe', '0',
      '-i', fileList,
      '-c', 'copy',
      outputPath
    ]);
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg завершился с ошибкой при объединении: ${code}`));
      }
    });
    
    ffmpeg.on('error', reject);
  });
  
  // Выводим информацию о созданном файле диалога
  const stats = fs.statSync(outputPath);
  console.log(`\nИдеальный диалог успешно создан: ${outputPath}`);
  console.log(`Размер файла: ${(stats.size / 1024).toFixed(2)} KB`);
  
  // Очищаем временные файлы
  segmentFiles.forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });
  
  // Удаляем список файлов
  const fileList = path.join(TEMP_DIR, 'file_list.txt');
  if (fs.existsSync(fileList)) {
    fs.unlinkSync(fileList);
  }
  
  return outputPath;
}

/**
 * Основная функция
 */
async function main() {
  try {
    // Создаем диалог для тестирования диаризации
    const dialogFile = path.join(TEST_AUDIO_DIR, 'clear_dialog.mp3');
    await generateClearDialog(dialogFile);
    
    console.log(`\nТестовый диалог успешно создан:`);
    console.log(`${dialogFile} - файл с четким диалогом и паузами между репликами`);
    console.log(`\nВы можете запустить:`);
    console.log(`node test-diarization-compare.js ./test_audio/clear_dialog.mp3 для сравнительного тестирования диаризации`);
    
  } catch (error) {
    console.error('Ошибка при генерации тестовых аудиофайлов:', error);
  }
}

// Запуск основной функции
main();