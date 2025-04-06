/**
 * Генерация сложного тестового аудиофайла для диаризации
 * 
 * Этот скрипт создает тестовый аудиофайл с несколькими "говорящими"
 * (разные частоты тонального сигнала с переходами и перекрытиями)
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
 * Генерация тестового аудио с определенной частотой и длительностью
 * @param {string} outputPath Путь для сохранения аудиофайла
 * @param {number} frequency Частота тона в Гц
 * @param {number} duration Длительность в секундах
 * @returns {Promise<string>} Путь к созданному файлу
 */
function generateTestAudio(outputPath, frequency = 440, duration = 5, volume = 1.0) {
  return new Promise((resolve, reject) => {
    console.log(`Генерация тестового аудиофайла: ${outputPath} (${frequency} Гц, ${duration} сек, громкость ${volume})`);
    
    const ffmpeg = spawn('ffmpeg', [
      '-y',                // Перезаписывать файл, если существует
      '-f', 'lavfi',       // Использование libavfilter
      '-i', `sine=frequency=${frequency}:duration=${duration}:sample_rate=16000`,  // Синусоида
      '-filter:a', `volume=${volume}`,  // Регулировка громкости
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

/**
 * Создание файла с несколькими тональными сигналами и перекрытиями
 * для имитации сложного разговора нескольких говорящих
 * @param {string} outputPath Путь для сохранения аудиофайла
 * @returns {Promise<string>} Путь к созданному файлу
 */
async function generateComplexMultiSpeakerAudio(outputPath) {
  try {
    console.log(`Генерация сложного файла с несколькими говорящими: ${outputPath}`);
    
    // Создаем временную директорию для сегментов
    const tempDir = path.join(TEST_AUDIO_DIR, 'temp_segments');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Структура сложного диалога:
    const segments = [
      { speaker: 1, freq: 300, start: 0, duration: 3, volume: 1.0 },   // Говорящий 1 начинает
      { speaker: 2, freq: 800, start: 2, duration: 3, volume: 0.9 },   // Говорящий 2 перебивает с 2 сек
      { speaker: 3, freq: 500, start: 4, duration: 2, volume: 0.8 },   // Говорящий 3 включается с 4 сек
      { speaker: 1, freq: 320, start: 5, duration: 2, volume: 1.0 },   // Говорящий 1 снова с 5 сек
      { speaker: 2, freq: 850, start: 6, duration: 3, volume: 0.9 },   // Говорящий 2 с 6 сек
      { speaker: 3, freq: 520, start: 8, duration: 4, volume: 0.9 },   // Говорящий 3 с 8 сек
      { speaker: 1, freq: 300, start: 10, duration: 3, volume: 0.8 },  // Говорящий 1 с 10 сек
      { speaker: 3, freq: 500, start: 12, duration: 3, volume: 1.0 }   // Говорящий 3 заканчивает с 12 сек
    ];
    
    // Вычисляем общую длительность
    const totalDuration = Math.max(...segments.map(s => s.start + s.duration));
    console.log(`Общая длительность составит: ${totalDuration} сек`);
    
    // Генерируем отдельные сегменты
    const segmentFiles = [];
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentPath = path.join(tempDir, `segment_${i}_speaker_${segment.speaker}.mp3`);
      await generateTestAudio(segmentPath, segment.freq, segment.duration, segment.volume);
      segmentFiles.push({
        path: segmentPath,
        start: segment.start,
        speaker: segment.speaker
      });
    }
    
    // Создаем файл для каждого говорящего с тишиной
    const speakerFiles = [];
    for (let speaker = 1; speaker <= 3; speaker++) {
      const speakerPath = path.join(tempDir, `speaker_${speaker}_full.mp3`);
      
      // Создаем пустой файл с тишиной для заданной длительности
      await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-y',
          '-f', 'lavfi',
          '-i', `anullsrc=duration=${totalDuration}:sample_rate=16000`,
          '-ac', '1',
          '-ar', '16000',
          speakerPath
        ]);
        
        ffmpeg.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Ошибка при создании тишины для говорящего ${speaker}: ${code}`));
          }
        });
        
        ffmpeg.on('error', reject);
      });
      
      speakerFiles.push(speakerPath);
    }
    
    // Добавляем сегменты к файлам говорящих
    for (const segment of segmentFiles) {
      const speakerFullPath = path.join(tempDir, `speaker_${segment.speaker}_full.mp3`);
      const tempOutputPath = path.join(tempDir, `temp_output_${segment.speaker}_${Date.now()}.mp3`);
      
      // Добавляем сегмент в нужную позицию
      await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-y',
          '-i', speakerFullPath,         // Входной файл с тишиной
          '-i', segment.path,            // Сегмент говорящего
          '-filter_complex', `[0:a][1:a]amerge=inputs=2,pan=mono|c0=c0+c1,adelay=${segment.start * 1000}|${segment.start * 1000}`,
          '-ac', '1',
          '-ar', '16000',
          tempOutputPath
        ]);
        
        ffmpeg.on('close', (code) => {
          if (code === 0) {
            // Обновляем файл говорящего
            fs.copyFileSync(tempOutputPath, speakerFullPath);
            fs.unlinkSync(tempOutputPath);
            resolve();
          } else {
            reject(new Error(`Ошибка при добавлении сегмента: ${code}`));
          }
        });
        
        ffmpeg.on('error', reject);
      });
    }
    
    // Смешиваем все файлы говорящих
    await new Promise((resolve, reject) => {
      const inputs = speakerFiles.map(file => `-i ${file}`).join(' ');
      const filterComplex = `${speakerFiles.map((_, i) => `[${i}:a]`).join('')}amerge=inputs=${speakerFiles.length},pan=mono|c0=${speakerFiles.map((_, i) => `c${i}`).join('+')}`;
      
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        ...speakerFiles.flatMap(file => ['-i', file]),
        '-filter_complex', filterComplex,
        '-ac', '1',
        '-ar', '16000',
        outputPath
      ]);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`Сложный многоговорящий файл создан: ${outputPath}`);
          resolve();
        } else {
          reject(new Error(`Ошибка при объединении файлов: ${code}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
    
    // Удаляем временные файлы
    for (const segment of segmentFiles) {
      if (fs.existsSync(segment.path)) {
        fs.unlinkSync(segment.path);
      }
    }
    
    for (const file of speakerFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
    
    return outputPath;
  } catch (error) {
    console.error('Ошибка при создании сложного файла с несколькими говорящими:', error);
    throw error;
  }
}

/**
 * Основная функция
 */
async function main() {
  try {
    // Создаем директорию, если не существует
    if (!fs.existsSync(TEST_AUDIO_DIR)) {
      fs.mkdirSync(TEST_AUDIO_DIR, { recursive: true });
    }
    
    // Путь для сложного тестового файла
    const complexAudioPath = path.join(TEST_AUDIO_DIR, 'complex_dialog.mp3');
    
    // Генерируем сложный тестовый файл
    await generateComplexMultiSpeakerAudio(complexAudioPath);
    
    console.log('\nСложный тестовый аудиофайл успешно создан:');
    console.log(`${complexAudioPath} - файл со сложным диалогом нескольких говорящих`);
    console.log('\nВы можете запустить:');
    console.log('`node test-diarization-compare.js ./test_audio/complex_dialog.mp3` для сравнительного тестирования диаризации');
    
  } catch (error) {
    console.error('Ошибка при генерации сложного тестового аудиофайла:', error);
  }
}

// Запускаем скрипт, если запущен напрямую
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

// Экспортируем функции для использования в других модулях
export { generateTestAudio, generateComplexMultiSpeakerAudio };