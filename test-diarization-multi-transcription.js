/**
 * Тестирование API сравнительной диаризации и мульти-модельной транскрипции
 * 
 * Этот скрипт отправляет аудиофайл на обработку в API и получает результаты
 * диаризации с транскрипцией каждого сегмента разными моделями.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

/**
 * Тестирование API сравнительной диаризации и мульти-модельной транскрипции
 * @param {string} audioFilePath Путь к аудиофайлу для тестирования
 */
async function testDiarizationComparisonAPI(audioFilePath) {
  try {
    console.log(`Тестирование сравнительной диаризации для файла: ${audioFilePath}`);
    
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Файл не найден: ${audioFilePath}`);
    }
    
    // Создаем FormData для отправки файла
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('minSpeakers', '1');
    formData.append('maxSpeakers', '10');
    
    console.log('Отправка запроса к API...');
    
    // Отправляем запрос к API
    const startTime = Date.now();
    const response = await axios.post('http://localhost:5000/api/diarize/compare', formData, {
      headers: {
        ...formData.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    const elapsedTime = (Date.now() - startTime) / 1000;
    
    console.log(`Запрос выполнен за ${elapsedTime.toFixed(2)} секунд`);
    console.log(`Получено ${response.data.segments.length} сегментов с диаризацией`);
    
    // Выводим подробную информацию
    console.log('\n=== Информация о файле ===');
    console.log(`Исходный файл: ${response.data.metadata.original_filename || 'Не указан'}`);
    console.log(`Количество говорящих: ${response.data.metadata.num_speakers}`);
    console.log(`Всего сегментов: ${response.data.metadata.total_segments}`);
    console.log(`Время обработки: ${response.data.metadata.processing_time}`);
    
    console.log('\n=== Сегменты с транскрипцией ===');
    response.data.segments.forEach((segment, index) => {
      console.log(`\n--- Сегмент #${index + 1} ---`);
      console.log(`Говорящий: ${segment.speaker}`);
      console.log(`Время: ${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s (${segment.duration.toFixed(2)}s)`);
      
      console.log('\nWhisper-1:');
      console.log(segment.transcriptions.whisper);
      
      console.log('\nGPT-4o-mini:');
      console.log(segment.transcriptions.gpt4o_mini);
      
      console.log('\nGPT-4o:');
      console.log(segment.transcriptions.gpt4o);
    });
    
    // Сохраняем результаты в файл
    const resultsPath = path.join(process.cwd(), 'diarization-comparison-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(response.data, null, 2));
    
    console.log(`\nРезультаты сохранены в файл: ${resultsPath}`);
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при тестировании API:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    throw error;
  }
}

/**
 * Тестирование API сравнительной диаризации и мульти-модельной транскрипции для записи
 * @param {number} recordingId ID записи для тестирования
 */
async function testDiarizationComparisonAPIWithRecording(recordingId) {
  try {
    console.log(`Тестирование сравнительной диаризации для записи #${recordingId}`);
    
    // Отправляем запрос к API
    const startTime = Date.now();
    const response = await axios.post(`http://localhost:5000/api/diarize/compare/recording/${recordingId}`, {
      minSpeakers: 1,
      maxSpeakers: 10
    });
    
    const elapsedTime = (Date.now() - startTime) / 1000;
    
    console.log(`Запрос выполнен за ${elapsedTime.toFixed(2)} секунд`);
    console.log(`Получено ${response.data.segments.length} сегментов с диаризацией`);
    
    // Выводим подробную информацию
    console.log('\n=== Информация о записи ===');
    console.log(`ID записи: ${response.data.metadata.recording_id}`);
    console.log(`Файл: ${response.data.metadata.recording_info?.filename || 'Не указан'}`);
    console.log(`Длительность: ${response.data.metadata.recording_info?.duration || 'Не указана'}`);
    console.log(`Отправитель: ${response.data.metadata.recording_info?.senderUsername || 'Неизвестно'}`);
    console.log(`Получатель: ${response.data.metadata.recording_info?.targetUsername || 'Неизвестно'}`);
    console.log(`Количество говорящих: ${response.data.metadata.num_speakers}`);
    console.log(`Всего сегментов: ${response.data.metadata.total_segments}`);
    console.log(`Время обработки: ${response.data.metadata.processing_time}`);
    
    console.log('\n=== Сегменты с транскрипцией ===');
    response.data.segments.forEach((segment, index) => {
      console.log(`\n--- Сегмент #${index + 1} ---`);
      console.log(`Говорящий: ${segment.speaker}`);
      console.log(`Время: ${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s (${segment.duration.toFixed(2)}s)`);
      
      console.log('\nWhisper-1:');
      console.log(segment.transcriptions.whisper);
      
      console.log('\nGPT-4o-mini:');
      console.log(segment.transcriptions.gpt4o_mini);
      
      console.log('\nGPT-4o:');
      console.log(segment.transcriptions.gpt4o);
    });
    
    // Сохраняем результаты в файл
    const resultsPath = path.join(process.cwd(), `diarization-comparison-recording-${recordingId}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(response.data, null, 2));
    
    console.log(`\nРезультаты сохранены в файл: ${resultsPath}`);
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при тестировании API:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    throw error;
  }
}

/**
 * Основная функция
 */
async function main() {
  try {
    // Проверяем аргументы командной строки
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      console.log(`
      Использование: 
        node test-diarization-multi-transcription.js <путь_к_аудиофайлу>
        node test-diarization-multi-transcription.js --recording <id_записи>
      `);
      return;
    }
    
    if (args[0] === '--recording' && args.length > 1) {
      const recordingId = parseInt(args[1]);
      if (isNaN(recordingId)) {
        throw new Error('Недопустимый ID записи');
      }
      await testDiarizationComparisonAPIWithRecording(recordingId);
    } else {
      const audioFilePath = args[0];
      await testDiarizationComparisonAPI(audioFilePath);
    }
  } catch (error) {
    console.error('Ошибка при выполнении теста:', error.message);
    process.exit(1);
  }
}

// Запускаем основную функцию
main();