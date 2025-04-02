/**
 * Модуль для обработки и оптимизации аудиофайлов
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { logInfo, logError, logDebug } from './logger.js';

// Настройка пути к ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath.path);

// Получаем текущую директорию (для ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к директории для временных файлов
const tempDir = path.join(__dirname, '../temp');

/**
 * Создает директорию, если она не существует
 * @param {string} dirPath Путь к директории
 */
export function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Возвращает информацию о длительности аудиофайла
 * @param {string} filePath Путь к аудиофайлу
 * @returns {Promise<number>} Длительность в секундах
 */
export function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        logError(err, `Ошибка при получении информации о файле: ${filePath}`);
        return reject(err);
      }
      
      if (metadata && metadata.format && metadata.format.duration) {
        resolve(metadata.format.duration);
      } else {
        reject(new Error('Не удалось определить длительность аудио'));
      }
    });
  });
}

/**
 * Разделяет аудиофайл на сегменты указанной длительности
 * @param {string} inputPath Путь к исходному файлу
 * @param {string} outputDir Директория для сохранения сегментов
 * @param {number} segmentDurationSeconds Длительность каждого сегмента в секундах (по умолчанию 30)
 * @returns {Promise<string[]>} Массив путей к созданным сегментам
 */
export async function splitAudioFile(
  inputPath,
  outputDir = tempDir,
  segmentDurationSeconds = 30
) {
  ensureDirectoryExists(outputDir);
  
  try {
    const inputFilename = path.basename(inputPath, path.extname(inputPath));
    const outputPattern = path.join(outputDir, `${inputFilename}_segment_%03d.wav`);
    
    logInfo(`Разделение файла ${inputPath} на сегменты по ${segmentDurationSeconds} секунд`);
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          `-f segment`,
          `-segment_time ${segmentDurationSeconds}`,
          `-c:a pcm_s16le`,
          `-ar 16000`,
          `-ac 1`
        ])
        .output(outputPattern)
        .on('end', () => {
          // Получаем список созданных файлов
          const segmentFiles = fs.readdirSync(outputDir)
            .filter(file => file.startsWith(`${inputFilename}_segment_`))
            .map(file => path.join(outputDir, file))
            .sort(); // Сортируем для правильного порядка
          
          logInfo(`Файл разделен на ${segmentFiles.length} сегментов`);
          resolve(segmentFiles);
        })
        .on('error', (err) => {
          logError(err, 'Ошибка при разделении аудиофайла на сегменты');
          reject(err);
        })
        .run();
    });
  } catch (error) {
    logError(error, 'Ошибка при разделении аудиофайла');
    throw error;
  }
}

/**
 * Оптимизирует аудиофайл для распознавания речи, уменьшая его размер
 * @param {string} inputPath Путь к исходному файлу
 * @param {string} outputPath Путь для сохранения оптимизированного файла (если не указан, сгенерируется автоматически)
 * @returns {Promise<string>} Путь к оптимизированному файлу
 */
