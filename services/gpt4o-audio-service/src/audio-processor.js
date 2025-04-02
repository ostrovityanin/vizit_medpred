/**
 * Модуль для обработки и оптимизации аудиофайлов
 */

const fs = require('fs');
const path = require('path');
const { log } = require('./logger');
const crypto = require('crypto');

// Проверяем, установлен ли ffmpeg
let ffmpeg;
try {
  ffmpeg = require('fluent-ffmpeg');
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
  ffmpeg.setFfmpegPath(ffmpegPath);
  log.info(`ffmpeg успешно инициализирован с путем: ${ffmpegPath}`);
} catch (error) {
  log.error(`Ошибка при инициализации ffmpeg: ${error.message}`);
  throw new Error('Не удалось загрузить ffmpeg. Убедитесь, что установлены пакеты fluent-ffmpeg и @ffmpeg-installer/ffmpeg');
}

/**
 * Создает временную директорию для обработанных аудиофайлов
 * @returns {string} Путь к временной директории
 */
function ensureTempDir() {
  const tempDir = path.join(__dirname, '../temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    log.debug(`Создана временная директория: ${tempDir}`);
  }
  return tempDir;
}

/**
 * Оптимизирует аудиофайл для распознавания речи
 * @param {string} inputPath Путь к исходному аудиофайлу
 * @param {string} outputPath Путь для сохранения оптимизированного файла (необязательно)
 * @returns {Promise<string>} Путь к оптимизированному файлу
 */
async function optimizeAudioForTranscription(inputPath, outputPath = null) {
  try {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Входной файл не найден: ${inputPath}`);
    }

    // Если выходной путь не указан, создаем временный файл
    if (!outputPath) {
      const tempDir = ensureTempDir();
      const randomHash = crypto.randomBytes(8).toString('hex');
      const fileName = `optimized_${randomHash}_${path.basename(inputPath)}`;
      outputPath = path.join(tempDir, fileName.replace(/\.[^/.]+$/, '.mp3'));
    }

    log.info(`Оптимизируем аудиофайл: ${inputPath} -> ${outputPath}`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .output(outputPath)
        .noVideo()
        .audioChannels(1)           // Моно звук
        .audioFrequency(16000)      // Частота дискретизации 16 кГц
        .audioBitrate('32k')        // Битрейт 32 кбит/с
        .audioFilters([
          'highpass=f=200',         // Фильтр высоких частот (убираем низкий шум)
          'lowpass=f=3000',         // Фильтр низких частот (фокус на речи)
          'volume=2.0',             // Увеличиваем громкость
          'dynaudnorm'              // Нормализация звука
        ])
        .format('mp3')             // Формат MP3 (поддерживается API OpenAI)
        .on('start', command => {
          log.debug(`Запущена команда ffmpeg: ${command}`);
        })
        .on('progress', progress => {
          // Отслеживаем прогресс только для больших файлов
          if (progress && progress.percent) {
            const fileSize = fs.statSync(inputPath).size / (1024 * 1024);
            if (fileSize > 10) {
              log.debug(`Прогресс обработки: ${Math.round(progress.percent)}%`);
            }
          }
        })
        .on('error', err => {
          log.error(`Ошибка при оптимизации аудио: ${err.message}`);
          reject(err);
        })
        .on('end', () => {
          log.info(`Аудиофайл успешно оптимизирован и сохранен как ${outputPath}`);
          resolve(outputPath);
        })
        .run();
    });
  } catch (error) {
    log.error(`Ошибка при оптимизации аудиофайла: ${error.message}`);
    throw error;
  }
}

/**
 * Разделяет аудиофайл на сегменты указанной длительности
 * @param {string} inputPath Путь к исходному файлу
 * @param {string} outputDir Директория для сохранения сегментов
 * @param {number} segmentDurationSeconds Длительность каждого сегмента в секундах
 * @returns {Promise<string[]>} Массив путей к созданным сегментам
 */
async function splitAudioFile(inputPath, outputDir = null, segmentDurationSeconds = 300) {
  try {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Входной файл не найден: ${inputPath}`);
    }

    // Если директория для вывода не указана, используем временную директорию
    if (!outputDir) {
      outputDir = ensureTempDir();
    } else if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const randomHash = crypto.randomBytes(4).toString('hex');
    const baseFileName = path.basename(inputPath, path.extname(inputPath));
    const segmentPattern = path.join(outputDir, `${baseFileName}_${randomHash}_segment_%03d.mp3`);

    log.info(`Разделяем аудиофайл ${inputPath} на сегменты по ${segmentDurationSeconds} секунд`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .output(segmentPattern)
        .noVideo()
        .audioChannels(1)
        .audioFrequency(16000)
        .audioBitrate('32k')
        .audioFilters([
          'highpass=f=200',
          'lowpass=f=3000',
          'volume=2.0',
          'dynaudnorm'
        ])
        .format('mp3')
        .outputOptions([
          `-segment_time ${segmentDurationSeconds}`,
          '-f segment'
        ])
        .on('start', command => {
          log.debug(`Запущена команда ffmpeg для разделения: ${command}`);
        })
        .on('error', err => {
          log.error(`Ошибка при разделении аудио: ${err.message}`);
          reject(err);
        })
        .on('end', async () => {
          // Читаем созданные файлы
          const files = fs.readdirSync(outputDir)
            .filter(file => file.startsWith(`${baseFileName}_${randomHash}_segment_`))
            .map(file => path.join(outputDir, file))
            .sort(); // Сортируем файлы по имени для правильного порядка

          log.info(`Аудиофайл успешно разделен на ${files.length} сегментов`);
          resolve(files);
        })
        .run();
    });
  } catch (error) {
    log.error(`Ошибка при разделении аудиофайла: ${error.message}`);
    throw error;
  }
}

module.exports = {
  optimizeAudioForTranscription,
  splitAudioFile,
  ensureTempDir
};