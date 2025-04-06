/**
 * Тест сравнительной диаризации с транскрипцией разными моделями
 * 
 * Этот скрипт тестирует новый эндпоинт /api/diarize/compare, который:
 * 1. Выполняет диаризацию (определяет разных говорящих)
 * 2. Транскрибирует каждый сегмент тремя разными моделями (whisper-1, gpt-4o-mini-transcribe, gpt-4o-transcribe)
 * 3. Сравнивает результаты транскрипции для каждого сегмента
 */

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Базовый URL API
const API_URL = 'http://localhost:5000/api';

/**
 * Выполнение сравнительной диаризации с транскрипцией через API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Дополнительные опции
 * @returns {Promise<Object>} Результаты сравнительной диаризации
 */
async function testDiarizationCompareAPI(audioFilePath, options = {}) {
  try {
    console.log(`Тестирование сравнительной диаризации для файла: ${path.basename(audioFilePath)}`);
    
    // Проверка существования файла
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Файл не найден: ${audioFilePath}`);
    }
    
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(audioFilePath));
    
    // Добавляем опции
    if (options.minSpeakers) formData.append('min_speakers', options.minSpeakers);
    if (options.maxSpeakers) formData.append('max_speakers', options.maxSpeakers);
    if (options.language) formData.append('language', options.language);
    
    // Отправляем запрос
    console.log('Отправка запроса на сравнительную диаризацию...');
    const startTime = Date.now();
    
    const response = await axios.post(`${API_URL}/diarize/compare`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;
    
    console.log(`Запрос выполнен за ${processingTime.toFixed(2)} сек`);
    
    // Выводим результаты
    if (response.data.segments && response.data.segments.length > 0) {
      console.log(`\nНайдено ${response.data.segments.length} сегментов речи от ${response.data.num_speakers} говорящих:`);
      
      // Подготовка статистики по моделям
      const modelStats = {};
      const models = ['whisper-1', 'gpt-4o-mini-transcribe', 'gpt-4o-transcribe'];
      
      models.forEach(model => {
        if (response.data.model_results && response.data.model_results[model]) {
          const avgTime = response.data.model_results[model].avg_processing_time;
          console.log(`\nМодель ${model}:`);
          console.log(`Среднее время обработки: ${avgTime.toFixed(2)} сек`);
          console.log(`Полная транскрипция:\n${response.data.model_results[model].full_text}\n`);
        }
      });
      
      // Вывод первых двух сегментов для примера
      const sampleSegments = response.data.segments.slice(0, 2);
      
      console.log('\nПримеры сегментов:');
      sampleSegments.forEach((segment, idx) => {
        console.log(`\nСегмент ${idx + 1} (Говорящий ${segment.speaker}):`);
        console.log(`Время: ${segment.start.toFixed(2)}с - ${segment.end.toFixed(2)}с (длительность: ${(segment.end - segment.start).toFixed(2)}с)`);
        
        if (segment.transcriptions) {
          console.log('Сравнение транскрипций:');
          
          models.forEach(model => {
            if (segment.transcriptions[model]) {
              console.log(`- ${model} (${segment.transcriptions[model].processingTime.toFixed(2)}с): ${segment.transcriptions[model].text}`);
            }
          });
        }
      });
    } else {
      console.log('Сегменты речи не найдены или произошла ошибка при обработке.');
    }
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при тестировании сравнительной диаризации:');
    if (error.response) {
      console.error(`Статус ошибки: ${error.response.status}`);
      console.error('Ответ сервера:', error.response.data);
    } else {
      console.error(error.message);
    }
    throw error;
  }
}

/**
 * Генерация тестового файла, если не указан путь к существующему
 * @returns {Promise<string>} Путь к тестовому файлу
 */
async function prepareTestFile() {
  // Проверяем существующие тестовые файлы
  const testAudioDir = './test_audio';
  const possibleFiles = [
    `${testAudioDir}/multi_speaker.mp3`,  // Сгенерированный файл с несколькими говорящими
    `${testAudioDir}/sample.mp3`,         // Простой тестовый файл
    `${testAudioDir}/test_dialog.mp3`     // Пользовательский тестовый файл
  ];
  
  // Проверка существования директории
  if (!fs.existsSync(testAudioDir)) {
    fs.mkdirSync(testAudioDir, { recursive: true });
  }
  
  // Проверяем наличие существующих файлов
  for (const file of possibleFiles) {
    if (fs.existsSync(file)) {
      console.log(`Используем существующий тестовый файл: ${file}`);
      return file;
    }
  }
  
  // Если ни один файл не найден, генерируем новый
  console.log('Генерация нового тестового файла...');
  
  // Запускаем процесс генерации напрямую
  try {
    // Запускаем скрипт генерации и ждем его завершения
    await new Promise((resolve, reject) => {
      const generateProcess = spawn('node', ['generate-test-audio-v2.js']);
      
      generateProcess.stdout.on('data', (data) => {
        console.log(`Генерация: ${data.toString().trim()}`);
      });
      
      generateProcess.stderr.on('data', (data) => {
        console.error(`Ошибка генерации: ${data.toString().trim()}`);
      });
      
      generateProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Процесс генерации завершился с кодом: ${code}`));
        }
      });
    });
    
    // После запуска проверяем, появились ли файлы
    for (const file of possibleFiles) {
      if (fs.existsSync(file)) {
        console.log(`Успешно сгенерирован тестовый файл: ${file}`);
        return file;
      }
    }
    
    throw new Error('Файлы были сгенерированы, но не найдены в ожидаемых местах');
  } catch (error) {
    console.error('Ошибка при генерации тестового файла:', error);
    throw new Error('Невозможно сгенерировать или найти тестовый файл. Пожалуйста, укажите путь к существующему аудиофайлу.');
  }
}

/**
 * Основная функция
 */
async function main() {
  try {
    // Получаем путь к тестовому файлу из аргументов или используем тестовый
    const testFilePath = process.argv[2] || await prepareTestFile();
    
    // Тестируем сравнительную диаризацию
    await testDiarizationCompareAPI(testFilePath, {
      minSpeakers: 2,
      maxSpeakers: 4,
      language: 'ru'
    });
    
    console.log('\nТест успешно завершен');
  } catch (error) {
    console.error('Ошибка при выполнении теста:', error);
    process.exit(1);
  }
}

// Запускаем скрипт
main();