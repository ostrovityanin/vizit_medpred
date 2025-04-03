/**
 * Бенчмарк для сравнения моделей транскрипции аудио
 * 
 * Этот скрипт тестирует скорость и точность разных моделей транскрипции
 * для русского и английского языков.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { fileURLToPath } from 'url';

// Для работы с __dirname в ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// URL API
const API_URL = 'http://localhost:5000/api';

// Пути для тестовых аудиофайлов
const TEST_AUDIO_DIR = path.join(__dirname, 'test_audio');
const TEST_FILES = {
  russian: [
    { path: path.join(TEST_AUDIO_DIR, 'short_russian.mp3'), description: 'Короткое русское аудио (5 сек)' },
    { path: path.join(TEST_AUDIO_DIR, 'test_ru.mp3'), description: 'Среднее русское аудио (10 сек)' }
  ],
  english: [
    { path: path.join(TEST_AUDIO_DIR, 'short_english.mp3'), description: 'Английское аудио' }
  ]
};

/**
 * Форматированный вывод результатов бенчмарка в консоль
 * @param {Object} results Результаты бенчмарка
 */
function printBenchmarkResults(results) {
  console.log('====================================================');
  console.log('РЕЗУЛЬТАТЫ БЕНЧМАРКА ТРАНСКРИПЦИИ АУДИО');
  console.log('====================================================');
  
  // Группируем результаты по языкам
  const byLanguage = {};
  
  for (const result of results) {
    const language = result.language;
    if (!byLanguage[language]) {
      byLanguage[language] = [];
    }
    byLanguage[language].push(result);
  }
  
  // Выводим результаты по каждому языку
  for (const language of Object.keys(byLanguage)) {
    console.log(`\n== ЯЗЫК: ${language.toUpperCase()} ==`);
    
    // Сортируем файлы по описанию
    const sortedResults = byLanguage[language].sort((a, b) => 
      a.description.localeCompare(b.description)
    );
    
    for (const result of sortedResults) {
      console.log(`\n--- ${result.description} (файл: ${path.basename(result.filePath)}) ---`);
      console.log(`Размер файла: ${(result.fileSize / 1024).toFixed(2)} KB`);
      
      // Сортируем модели по скорости
      const models = Object.keys(result.models)
        .filter(model => result.models[model].text)
        .sort((a, b) => result.models[a].processingTime - result.models[b].processingTime);
      
      console.log('\nРейтинг моделей по скорости:');
      models.forEach((model, index) => {
        const modelResult = result.models[model];
        console.log(`${index + 1}. ${model}: ${modelResult.processingTime.toFixed(2)}s`);
        console.log(`   Текст: "${modelResult.text}"`);
      });
    }
  }
  
  console.log('\n====================================================');
}

/**
 * Тест транскрипции всех моделей для конкретного файла
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {string} description Описание теста
 * @param {string} language Язык аудио
 */
async function testFileWithAllModels(audioFilePath, description, language) {
  if (!fs.existsSync(audioFilePath)) {
    console.error(`Ошибка: Файл ${audioFilePath} не найден`);
    return null;
  }
  
  console.log(`Тестирование файла: ${path.basename(audioFilePath)} (${description})`);
  
  const form = new FormData();
  form.append('audio', fs.createReadStream(audioFilePath));
  form.append('language', language);
  
  try {
    const response = await axios.post(
      `${API_URL}/transcribe/compare`,
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    console.log(`Завершено тестирование: ${path.basename(audioFilePath)}`);
    
    // Формируем результат
    const result = {
      filePath: audioFilePath,
      description: description,
      language: language,
      fileSize: response.data.fileSize,
      models: {}
    };
    
    // Собираем результаты по каждой модели
    for (const model of Object.keys(response.data)) {
      if (model === 'fileSize' || model === 'fileName') continue;
      
      const modelResult = response.data[model];
      if (modelResult.error) {
        console.log(`Ошибка для модели ${model}: ${modelResult.error}`);
        result.models[model] = { error: modelResult.error };
      } else {
        result.models[model] = {
          text: modelResult.text,
          processingTime: modelResult.processingTime
        };
      }
    }
    
    return result;
  } catch (error) {
    console.error('Ошибка при тестировании файла:', error.message);
    if (error.response) {
      console.error('Ответ API:', error.response.data);
    }
    return null;
  }
}

/**
 * Основная функция бенчмарка
 */
async function runBenchmark() {
  try {
    console.log('Запуск бенчмарка транскрипции аудио...');
    
    const allResults = [];
    
    // Тестирование русских аудиофайлов
    console.log('\n== Тестирование РУССКИХ аудиофайлов ==');
    for (const fileInfo of TEST_FILES.russian) {
      const result = await testFileWithAllModels(fileInfo.path, fileInfo.description, 'ru');
      if (result) {
        allResults.push(result);
      }
    }
    
    // Тестирование английских аудиофайлов
    console.log('\n== Тестирование АНГЛИЙСКИХ аудиофайлов ==');
    for (const fileInfo of TEST_FILES.english) {
      const result = await testFileWithAllModels(fileInfo.path, fileInfo.description, 'en');
      if (result) {
        allResults.push(result);
      }
    }
    
    // Выводим отформатированные результаты
    printBenchmarkResults(allResults);
    
    console.log('Бенчмарк завершен.');
  } catch (error) {
    console.error('Ошибка при выполнении бенчмарка:', error);
  }
}

// Запуск бенчмарка
runBenchmark();