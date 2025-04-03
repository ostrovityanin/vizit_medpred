/**
 * Модуль обработки аудиофайлов для сервиса GPT-4o Audio
 */

import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { promisify } from 'util';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import logger from './logger.js';

// Загружаем конфигурацию из .env файла
dotenv.config();

// Установка пути к ffmpeg
const ffmpegPath = ffmpegInstaller.path;
ffmpeg.setFfmpegPath(ffmpegPath);

// Промисифицированные версии функций fs
const fsAccess = promisify(fs.access);
const fsMkdir = promisify(fs.mkdir);
const execAsync = promisify(exec);

// Создание директории для хранения файлов, если она не существует
const uploadsDir = process.env.UPLOADS_DIR || './uploads';
const tempDir = path.join(uploadsDir, 'temp');

// Поддерживаемые форматы аудио
const supportedFormats = ['mp3', 'wav', 'm4a', 'webm', 'mp4', 'mpga', 'mpeg'];

/**
 * Проверяет наличие директории и создает ее, если она не существует
 * @param {string} dir Путь к директории
 * @returns {Promise<boolean>} true, если директория существует или успешно создана
 */
async function ensureDirectoryExists(dir) {
  try {
    await fsAccess(dir, fs.constants.F_OK);
    return true;
  } catch (error) {
    try {
      await fsMkdir(dir, { recursive: true });
      logger.info(`Создана директория ${dir}`);
      return true;
    } catch (mkdirError) {
      logger.error(`Не удалось создать директорию ${dir}: ${mkdirError.message}`);
      return false;
    }
  }
}

/**
 * Проверяет, поддерживается ли формат файла
 * @param {string} filePath Путь к файлу
 * @returns {boolean} true, если формат поддерживается
 */
function isSupportedFormat(filePath) {
  const ext = path.extname(filePath).substring(1).toLowerCase();
  return supportedFormats.includes(ext);
}

/**
 * Получает информацию о медиафайле с помощью ffmpeg
 * @param {string} filePath Путь к файлу
 * @returns {Promise<Object>} Информация о файле
 */
function getMediaInfo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      // Базовые метаданные
      const info = {
        format: metadata.format.format_name,
        duration: metadata.format.duration, // в секундах
        size: metadata.format.size,         // в байтах
        bitrate: metadata.format.bit_rate,  // в бит/с
        codec: null,
        channels: null,
        sampleRate: null,
        audioStream: null
      };

      // Поиск аудио-стрима
      const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
      if (audioStream) {
        info.codec = audioStream.codec_name;
        info.channels = audioStream.channels;
        info.sampleRate = audioStream.sample_rate;
        info.audioStream = audioStream;
      }

      resolve(info);
    });
  });
}

/**
 * Оптимизирует аудиофайл для транскрипции OpenAI API
 * @param {string} inputPath Путь к исходному файлу
 * @param {Object} options Опции оптимизации
 * @returns {Promise<string>} Путь к оптимизированному файлу
 */
