/**
 * Быстрая генерация тестового аудиофайла для диаризации
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec as execCb } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Преобразуем callback-версию exec в Promise
const exec = promisify(execCb);

// Получаем путь к текущему файлу и директории (для совместимости с ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Убедимся, что директория test_audio существует
const TEST_AUDIO_DIR = path.join(__dirname, 'test_audio');
if (!fs.existsSync(TEST_AUDIO_DIR)) {
  fs.mkdirSync(TEST_AUDIO_DIR, { recursive: true });
}

/**
 * Генерация тестового аудио с определенной частотой и длительностью
 * @param {string} outputPath Путь для сохранения аудиофайла
 * @param {number} frequency Частота тона в Гц
 * @param {number} duration Длительность в секундах
 * @returns {Promise<string>} Путь к созданному файлу
 */
async function generateTestAudio(outputPath, frequency = 440, duration = 5) {
  try {
    console.log(`Генерация тестового аудио: ${outputPath} (${frequency} Гц, ${duration} сек)`);
    
    // Создаем тональный сигнал с помощью FFmpeg
    const command = `ffmpeg -f lavfi -i "sine=frequency=${frequency}:duration=${duration}" -c:a libmp3lame -q:a 2 "${outputPath}" -y`;
    
    await exec(command);
    console.log(`Аудиофайл создан: ${outputPath}`);
    
    return outputPath;
  } catch (error) {
    console.error(`Ошибка при генерации аудиофайла: ${error.message}`);
    throw error;
  }
}

/**
 * Основная функция
 */
async function main() {
  try {
    // Путь для сохранения тестового файла
    const testFilePath = path.join(TEST_AUDIO_DIR, 'test.mp3');
    
    // Генерируем простой тестовый файл
    await generateTestAudio(testFilePath, 440, 3);
    
    console.log(`\n✅ Тестовый аудиофайл успешно создан:`);
    console.log(`   ${testFilePath}`);
    console.log(`\n💡 Теперь вы можете использовать этот файл для тестирования диаризации:`);
    console.log(`   node test-diarization-service-quick.js`);
  } catch (error) {
    console.error(`❌ Ошибка: ${error.message}`);
  }
}

// Запускаем основную функцию
main();