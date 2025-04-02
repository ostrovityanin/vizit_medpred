/**
 * Скрипт для тестирования микросервиса GPT-4o Audio
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import FormData from 'form-data';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Настройки сервиса
const SERVICE_URL = 'http://localhost:3100';

// Проверяем настройки OpenAI
if (!process.env.OPENAI_API_KEY) {
  console.error('\x1b[31mОшибка: OpenAI API ключ не настроен в .env файле\x1b[0m');
  process.exit(1);
}

/**
 * Выполняет запрос на проверку здоровья сервиса
 */
async function checkHealth() {
  try {
    console.log('\x1b[34mПроверка доступности сервиса...\x1b[0m');
    
    const response = await fetch(`${SERVICE_URL}/health`);
    
    if (!response.ok) {
      throw new Error(`Сервис недоступен. Статус: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`\x1b[32mСервис доступен. Версия: ${data.version}\x1b[0m`);
    console.log(`\x1b[32mOpenAI настроен: ${data.openaiConfigured ? 'Да' : 'Нет'}\x1b[0m`);
    
    return true;
  } catch (error) {
    console.error(`\x1b[31mОшибка при проверке сервиса: ${error.message}\x1b[0m`);
    return false;
  }
}

/**
 * Отправляет тестовый аудиофайл на транскрипцию
 */
async function testTranscription(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Файл не найден: ${filePath}`);
    }
    
    console.log(`\x1b[34mОтправка файла на транскрипцию: ${filePath}\x1b[0m`);
    
    const formData = new FormData();
    formData.append('audioFile', fs.createReadStream(filePath));
    formData.append('optimize', 'true');
    formData.append('format', 'dialogue');
    
    const response = await fetch(`${SERVICE_URL}/api/transcribe`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка при транскрипции (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    
    console.log('\n\x1b[36m========== РЕЗУЛЬТАТ ТРАНСКРИПЦИИ ==========\x1b[0m');
    console.log(`\x1b[37m${result.transcription.formatted}\x1b[0m`);
    console.log('\x1b[36m============================================\x1b[0m\n');
    
    console.log('\x1b[32mМетаданные:\x1b[0m');
    console.log(`\x1b[32mИсходный файл: ${result.metadata.filename}\x1b[0m`);
    console.log(`\x1b[32mРазмер: ${(result.metadata.filesize / 1024 / 1024).toFixed(2)} MB\x1b[0m`);
    console.log(`\x1b[32mДлительность: ${result.metadata.duration.toFixed(2)} секунд\x1b[0m`);
    console.log(`\x1b[32mТокенов использовано: ${result.metadata.tokensProcessed}\x1b[0m`);
    console.log(`\x1b[32m${result.metadata.cost}\x1b[0m`);
    
    return true;
  } catch (error) {
    console.error(`\x1b[31mОшибка при тестировании транскрипции: ${error.message}\x1b[0m`);
    return false;
  }
}

/**
 * Основная функция тестирования
 */
async function runTest() {
  try {
    // Проверяем доступность сервиса
    const serviceAvailable = await checkHealth();
    if (!serviceAvailable) {
      console.error('\x1b[31mТестирование прервано из-за недоступности сервиса\x1b[0m');
      return;
    }
    
    // Ищем тестовый аудиофайл
    const sampleFile = path.join(__dirname, 'sample.wav');
    
    if (!fs.existsSync(sampleFile)) {
      console.error(`\x1b[31mТестовый файл не найден: ${sampleFile}\x1b[0m`);
      console.log('\x1b[33mПоиск альтернативных файлов...\x1b[0m');
      
      // Ищем файлы в других директориях
      const testDirs = [
        path.join(__dirname, '../../test_audio'),
        path.join(__dirname, '../../server/uploads')
      ];
      
      let found = false;
      
      for (const dir of testDirs) {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir).filter(file => 
            ['.wav', '.mp3', '.webm', '.ogg', '.m4a'].some(ext => file.endsWith(ext))
          );
          
          if (files.length > 0) {
            const testFile = path.join(dir, files[0]);
            console.log(`\x1b[32mНайден альтернативный файл: ${testFile}\x1b[0m`);
            await testTranscription(testFile);
            found = true;
            break;
          }
        }
      }
      
      if (!found) {
        console.error('\x1b[31mНе найдено ни одного аудиофайла для тестирования\x1b[0m');
      }
    } else {
      await testTranscription(sampleFile);
    }
    
  } catch (error) {
    console.error(`\x1b[31mНеобработанная ошибка: ${error.message}\x1b[0m`);
    if (error.stack) {
      console.error(`\x1b[31m${error.stack}\x1b[0m`);
    }
  }
}

runTest();