async function optimizeAudio(inputPath, options = {}) {
  try {
    logger.info(`Оптимизация аудиофайла: ${inputPath}`);
    
    // Создание директорий, если они не существуют
    await ensureDirectoryExists(uploadsDir);
    await ensureDirectoryExists(tempDir);
    
    if (!isSupportedFormat(inputPath)) {
      throw new Error(`Неподдерживаемый формат файла: ${path.extname(inputPath)}`);
    }
    
    // Параметры по умолчанию
    const {
      outputFormat = 'mp3',
      sampleRate = 16000,
      channels = 1,
      bitrate = '32k',
      normalize = true
    } = options;
    
    // Получаем информацию о файле
    const fileInfo = await getMediaInfo(inputPath);
    logger.debug(`Информация о файле: ${JSON.stringify(fileInfo)}`);
    
    // Генерируем имя для оптимизированного файла
    const fileName = path.basename(inputPath, path.extname(inputPath));
    const optimizedFileName = `${fileName}_optimized.${outputFormat}`;
    const outputPath = path.join(tempDir, optimizedFileName);
    
    // Применяем оптимизацию через ffmpeg
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .noVideo()
        .audioChannels(channels)
        .audioFrequency(sampleRate)
        .audioBitrate(bitrate)
        .format(outputFormat);
      
      // Применение нормализации (если требуется)
      if (normalize) {
        // Убираем сложные фильтры, которые могут вызывать проблемы
        command = command.audioFilters('dynaudnorm');
      }
      
      command
        .on('end', () => {
          logger.info(`Аудио успешно оптимизировано: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error(`Ошибка при оптимизации аудио: ${err.message}`);
          reject(err);
        })
        .save(outputPath);
    });
  } catch (error) {
    logger.error(`Ошибка при оптимизации аудио: ${error.message}`);
    // Возвращаем исходный файл в случае ошибки
    return inputPath;
  }
}

/**
 * Оптимизирует аудиофайл специально для GPT-4o
 * @param {string} inputPath Путь к исходному файлу
 * @param {Object} options Опции оптимизации
 * @returns {Promise<string>} Путь к оптимизированному файлу
 */
async function optimizeAudioForGPT4o(inputPath, options = {}) {
  try {
    logger.info(`Оптимизация аудиофайла для GPT-4o: ${inputPath}`);
    
    // Создание директорий, если они не существуют
    await ensureDirectoryExists(uploadsDir);
    await ensureDirectoryExists(tempDir);
    
    // Параметры по умолчанию - оптимальные для GPT-4o
    const {
      outputFormat = 'mp3',   // MP3 хорошо работает с GPT-4o
      sampleRate = 48000,     // Более высокий sample rate для качественной транскрипции
      channels = 1,           // Mono для лучшего распознавания речи
      bitrate = '128k',       // Более высокое качество для GPT-4o
      normalize = false       // Избегаем сложной обработки для предотвращения ошибок
    } = options;
    
    // Генерируем имя для оптимизированного файла
    const fileName = path.basename(inputPath, path.extname(inputPath));
    const optimizedFileName = `${fileName}_gpt4o.${outputFormat}`;
    const outputPath = path.join(tempDir, optimizedFileName);
    
    // Применяем оптимизацию через ffmpeg с более простой конфигурацией
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .noVideo()
        .audioChannels(channels)
        .audioFrequency(sampleRate)
        .audioBitrate(bitrate)
        .format(outputFormat);
      
      // Убираем все аудиофильтры для предотвращения ошибок ffmpeg
      
      command
        .on('end', () => {
          logger.info(`Аудио успешно оптимизировано для GPT-4o: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error(`Ошибка при оптимизации аудио для GPT-4o: ${err.message}`);
          reject(err);
        })
        .save(outputPath);
    });
  } catch (error) {
    logger.error(`Ошибка при оптимизации аудио для GPT-4o: ${error.message}`);
    // Возвращаем исходный файл в случае ошибки
    return inputPath;
  }
}

/**
 * Конвертирует аудиофайл в WAV формат, поддерживаемый OpenAI API
 * @param {string} inputPath Путь к исходному файлу
 * @param {Object} options Опции конвертации
 * @returns {Promise<string>} Путь к конвертированному файлу
 */
async function convertToWav(inputPath, options = {}) {
  try {
    logger.info(`Конвертация аудиофайла в WAV: ${inputPath}`);
    
    // Создание директорий, если они не существуют
    await ensureDirectoryExists(uploadsDir);
    await ensureDirectoryExists(tempDir);
    
    // Параметры по умолчанию
    const {
      sampleRate = 16000,
      channels = 1,
      normalize = false
    } = options;
    
    // Генерируем имя для WAV файла
    const fileName = path.basename(inputPath, path.extname(inputPath));
    const wavFileName = `${fileName}.wav`;
    const outputPath = path.join(tempDir, wavFileName);
    
    // Применяем конвертацию через ffmpeg
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .noVideo()
        .audioChannels(channels)
        .audioFrequency(sampleRate)
        .format('wav');
      
      // Применение нормализации (если требуется)
      if (normalize) {
        command = command.audioFilters('loudnorm');
      }
      
      command
        .on('end', () => {
          logger.info(`Аудио успешно конвертировано в WAV: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error(`Ошибка при конвертации аудио в WAV: ${err.message}`);
          reject(err);
        })
        .save(outputPath);
    });
  } catch (error) {
    logger.error(`Ошибка при конвертации аудио в WAV: ${error.message}`);
    // Возвращаем исходный файл в случае ошибки
    return inputPath;
  }
}

/**
 * Конвертирует аудиофайл в MP3 формат для новых моделей GPT-4o
 * @param {string} inputPath Путь к исходному файлу
 * @param {Object} options Опции конвертации
 * @returns {Promise<string>} Путь к конвертированному файлу
 */
async function convertToMp3(inputPath, options = {}) {
  try {
    logger.info(`Конвертация аудиофайла в MP3: ${inputPath}`);
    
    // Создание директорий, если они не существуют
    await ensureDirectoryExists(uploadsDir);
    await ensureDirectoryExists(tempDir);
    
    // Параметры по умолчанию - оптимизированы для новых моделей транскрипции
    const {
      sampleRate = 16000,  // Понижаем до 16kHz - оптимально для моделей транскрипции
      channels = 1,        // Mono для лучшего распознавания речи
      bitrate = '32k',     // Оптимальный битрейт для транскрипции
      normalize = false    // Избегаем сложной обработки для предотвращения ошибок
    } = options;
    
    // Генерируем имя для MP3 файла
    const fileName = path.basename(inputPath, path.extname(inputPath));
    const mp3FileName = `${fileName}.mp3`;
    const outputPath = path.join(tempDir, mp3FileName);
    
    // Применяем конвертацию через ffmpeg
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .noVideo()
        .audioChannels(channels)
        .audioFrequency(sampleRate)
        .audioBitrate(bitrate)
        .audioCodec('libmp3lame')
        .format('mp3');
      
      // Применение нормализации (если требуется)
      if (normalize) {
        command = command.audioFilters('loudnorm');
      }
      
      command
        .on('end', () => {
          logger.info(`Аудио успешно конвертировано в MP3: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error(`Ошибка при конвертации аудио в MP3: ${err.message}`);
          reject(err);
        })
        .save(outputPath);
    });
  } catch (error) {
    logger.error(`Ошибка при конвертации аудио в MP3: ${error.message}`);
    // Возвращаем исходный файл в случае ошибки
    return inputPath;
  }
}