export async function optimizeAudioForTranscription(
  inputPath,
  outputPath = ''
) {
  ensureDirectoryExists(tempDir);
  
  try {
    // Если выходной путь не указан, генерируем автоматически
    if (!outputPath) {
      const inputFilename = path.basename(inputPath, path.extname(inputPath));
      outputPath = path.join(tempDir, `${inputFilename}_optimized.mp3`);
    }
    
    logInfo(`Оптимизация аудиофайла: ${inputPath}`);
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        // Преобразуем в моно, 16 кГц, битрейт 32 кбит/с, MP3
        .audioChannels(1)              // Моно
        .audioFrequency(16000)         // Частота дискретизации 16 кГц
        .audioBitrate('32k')           // Битрейт 32 кбит/с
        .audioCodec('libmp3lame')      // Кодек MP3
        // Упрощаем фильтры, которые могут вызывать проблемы
        .audioFilters('volume=1.5')
        .output(outputPath)
        .on('end', () => {
          logInfo(`Аудиофайл оптимизирован и сохранен: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          logError(err, 'Ошибка при оптимизации аудиофайла');
          reject(err);
        })
        .run();
    });
  } catch (error) {
    logError(error, 'Необработанная ошибка при оптимизации аудиофайла');
    throw error;
  }
}

/**
 * Конвертирует WebM файл в WAV формат, поддерживаемый OpenAI API
 * @param {string} input Путь к входному файлу WebM
 * @param {string} output Путь к выходному файлу WAV
 * @returns {Promise<boolean>} Успешность конвертации
 */
export async function convertWebmToWav(input, output) {
  try {
    logDebug(`Конвертация файла ${input} в WAV формат: ${output}`);
    
    return new Promise((resolve, reject) => {
      ffmpeg(input)
        .audioCodec('pcm_s16le')   // 16-bit PCM
        .audioFrequency(16000)     // 16 кГц
        .audioChannels(1)          // Моно
        .output(output)
        .on('end', () => {
          logInfo(`Файл успешно конвертирован в WAV: ${output}`);
          resolve(true);
        })
        .on('error', (err) => {
          logError(err, `Ошибка при конвертации в WAV: ${err.message}`);
          reject(err);
        })
        .run();
    });
  } catch (error) {
    logError(error, 'Ошибка при конвертации WebM в WAV');
    return false;
  }
}

/**
 * Комбинирует несколько аудиофайлов в один
 * @param {string[]} audioFiles Массив путей к аудиофайлам
 * @param {string} outputPath Путь для сохранения результата
 * @returns {Promise<string>} Путь к объединенному файлу
 */
export async function combineAudioFiles(audioFiles, outputPath) {
  ensureDirectoryExists(path.dirname(outputPath));
  
  if (audioFiles.length === 0) {
    throw new Error('Не указаны файлы для объединения');
  }
  
  if (audioFiles.length === 1) {
    // Если только один файл, просто копируем его
    fs.copyFileSync(audioFiles[0], outputPath);
    return outputPath;
  }
  
  try {
    logInfo(`Объединение ${audioFiles.length} файлов в ${outputPath}`);
    
    // Создаем ffmpeg команду
    let ffmpegCommand = ffmpeg();
    
    // Добавляем каждый файл как отдельный вход
    audioFiles.forEach(file => {
      ffmpegCommand = ffmpegCommand.input(file);
    });
    
    // Используем фильтр для объединения
    const filterComplex = audioFiles.map((_, index) => `[${index}:a]`).join('') + `concat=n=${audioFiles.length}:v=0:a=1[out]`;
    
    return new Promise((resolve, reject) => {
      ffmpegCommand
        .complexFilter(filterComplex)
        .map('[out]')
        .audioCodec('pcm_s16le')
        .audioFrequency(16000)
        .audioChannels(1)
        .output(outputPath)
        .on('end', () => {
          logInfo(`Файлы успешно объединены: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          logError(err, 'Ошибка при объединении аудиофайлов');
          reject(err);
        })
        .run();
    });
  } catch (error) {
    logError(error, 'Ошибка при объединении аудиофайлов');
    throw error;
  }
}

/**
 * Очищает временную директорию от файлов с определенным префиксом
 * @param {string} prefix Префикс имени файлов для удаления
 */
export function cleanupTempFiles(prefix = '') {
  try {
    const files = fs.readdirSync(tempDir);
    
    for (const file of files) {
      if (!prefix || file.startsWith(prefix)) {
        const filePath = path.join(tempDir, file);
        fs.unlinkSync(filePath);
        logDebug(`Удален временный файл: ${filePath}`);
      }
    }
    
    logInfo(`Временные файлы ${prefix ? `с префиксом ${prefix}` : ''} успешно удалены`);
  } catch (error) {
    logError(error, 'Ошибка при очистке временных файлов');
  }
}