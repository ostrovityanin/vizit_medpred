import fs from 'fs-extra';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { convertAudioFormat, optimizeAudioForTranscription as optimizeAudio } from './ffmpeg';

/**
 * Объединяет фрагменты аудио в один файл
 * @param fragmentPaths Массив путей к фрагментам аудио
 * @param outputPath Путь к выходному объединенному файлу
 */
export async function combineAudioFragments(
  fragmentPaths: string[],
  outputPath: string
): Promise<string> {
  // Создаем временный файл со списком фрагментов для ffmpeg
  const tempDir = path.dirname(outputPath);
  const tempFile = path.join(tempDir, `fragments-${Date.now()}.txt`);
  
  // Записываем пути к фрагментам в файл
  const fileContent = fragmentPaths
    .map(p => `file '${p.replace(/'/g, "\\'")}'`)
    .join('\n');
  
  await fs.writeFile(tempFile, fileContent);
  
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(tempFile)
      .inputOptions(['-f concat', '-safe 0'])
      .output(outputPath)
      .outputOptions('-c copy') // Копируем кодеки без перекодирования
      .on('end', () => {
        // Удаляем временный файл
        fs.remove(tempFile)
          .then(() => resolve(outputPath))
          .catch(err => console.error('Ошибка удаления временного файла:', err));
      })
      .on('error', (err) => {
        fs.remove(tempFile).catch(err => 
          console.error('Ошибка удаления временного файла:', err)
        );
        reject(err);
      })
      .run();
  });
}

/**
 * Оптимизирует аудио для транскрипции
 * @param inputPath Путь к входному файлу
 * @param outputPath Путь к выходному файлу (опционально)
 */
export async function optimizeAudioForTranscription(
  inputPath: string,
  outputPath?: string
): Promise<string> {
  return optimizeAudio(inputPath, outputPath);
}

/**
 * Вычисляет размер аудиофайла в байтах
 * @param filePath Путь к аудиофайлу
 */
export async function getAudioFileSize(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath);
  return stats.size;
}

/**
 * Удаляет временные файлы фрагментов
 * @param fragmentPaths Массив путей к фрагментам
 */
export async function cleanupFragments(fragmentPaths: string[]): Promise<void> {
  const promises = fragmentPaths.map(path => fs.remove(path).catch(err => {
    console.error(`Ошибка удаления фрагмента ${path}:`, err);
  }));
  
  await Promise.all(promises);
}