/**
 * Разделяет аудиофайл на сегменты указанной длительности
 * @param {string} inputPath Путь к исходному файлу
 * @param {Object} options Опции сегментации
 * @returns {Promise<Array<string>>} Массив путей к созданным сегментам
 */
async function splitAudioFile(inputPath, options = {}) {
  try {
    logger.info(`Разделение аудиофайла на сегменты: ${inputPath}`);
    
    // Создаем директории, если они не существуют
    await ensureDirectoryExists(uploadsDir);
    await ensureDirectoryExists(tempDir);
    
    // Параметры сегментации
    const {
      segmentDurationSeconds = 30,
      outputFormat = 'mp3',
    } = options;
    
    // Получаем информацию о файле
    const fileInfo = await getMediaInfo(inputPath);
    const totalDuration = fileInfo.duration;
    
    // Проверяем, нужно ли разделять файл
    if (totalDuration <= segmentDurationSeconds) {
      logger.info(`Файл короче ${segmentDurationSeconds} секунд, разделение не требуется`);
      return [inputPath];
    }
    
    // Определяем количество сегментов
    const segmentCount = Math.ceil(totalDuration / segmentDurationSeconds);
    
    // Генерируем базовое имя для сегментов
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const segmentPaths = [];
    
    // Создаем сегменты
    for (let i = 0; i < segmentCount; i++) {
      const startTime = i * segmentDurationSeconds;
      const segmentFileName = `${baseName}_segment_${(i+1).toString().padStart(3, '0')}.${outputFormat}`;
      const segmentPath = path.join(tempDir, segmentFileName);
      segmentPaths.push(segmentPath);
      
      // Создаем сегмент файла
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .noVideo()
          .setStartTime(startTime)
          .setDuration(segmentDurationSeconds)
          .output(segmentPath)
          .on('end', () => {
            logger.debug(`Создан сегмент ${segmentPath}`);
            resolve();
          })
          .on('error', (err) => {
            logger.error(`Ошибка при создании сегмента ${segmentPath}: ${err.message}`);
            reject(err);
          })
          .run();
      });
    }
    
    logger.info(`Файл разделен на ${segmentCount} сегментов`);
    return segmentPaths;
  } catch (error) {
    logger.error(`Ошибка при разделении аудиофайла: ${error.message}`);
    // Возвращаем исходный файл в случае ошибки
    return [inputPath];
  }
}

/**
 * Очищает временные файлы
 * @param {Array<string>} filePaths Массив путей к файлам
 * @returns {Promise<number>} Количество удаленных файлов
 */
async function cleanupTempFiles(filePaths) {
  let deletedCount = 0;
  
  for (const filePath of filePaths) {
    try {
      // Проверяем, является ли файл временным (находится в temp директории)
      if (filePath.includes(tempDir)) {
        await fs.promises.unlink(filePath);
        deletedCount++;
      }
    } catch (error) {
      logger.warn(`Не удалось удалить файл ${filePath}: ${error.message}`);
    }
  }
  
  logger.info(`Удалено ${deletedCount} временных файлов`);
  return deletedCount;
}

export default {
  ensureDirectoryExists,
  isSupportedFormat,
  getMediaInfo,
  optimizeAudio,
  optimizeAudioForGPT4o,  // Добавляем новую функцию в экспорт
  convertToWav,
  convertToMp3,
  splitAudioFile,
  cleanupTempFiles
};