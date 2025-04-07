/**
 * Скрипт для создания тестового аудиофайла
 */

import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESM эквивалент __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Создаем директории, если они не существуют
const recordingsDir = path.join(process.cwd(), 'data', 'recordings');
const fragmentsDir = path.join(process.cwd(), 'data', 'fragments');

if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
  console.log(`Создана директория: ${recordingsDir}`);
}

if (!fs.existsSync(fragmentsDir)) {
  fs.mkdirSync(fragmentsDir, { recursive: true });
  console.log(`Создана директория: ${fragmentsDir}`);
}

// Генерация тестового аудио
async function generateTestAudio(outputPath, frequency = 440, duration = 5) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .audioFrequency(44100)
      .audioChannels(1)
      .audioBitrate('32k')
      .input('anullsrc=channel_layout=mono:sample_rate=16000')
      .inputFormat('lavfi')
      .audioFilters(`sine=frequency=${frequency}:duration=${duration}`)
      .output(outputPath)
      .on('start', (cmd) => {
        console.log(`Запуск FFmpeg с командой: ${cmd}`);
      })
      .on('error', (err) => {
        console.error(`Ошибка при генерации аудио: ${err.message}`);
        reject(err);
      })
      .on('end', () => {
        console.log(`Аудиофайл успешно создан: ${outputPath}`);
        resolve(outputPath);
      })
      .run();
  });
}

// Основная функция
async function main() {
  try {
    // Генерируем тестовый файл записи
    const recordingFilename = 'test-recording.mp3';
    const recordingPath = path.join(recordingsDir, recordingFilename);
    await generateTestAudio(recordingPath, 440, 10);
    
    // Обновляем запись в базе данных
    const recordingData = {
      id: 1,
      filename: recordingFilename,
      originalFilename: recordingFilename,
      timestamp: new Date().toISOString(),
      size: fs.statSync(recordingPath).size,
      status: 'completed',
      targetUsername: 'test-user',
      senderUsername: 'Test User',
      duration: 10,
      fileSize: fs.statSync(recordingPath).size,
      fileExists: true
    };
    
    // Генерируем фрагменты
    const fragmentsCount = 3;
    for (let i = 0; i < fragmentsCount; i++) {
      const fragmentFilename = `test-fragment-${i+1}.mp3`;
      const fragmentPath = path.join(fragmentsDir, fragmentFilename);
      await generateTestAudio(fragmentPath, 440 + (i * 200), 3);
      
      // Фрагменты тоже должны сохраняться в базе данных
      const fragmentData = {
        id: i + 1,
        recordingId: 1,
        sessionId: 'test-session',
        filename: fragmentFilename,
        fragmentIndex: i,
        duration: 3,
        fileSize: fs.statSync(fragmentPath).size
      };
      
      console.log(`Создан фрагмент ${i+1}:`, fragmentData);
    }
    
    console.log('Тестовые аудиофайлы успешно созданы.');
  } catch (error) {
    console.error('Ошибка при создании тестовых аудиофайлов:', error);
  }
}

main();