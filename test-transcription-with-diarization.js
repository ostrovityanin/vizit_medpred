/**
 * Тестовый скрипт для демонстрации транскрипции и диаризации
 * 
 * Этот скрипт показывает:
 * 1. Сравнение различных моделей транскрипции 
 * 2. Работу упрощенной диаризации (определения говорящих) с транскрипцией
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Путь к тестовому аудиофайлу
const TEST_AUDIO_FILE = path.join(__dirname, 'test_audio', 'multi_speaker_test.mp3');

// URL API
const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Тестирование сравнительного API для транскрипции
 */
async function testComparisonTranscription() {
  try {
    console.log('1. ТЕСТИРОВАНИЕ СРАВНЕНИЯ МОДЕЛЕЙ ТРАНСКРИПЦИИ\n');
    
    // Проверяем, существует ли тестовый файл
    if (!fs.existsSync(TEST_AUDIO_FILE)) {
      console.error(`Тестовый файл не найден: ${TEST_AUDIO_FILE}`);
      console.log('Генерируем тестовый файл для диаризации...');
      
      const { exec } = require('child_process');
      await new Promise((resolve, reject) => {
        exec('node generate-test-audio-v2.js', (error, stdout, stderr) => {
          if (error) {
            console.error(`Ошибка при генерации тестового аудио: ${error.message}`);
            reject(error);
            return;
          }
          console.log(stdout);
          resolve();
        });
      });
    }
    
    // Создаем FormData и добавляем файл
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(TEST_AUDIO_FILE));
    formData.append('language', 'ru');
    
    // Отправляем запрос на сравнительный эндпоинт
    console.log('Отправка запроса на сравнение моделей транскрипции...');
    const response = await axios.post(
      `${API_BASE_URL}/transcribe/compare`, 
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    // Выводим результаты
    console.log('\nРезультаты сравнения моделей:\n');
    
    for (const [model, result] of Object.entries(response.data)) {
      console.log(`Модель ${model}:`);
      console.log(`  Текст: ${result.text}`);
      console.log(`  Время обработки: ${result.processingTime.toFixed(2)} сек`);
      console.log();
    }
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при тестировании сравнительной транскрипции:');
    if (error.response) {
      console.error(`Статус: ${error.response.status}`);
      console.error(`Ответ: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(error.message);
    }
    return null;
  }
}

/**
 * Тестирование диаризации с транскрипцией
 */
async function testDiarizationWithTranscription() {
  try {
    console.log('\n2. ТЕСТИРОВАНИЕ ДИАРИЗАЦИИ С ТРАНСКРИПЦИЕЙ\n');
    
    // Проверяем, существует ли тестовый файл
    if (!fs.existsSync(TEST_AUDIO_FILE)) {
      console.error(`Тестовый файл не найден: ${TEST_AUDIO_FILE}`);
      return null;
    }
    
    // Создаем FormData и добавляем файл
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(TEST_AUDIO_FILE));
    formData.append('min_speakers', '2');
    formData.append('max_speakers', '3');
    formData.append('transcribe', 'true');
    formData.append('language', 'ru');
    formData.append('model', 'gpt-4o-mini-transcribe'); // Используем быструю модель для теста
    
    // Отправляем запрос на диаризацию с транскрипцией
    console.log('Отправка запроса на диаризацию с транскрипцией...');
    const response = await axios.post(
      `${API_BASE_URL}/diarize`, 
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    // Выводим результаты диаризации
    console.log('\nРезультаты диаризации:\n');
    console.log(`Обнаружено говорящих: ${response.data.num_speakers}`);
    console.log(`Общая длительность: ${response.data.duration.toFixed(2)} сек`);
    console.log('\nСегменты с говорящими:');
    
    response.data.segments.forEach((segment, index) => {
      console.log(`\nСегмент ${index + 1}:`);
      console.log(`  Говорящий: ${segment.speaker}`);
      console.log(`  Начало: ${segment.start.toFixed(2)} сек`);
      console.log(`  Конец: ${segment.end.toFixed(2)} сек`);
      console.log(`  Текст: ${segment.transcription || '(нет транскрипции)'}`);
    });
    
    // Выводим полный текст со всеми сегментами
    if (response.data.full_transcription) {
      console.log('\nПолная транскрипция с разделением на говорящих:');
      console.log(response.data.full_transcription);
    }
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при тестировании диаризации:');
    if (error.response) {
      console.error(`Статус: ${error.response.status}`);
      console.error(`Ответ: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(error.message);
    }
    return null;
  }
}

/**
 * Главная функция
 */
async function main() {
  try {
    console.log('=================================================');
    console.log('  ТЕСТИРОВАНИЕ ТРАНСКРИПЦИИ И ДИАРИЗАЦИИ');
    console.log('=================================================\n');
    
    // Тестируем сравнительную транскрипцию
    await testComparisonTranscription();
    
    // Тестируем диаризацию с транскрипцией
    await testDiarizationWithTranscription();
    
    console.log('\nТестирование завершено.');
  } catch (error) {
    console.error('Ошибка при выполнении тестов:', error);
  }
}

// Запуск
main();