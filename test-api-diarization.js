/**
 * Тест API диаризации с транскрипцией
 * 
 * Этот скрипт тестирует работу нового эндпоинта диаризации и проверяет
 * интеграцию с микросервисом диаризации.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// URL API
const API_URL = 'http://localhost:3000/api';
const DIARIZATION_API_URL = `${API_URL}/diarize`;

/**
 * Тестирование диаризации аудио через API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {boolean} withTranscription Транскрибировать ли сегменты
 */
async function testDiarizationAPI(audioFilePath, withTranscription = false) {
  try {
    console.log(`Отправка файла ${audioFilePath} на диаризацию...`);
    console.log(`Параметры: транскрипция=${withTranscription}`);
    
    // Проверяем существует ли файл
    if (!fs.existsSync(audioFilePath)) {
      console.error(`Файл не найден: ${audioFilePath}`);
      return;
    }
    
    // Создаем FormData для отправки файла
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('min_speakers', 1);
    formData.append('max_speakers', 5);
    formData.append('transcribe', withTranscription.toString());
    formData.append('language', 'ru');
    
    console.log('Отправка запроса...');
    
    // Отправляем запрос
    const startTime = Date.now();
    const response = await axios.post(DIARIZATION_API_URL, formData, {
      headers: {
        ...formData.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    const endTime = Date.now();
    
    console.log(`Запрос выполнен за ${(endTime - startTime) / 1000} секунд\n`);
    
    // Выводим результат
    console.log('Результат диаризации:');
    console.log(`- Обнаружено ${response.data.speakers.length} говорящих`);
    console.log(`- Найдено ${response.data.segments.length} сегментов речи`);
    console.log(`- Время обработки: ${response.data.processing_time.toFixed(2)} сек`);
    
    // Выводим детали первых 5 сегментов
    console.log('\nПримеры сегментов:');
    for (let i = 0; i < Math.min(5, response.data.segments.length); i++) {
      const segment = response.data.segments[i];
      console.log(`Сегмент ${i+1}: Говорящий ${segment.speaker}, ${segment.start.toFixed(2)}-${segment.end.toFixed(2)} сек (${(segment.end - segment.start).toFixed(2)} сек)`);
      
      if (withTranscription && segment.transcription) {
        console.log(`  Текст: "${segment.transcription}"`);
      }
    }
    
    // Если есть полная транскрипция, выведем её
    if (response.data.full_transcript) {
      console.log('\nПолная транскрипция с разделением по говорящим:');
      console.log(response.data.full_transcript);
    }
    
    return true;
  } catch (error) {
    console.error('Ошибка при тестировании API диаризации:');
    
    if (error.response) {
      // Ответ сервера с ошибкой
      console.error('Статус ошибки:', error.response.status);
      console.error('Данные ошибки:', error.response.data);
      
      // Проверяем, не связана ли ошибка с отсутствием микросервиса
      if (error.response.status === 503 && error.response.data.error === 'Микросервис диаризации недоступен') {
        console.error('\nМикросервис диаризации не запущен!');
        console.error('Запустите его командой: node start-diarization-service.js');
      }
    } else {
      // Ошибка запроса
      console.error(error.message);
    }
    
    return false;
  }
}

/**
 * Главная функция тестирования
 */
async function main() {
  // Проверяем наличие тестового аудиофайла
  const testFile = path.join(__dirname, 'test_audio', 'sample.mp3');
  if (!fs.existsSync(testFile)) {
    console.error(`Тестовый файл не найден: ${testFile}`);
    console.log('Убедитесь, что вы создали директорию test_audio и поместили в нее файл sample.mp3');
    return;
  }
  
  // Тестируем API без транскрипции
  console.log('===== Тест 1: Диаризация без транскрипции =====');
  await testDiarizationAPI(testFile, false);
  
  console.log('\n');
  
  // Тестируем API с транскрипцией
  console.log('===== Тест 2: Диаризация с транскрипцией =====');
  await testDiarizationAPI(testFile, true);
}

// Запускаем тест
main().catch(console.error);