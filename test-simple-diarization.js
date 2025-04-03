/**
 * Тестирование упрощенной диаризации аудио
 * 
 * Этот скрипт тестирует более быструю версию диаризации,
 * которая использует FFmpeg для определения говорящих.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Импортируем модуль диаризации
import { simpleDiarizeAudio } from './server/simple-diarization.js';

// Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Директория с тестовыми аудиофайлами
const TEST_AUDIO_DIR = path.join(__dirname, 'test_audio');

/**
 * Основная функция
 */
async function main() {
  try {
    console.log('Запуск теста упрощенной диаризации...');
    
    // Пути к тестовым аудиофайлам
    const singleSpeakerPath = path.join(TEST_AUDIO_DIR, 'sample.mp3');
    const multiSpeakerPath = path.join(TEST_AUDIO_DIR, 'multi_speaker.mp3');
    
    // Проверяем существование файлов
    if (!fs.existsSync(singleSpeakerPath)) {
      console.error(`Тестовый файл не найден: ${singleSpeakerPath}`);
      console.log('Сначала запустите generate-test-audio-v2.js для создания тестовых файлов');
      return;
    }
    
    // Тестируем диаризацию
    console.log('\n=== Тест 1: Один говорящий ===');
    const result1 = await simpleDiarizeAudio(singleSpeakerPath);
    console.log('\nРезультат диаризации одного говорящего:');
    console.log(JSON.stringify(result1, null, 2));
    
    console.log('\n=== Тест 2: Несколько говорящих ===');
    if (fs.existsSync(multiSpeakerPath)) {
      const result2 = await simpleDiarizeAudio(multiSpeakerPath);
      console.log('\nРезультат диаризации нескольких говорящих:');
      console.log(JSON.stringify(result2, null, 2));
    } else {
      console.log(`Файл с несколькими говорящими не найден: ${multiSpeakerPath}`);
      console.log('Пропускаю тест с несколькими говорящими');
    }
    
    console.log('\nТесты успешно завершены');
    
  } catch (error) {
    console.error('Ошибка при тестировании:', error);
  }
}

// Запускаем основную функцию
main();