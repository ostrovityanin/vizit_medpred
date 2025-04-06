/**
 * Генерация тестовых аудиофайлов для тестирования API
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Получаем путь к текущему файлу и директории
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Путь к директории с тестовыми файлами
const TEST_AUDIO_DIR = path.join(__dirname, 'test_audio');

/**
 * Создаем директорию, если её не существует
 */
if (!fs.existsSync(TEST_AUDIO_DIR)) {
  fs.mkdirSync(TEST_AUDIO_DIR, { recursive: true });
}

/**
 * Генерация тонального сигнала заданной частоты и длительности
 * @param {string} outputPath Путь для сохранения файла
 * @param {number} frequency Частота сигнала в Гц
 * @param {number} duration Длительность в секундах
 * @returns {Promise<string>} Путь к созданному файлу
 */
async function generateToneFile(outputPath, frequency = 440, duration = 3) {
  console.log(`Генерация тонального сигнала ${frequency} Гц в файл: ${outputPath}`);
  
  // Команда FFmpeg для создания тонального сигнала
  const command = `ffmpeg -f lavfi -i "sine=frequency=${frequency}:duration=${duration}" -c:a libmp3lame -b:a 32k "${outputPath}" -y`;
  
  try {
    await execAsync(command);
    console.log(`Файл успешно создан: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`Ошибка при создании файла: ${error.message}`);
    throw error;
  }
}

/**
 * Создание простого тестового аудиофайла
 */
async function createShortTestFile() {
  const outputPath = path.join(TEST_AUDIO_DIR, 'short_test.mp3');
  return generateToneFile(outputPath, 440, 2);
}

/**
 * Создание файла с "диалогом" (два разных тона, чередующиеся)
 */
async function createDialogTestFile() {
  const outputPath = path.join(TEST_AUDIO_DIR, 'dialog_test.mp3');
  
  console.log(`Создание тестового "диалога" в файл: ${outputPath}`);
  
  try {
    // Создадим два временных файла с разными тонами
    const tone1File = path.join(TEST_AUDIO_DIR, 'temp_tone1.mp3');
    const tone2File = path.join(TEST_AUDIO_DIR, 'temp_tone2.mp3');
    
    // Команды для создания двух разных тональных файлов
    const command1 = `ffmpeg -f lavfi -i "sine=frequency=440:duration=1.5" -c:a libmp3lame -b:a 32k "${tone1File}" -y`;
    const command2 = `ffmpeg -f lavfi -i "sine=frequency=880:duration=1.5" -c:a libmp3lame -b:a 32k "${tone2File}" -y`;
    
    // Создаем временные файлы
    await execAsync(command1);
    await execAsync(command2);
    
    // Теперь объединяем их в один файл
    const concatCommand = `ffmpeg -i "${tone1File}" -i "${tone2File}" -i "${tone1File}" -i "${tone2File}" -i "${tone1File}" -filter_complex "[0:a][1:a][2:a][3:a][4:a]concat=n=5:v=0:a=1[out]" -map "[out]" -c:a libmp3lame -b:a 32k "${outputPath}" -y`;
    
    await execAsync(concatCommand);
    
    console.log(`Файл с "диалогом" успешно создан: ${outputPath}`);
    
    // Удаляем временные файлы
    fs.unlinkSync(tone1File);
    fs.unlinkSync(tone2File);
    
    return outputPath;
  } catch (error) {
    console.error(`Ошибка при создании файла с "диалогом": ${error.message}`);
    
    // Удаляем временные файлы при ошибке
    try {
      const tone1File = path.join(TEST_AUDIO_DIR, 'temp_tone1.mp3');
      const tone2File = path.join(TEST_AUDIO_DIR, 'temp_tone2.mp3');
      if (fs.existsSync(tone1File)) fs.unlinkSync(tone1File);
      if (fs.existsSync(tone2File)) fs.unlinkSync(tone2File);
    } catch (cleanupError) {
      console.error(`Ошибка при удалении временных файлов: ${cleanupError.message}`);
    }
    
    throw error;
  }
}

/**
 * Создание файла с несколькими тонами для проверки диаризации
 */
async function createMultiSpeakerTestFile() {
  // Для упрощения просто будем использовать тот же диалоговый файл
  // вместо смешивания аудио, что может вызывать проблемы в Replit
  const dialogFile = path.join(TEST_AUDIO_DIR, 'dialog_test.mp3');
  const outputPath = path.join(TEST_AUDIO_DIR, 'multi_speaker_test.mp3');
  
  console.log(`Создание тестового файла с несколькими "говорящими": ${outputPath}`);
  
  try {
    // Проверяем существование диалогового файла
    if (!fs.existsSync(dialogFile)) {
      console.log('Диалоговый файл не найден, сначала создаем его...');
      await createDialogTestFile();
    }
    
    // Копируем диалоговый файл
    fs.copyFileSync(dialogFile, outputPath);
    
    console.log(`Файл с несколькими "говорящими" успешно создан: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`Ошибка при создании файла с несколькими "говорящими": ${error.message}`);
    throw error;
  }
}

/**
 * Основная функция
 */
async function main() {
  console.log('Начало создания тестовых аудиофайлов...');
  
  try {
    await createShortTestFile();
    await createDialogTestFile();
    await createMultiSpeakerTestFile();
    
    console.log('Все тестовые аудиофайлы успешно созданы!');
  } catch (error) {
    console.error(`Критическая ошибка при создании тестовых файлов: ${error.message}`);
  }
}

// Запускаем генерацию тестовых файлов
main();