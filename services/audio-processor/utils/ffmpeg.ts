import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import fs from 'fs-extra';
import path from 'path';

// Установка пути к ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath.path);

/**
 * Получает длительность аудиофайла в секундах
 * @param filePath Путь к аудиофайлу
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(err);
      }
      
      const duration = metadata.format.duration || 0;
      resolve(duration);
    });
  });
}

/**
 * Конвертирует аудиофайл в указанный формат
 * @param inputPath Путь к входному файлу
 * @param outputPath Путь к выходному файлу
 * @param format Формат выходного файла (mp3, wav, ogg и т.д.)
 */
export async function convertAudioFormat(
  inputPath: string,
  outputPath: string,
  format: string = 'wav'
): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .audioCodec(format === 'wav' ? 'pcm_s16le' : format === 'mp3' ? 'libmp3lame' : format)
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', (err) => {
        reject(err);
      })
      .run();
  });
}

/**
 * Оптимизирует аудиофайл для лучшего качества транскрипции
 * @param inputPath Путь к входному файлу
 * @param outputPath Путь к выходному файлу (опционально)
 */
export async function optimizeAudioForTranscription(
  inputPath: string,
  outputPath?: string
): Promise<string> {
  if (!outputPath) {
    const dir = path.dirname(inputPath);
    const filename = path.basename(inputPath, path.extname(inputPath));
    outputPath = path.join(dir, `${filename}-optimized.wav`);
  }
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .audioChannels(1) // Моно
      .audioFrequency(16000) // 16 кГц
      .audioBitrate('32k') // 32 кбит/с
      .audioCodec('pcm_s16le') // WAV формат
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', (err) => {
        reject(err);
      })
      .run();
  });
}

/**
 * Разделяет аудиофайл на сегменты указанной длительности
 * @param inputPath Путь к входному файлу
 * @param outputDir Директория для выходных файлов
 * @param segmentDuration Длительность сегмента в секундах
 */
export async function splitAudioIntoSegments(
  inputPath: string,
  outputDir: string,
  segmentDuration: number = 60
): Promise<string[]> {
  const filename = path.basename(inputPath, path.extname(inputPath));
  const outputPattern = path.join(outputDir, `${filename}-segment-%03d.wav`);
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPattern)
      .audioCodec('pcm_s16le')
      .audioChannels(1)
      .audioFrequency(16000)
      .outputOptions([`-segment_time ${segmentDuration}`, '-f segment'])
      .on('end', () => {
        // Получаем список созданных файлов
        fs.readdir(outputDir, (err, files) => {
          if (err) return reject(err);
          
          const segmentFiles = files
            .filter(file => file.startsWith(`${filename}-segment-`))
            .map(file => path.join(outputDir, file))
            .sort(); // Сортируем по имени файла
          
          resolve(segmentFiles);
        });
      })
      .on('error', (err) => {
        reject(err);
      })
      .run();
  });
}