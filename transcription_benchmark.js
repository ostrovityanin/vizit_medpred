/**
 * Сравнительный бенчмарк моделей транскрипции
 * 
 * Этот скрипт сравнивает производительность и результаты разных моделей транскрипции OpenAI:
 * - whisper-1
 * - gpt-4o-transcribe
 * - gpt-4o-mini-transcribe
 */

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Получаем API ключ OpenAI из переменных окружения
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Проверка наличия API ключа OpenAI
 */
function hasOpenAIKey() {
  if (!OPENAI_API_KEY) {
    console.error('Ошибка: OPENAI_API_KEY не установлен в переменных окружения');
    return false;
  }
  return true;
}

/**
 * Оптимизирует аудиофайл для транскрипции
 * @param {string} inputPath Путь к исходному файлу
 * @returns {Promise<string>} Путь к оптимизированному файлу
 */
async function optimizeAudio(inputPath) {
  const outputPath = inputPath.replace(/\.\w+$/, '.mp3');
  
  try {
    // Конвертируем в MP3 с оптимальными параметрами для транскрипции
    await execPromise(`ffmpeg -i "${inputPath}" -ar 16000 -ac 1 -b:a 32k "${outputPath}" -y`);
    console.log(`Аудиофайл оптимизирован: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Ошибка при оптимизации аудио:', error);
    throw error;
  }
}

/**
 * Транскрибирует аудиофайл с использованием указанной модели
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {string} model Модель для транскрипции
 * @returns {Promise<{text: string, time: number}>} Результат транскрипции и время выполнения
 */
async function transcribeWithModel(audioFilePath, model) {
  if (!fs.existsSync(audioFilePath)) {
    console.error(`Ошибка: Файл ${audioFilePath} не существует`);
    return null;
  }

  console.log(`Транскрипция файла ${audioFilePath} с помощью модели ${model}...`);
  
  const startTime = Date.now();
  
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model', model);
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    const endTime = Date.now();
    const elapsed = (endTime - startTime) / 1000; // в секундах
    
    if (response.ok) {
      const data = await response.json();
      return { text: data.text, time: elapsed };
    } else {
      const errorText = await response.text();
      console.error(`Ошибка API: ${response.status} ${response.statusText}`);
      console.error(errorText);
      return { text: `Ошибка: ${response.status}`, time: elapsed };
    }
  } catch (error) {
    const endTime = Date.now();
    const elapsed = (endTime - startTime) / 1000; // в секундах
    
    console.error('Ошибка при запросе транскрипции:', error);
    return { text: `Ошибка: ${error.message}`, time: elapsed };
  }
}

/**
 * Прогоняет файл через все три модели транскрипции и сравнивает результаты
 * @param {string} audioFilePath Путь к аудиофайлу для транскрипции
 */
async function compareTranscriptionModels(audioFilePath) {
  try {
    // Оптимизируем аудиофайл для транскрипции
    const optimizedPath = await optimizeAudio(audioFilePath);
    
    // Тестируем все три модели
    const models = ['whisper-1', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe'];
    const results = {};
    
    console.log('='.repeat(80));
    console.log(`Бенчмарк транскрипции для файла: ${path.basename(audioFilePath)}`);
    console.log('='.repeat(80));
    
    for (const model of models) {
      results[model] = await transcribeWithModel(optimizedPath, model);
    }
    
    // Вывод результатов в таблице
    console.log('\nРезультаты транскрипции:');
    console.log('-'.repeat(80));
    console.log('| Модель                | Время (сек) | Результат');
    console.log('-'.repeat(80));
    
    for (const model of models) {
      const { text, time } = results[model];
      console.log(`| ${model.padEnd(22)} | ${time.toFixed(2).padStart(11)} | ${text}`);
    }
    
    console.log('-'.repeat(80));
    console.log();
    
    return results;
  } catch (error) {
    console.error('Ошибка при сравнении моделей:', error);
  }
}

/**
 * Основная функция
 */
async function main() {
  if (!hasOpenAIKey()) {
    return;
  }
  
  // Тестируем разные типы файлов
  const testFiles = [
    './test_audio/test_ru.wav'
  ];
  
  for (const file of testFiles) {
    await compareTranscriptionModels(file);
  }
}

// Запуск основной функции
main().catch(console.error);