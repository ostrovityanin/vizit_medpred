/**
 * Тестирование улучшенного обнаружения нескольких говорящих
 * 
 * Этот скрипт тестирует улучшенные параметры диаризации на файле
 * с искусственным диалогом, созданным generate-dialog-test.js
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import FormData from 'form-data';

// Получаем абсолютный путь к текущему файлу и директории
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Тестирование диаризации аудио через API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Опции диаризации
 */
async function testDiarizationAPI(audioFilePath, options = {}) {
  try {
    console.log(`Тестирование диаризации для файла: ${path.basename(audioFilePath)}`);
    
    // Проверяем существование файла
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Файл не найден: ${audioFilePath}`);
    }
    
    const fileStats = fs.statSync(audioFilePath);
    console.log(`Размер файла: ${(fileStats.size / 1024).toFixed(2)} KB`);
    
    // Готовим данные для запроса
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(audioFilePath));
    
    // Добавляем опции диаризации
    if (options.silenceThreshold) {
      formData.append('silenceThreshold', options.silenceThreshold);
    }
    
    if (options.minSilenceDuration) {
      formData.append('minSilenceDuration', options.minSilenceDuration);
    }
    
    // Начинаем отсчет времени
    const startTime = Date.now();
    
    console.log('Отправка запроса на API диаризации...');
    
    // Отправляем запрос на API диаризации
    const response = await axios.post('http://localhost:5000/api/diarize', formData, {
      headers: formData.getHeaders()
    });
    
    // Вычисляем время выполнения
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Запрос выполнен за ${executionTime} сек\n`);
    
    // Получаем результат
    const result = response.data;
    
    // Анализируем результат
    const numSpeakers = result.num_speakers;
    const segments = result.segments || [];
    
    console.log(`Найдено ${segments.length} сегментов речи от ${numSpeakers} говорящих:\n`);
    
    // Группируем сегменты по говорящим
    const speakerSegments = {};
    segments.forEach(segment => {
      const speakerId = segment.speaker;
      if (!speakerSegments[speakerId]) {
        speakerSegments[speakerId] = [];
      }
      speakerSegments[speakerId].push(segment);
    });
    
    // Выводим информацию по каждому говорящему
    Object.entries(speakerSegments).forEach(([speakerId, segments]) => {
      console.log(`Говорящий ${speakerId}:`);
      console.log(`  Количество сегментов: ${segments.length}`);
      
      const totalDuration = segments.reduce((sum, segment) => {
        return sum + (segment.end - segment.start);
      }, 0);
      
      console.log(`  Общая длительность речи: ${totalDuration.toFixed(2)} сек`);
      
      // Выводим некоторые сегменты (не более 3)
      const samplesToShow = Math.min(segments.length, 3);
      console.log(`  Примеры сегментов:`);
      
      for (let i = 0; i < samplesToShow; i++) {
        const segment = segments[i];
        const duration = (segment.end - segment.start).toFixed(2);
        console.log(`    ${i+1}. ${segment.start.toFixed(2)}с - ${segment.end.toFixed(2)}с (${duration}с)`);
      }
      
      console.log('');
    });
    
    // Выводим сегменты в хронологическом порядке для общего представления
    console.log('Хронология сегментов:');
    segments
      .sort((a, b) => a.start - b.start)
      .forEach((segment, index) => {
        const duration = (segment.end - segment.start).toFixed(2);
        console.log(`  ${index+1}. Говорящий ${segment.speaker}: ${segment.start.toFixed(2)}с - ${segment.end.toFixed(2)}с (${duration}с)`);
      });
    
    console.log(`\nТест успешно завершен, диаризация с ${numSpeakers} говорящими`);
    
    return result;
  } catch (error) {
    console.error('Ошибка при тестировании диаризации:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
    throw error;
  }
}

/**
 * Главная функция тестирования
 */
async function main() {
  try {
    // Путь к тестовому файлу
    let audioFilePath = './test_audio/clear_dialog.mp3';
    
    // Если указан аргумент командной строки, используем его
    if (process.argv.length > 2) {
      audioFilePath = process.argv[2];
    }
    
    // Опции диаризации с улучшенными параметрами
    const options = {
      silenceThreshold: '-35dB',      // Порог тишины: более чувствительный
      minSilenceDuration: '0.25'      // Минимальная длительность тишины: сокращена
    };
    
    // Запускаем тест диаризации
    await testDiarizationAPI(audioFilePath, options);
    
  } catch (error) {
    console.error('Тест не удался:', error);
    process.exit(1);
  }
}

// Запуск основной функции
main();