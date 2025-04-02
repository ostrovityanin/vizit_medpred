/**
 * Тестовый скрипт для проверки GPT-4o Audio Service
 * 
 * Скрипт отправляет тестовый аудиофайл на транскрипцию и выводит результат.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { transcribeWithGPT4o, isOpenAIConfigured } from './gpt4o-client.js';
import { optimizeAudioForTranscription, getAudioDuration } from './audio-processor.js';

// Получаем текущую директорию (для ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Проверяем настройки OpenAI API
if (!isOpenAIConfigured()) {
  console.error('\x1b[31mОшибка: OpenAI API ключ не настроен в переменных окружения!\x1b[0m');
  console.error('Пожалуйста, добавьте OPENAI_API_KEY в .env файл и перезапустите скрипт.');
  process.exit(1);
}

// Путь к тестовому аудиофайлу (примечание: должен существовать для успешного тестирования)
let testAudioPath = process.argv[2]; // Путь можно передать как аргумент командной строки

if (!testAudioPath) {
  // Если не указан, пробуем найти существующий файл в проекте
  const possiblePaths = [
    path.join(__dirname, '../../server/uploads'),
    path.join(__dirname, '../../test_audio'),
    path.join(__dirname, '../uploads')
  ];
  
  for (const dir of possiblePaths) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter(file => 
        ['.wav', '.mp3', '.webm', '.ogg', '.m4a'].some(ext => file.endsWith(ext))
      );
      
      if (files.length > 0) {
        testAudioPath = path.join(dir, files[0]);
        break;
      }
    }
  }
  
  if (!testAudioPath) {
    console.error('\x1b[31mОшибка: Не найден тестовый аудиофайл!\x1b[0m');
    console.error('Укажите путь к аудиофайлу в качестве аргумента командной строки.');
    process.exit(1);
  }
}

console.log(`\x1b[34mНачинаем тестирование с файлом: ${testAudioPath}\x1b[0m`);

// Проверяем, существует ли файл
if (!fs.existsSync(testAudioPath)) {
  console.error(`\x1b[31mОшибка: Файл не найден: ${testAudioPath}\x1b[0m`);
  process.exit(1);
}

// Вывод информации о файле
const stats = fs.statSync(testAudioPath);
console.log(`\x1b[34mРазмер файла: ${(stats.size / 1024 / 1024).toFixed(2)} MB\x1b[0m`);

async function runTest() {
  try {
    console.log('\x1b[34mПолучение длительности аудио...\x1b[0m');
    const duration = await getAudioDuration(testAudioPath);
    console.log(`\x1b[32mДлительность: ${duration.toFixed(2)} секунд\x1b[0m`);
    
    console.log('\x1b[34mОптимизация аудиофайла...\x1b[0m');
    const optimizedPath = await optimizeAudioForTranscription(testAudioPath);
    console.log(`\x1b[32mФайл оптимизирован: ${optimizedPath}\x1b[0m`);
    
    console.log('\x1b[34mНачинаем транскрипцию с GPT-4o Audio...\x1b[0m');
    console.log('\x1b[33mЭто может занять некоторое время, в зависимости от длительности аудио...\x1b[0m');
    
    const startTime = Date.now();
    const result = await transcribeWithGPT4o(optimizedPath);
    const endTime = Date.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\x1b[32mТранскрипция завершена за ${processingTime} секунд!\x1b[0m`);
    console.log(`\x1b[32mИспользовано токенов: ${result.tokensProcessed}\x1b[0m`);
    console.log(`\x1b[32m${result.cost}\x1b[0m`);
    
    console.log('\n\x1b[36m========== РЕЗУЛЬТАТ ТРАНСКРИПЦИИ ==========\x1b[0m');
    console.log(`\x1b[37m${result.text}\x1b[0m`);
    console.log('\x1b[36m============================================\x1b[0m\n');
    
    // Очищаем временный оптимизированный файл
    try {
      fs.unlinkSync(optimizedPath);
      console.log('\x1b[32mВременные файлы очищены\x1b[0m');
    } catch (e) {
      console.warn(`\x1b[33mНе удалось удалить временный файл: ${e.message}\x1b[0m`);
    }
    
    console.log('\x1b[32mТестирование успешно завершено!\x1b[0m');
  } catch (error) {
    console.error(`\x1b[31mОшибка при тестировании: ${error.message}\x1b[0m`);
    if (error.stack) {
      console.error(`\x1b[31m${error.stack}\x1b[0m`);
    }
    process.exit(1);
  }
}

runTest();