/**
 * Тестирование сравнения диаризации и транскрипции
 * 
 * Этот скрипт тестирует API сервиса сравнения диаризации и транскрипции,
 * проверяя работу всего процесса от старта сервиса до получения результатов.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

// Получаем путь к текущей директории
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Конфигурация
const API_BASE_URL = 'http://localhost:5000/api/diarization';
const TEST_AUDIO_DIR = path.join(__dirname, 'test_audio');

// Проверяем, существует ли директория для тестовых аудио
if (!fs.existsSync(TEST_AUDIO_DIR)) {
  console.log('Creating test audio directory...');
  fs.mkdirSync(TEST_AUDIO_DIR, { recursive: true });
}

/**
 * Проверяет статус сервиса диаризации
 * @returns {Promise<object>} Статус сервиса
 */
async function checkServiceStatus() {
  try {
    console.log('Checking diarization service status...');
    const response = await axios.get(`${API_BASE_URL}/status`);
    console.log('Service status:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error checking service status:', error.message);
    return { status: 'error', message: error.message };
  }
}

/**
 * Запускает сервис диаризации, если он еще не запущен
 * @returns {Promise<boolean>} Успешно ли запущен сервис
 */
async function startServiceIfNeeded() {
  const status = await checkServiceStatus();
  
  if (status.status === 'running') {
    console.log('Service is already running.');
    return true;
  }
  
  try {
    console.log('Starting diarization service...');
    const response = await axios.post(`${API_BASE_URL}/start`, {
      simplified: true
    });
    
    console.log('Service start result:', response.data);
    return response.data.status === 'success';
  } catch (error) {
    console.error('Error starting service:', error.message);
    return false;
  }
}

/**
 * Получает список доступных моделей транскрипции
 * @returns {Promise<array>} Список моделей
 */
async function getAvailableModels() {
  try {
    console.log('Getting available transcription models...');
    const response = await axios.get(`${API_BASE_URL}/models`);
    console.log('Available models:', response.data.models);
    return response.data.models;
  } catch (error) {
    console.error('Error getting models:', error.message);
    return [];
  }
}

/**
 * Выполняет процесс диаризации и транскрипции для аудиофайла
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {Promise<object>} Результаты обработки
 */
async function processAudioFile(audioFilePath) {
  try {
    console.log(`Processing audio file: ${audioFilePath}`);
    
    // Проверяем, что файл существует
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`File not found: ${audioFilePath}`);
    }
    
    // Создаем FormData для отправки файла
    const formData = new FormData();
    formData.append('audio_file', fs.createReadStream(audioFilePath));
    formData.append('minSpeakers', '1');
    formData.append('maxSpeakers', '5');
    formData.append('models', 'whisper-1,gpt-4o-mini-transcribe');
    formData.append('saveResults', 'true');
    
    // Отправляем запрос
    console.log('Sending request to process audio...');
    const response = await axios.post(`${API_BASE_URL}/process`, formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000 // 60 секунд на обработку
    });
    
    console.log('Processing completed.');
    return response.data;
  } catch (error) {
    console.error('Error processing audio file:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return { status: 'error', message: error.message };
  }
}

/**
 * Создает тестовый аудиофайл с синусоидой определенной частоты
 * @param {string} outputPath Путь для сохранения файла
 * @param {number} frequency Частота тона в Гц
 * @param {number} duration Длительность в секундах
 * @returns {Promise<string>} Путь к созданному файлу
 */
async function generateTestAudio(outputPath, frequency = 440, duration = 5) {
  try {
    console.log(`Generating test audio file: ${outputPath}`);
    
    // Создаем команду FFmpeg для генерации синусоидального тона
    const command = `ffmpeg -y -f lavfi -i "sine=frequency=${frequency}:duration=${duration}" -ar 16000 -ac 1 -c:a libmp3lame -b:a 32k "${outputPath}"`;
    
    // Выполняем команду
    await exec(command);
    
    console.log(`Test audio file generated: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error generating test audio:', error.message);
    throw error;
  }
}

/**
 * Создает тестовый аудиофайл с "диалогом" (чередующиеся тоны)
 * @param {string} outputPath Путь для сохранения файла
 * @returns {Promise<string>} Путь к созданному файлу
 */
async function generateTestDialog(outputPath) {
  try {
    console.log(`Generating test dialog audio: ${outputPath}`);
    
    // Создаем временные файлы для каждого говорящего
    const speaker1File = path.join(TEST_AUDIO_DIR, 'temp_speaker1.mp3');
    const speaker2File = path.join(TEST_AUDIO_DIR, 'temp_speaker2.mp3');
    const silenceFile = path.join(TEST_AUDIO_DIR, 'temp_silence.mp3');
    
    // Генерируем аудио для каждого говорящего и тишину
    await generateTestAudio(speaker1File, 440, 2); // Ля первой октавы, 2 секунды
    await generateTestAudio(speaker2File, 880, 1.5); // Ля второй октавы, 1.5 секунды
    
    // Создаем команду FFmpeg для генерации тишины
    const silenceCommand = `ffmpeg -y -f lavfi -i "anullsrc=r=16000:cl=mono:d=1" -ar 16000 -ac 1 -c:a libmp3lame -b:a 32k "${silenceFile}"`;
    
    // Выполняем команду для создания тишины
    await exec(silenceCommand);
    
    // Создаем список файлов для объединения
    const fileList = path.join(TEST_AUDIO_DIR, 'file_list.txt');
    const fileContent = `file '${speaker1File.replace(/\\/g, '/')}'
file '${silenceFile.replace(/\\/g, '/')}'
file '${speaker2File.replace(/\\/g, '/')}'
file '${silenceFile.replace(/\\/g, '/')}'
file '${speaker1File.replace(/\\/g, '/')}'
file '${silenceFile.replace(/\\/g, '/')}'
file '${speaker2File.replace(/\\/g, '/')}'`;
    
    fs.writeFileSync(fileList, fileContent);
    
    // Объединяем файлы
    const concatCommand = `ffmpeg -y -f concat -safe 0 -i "${fileList}" -c copy "${outputPath}"`;
    
    await exec(concatCommand);
    
    // Удаляем временные файлы
    try {
      fs.unlinkSync(speaker1File);
      fs.unlinkSync(speaker2File);
      fs.unlinkSync(silenceFile);
      fs.unlinkSync(fileList);
    } catch (cleanupError) {
      console.warn('Warning: Error cleaning up temporary files:', cleanupError.message);
    }
    
    console.log(`Test dialog audio generated: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error generating test dialog:', error.message);
    throw error;
  }
}

/**
 * Основная функция для запуска тестирования
 */
async function runTest() {
  try {
    console.log('=== Starting diarization comparison test ===');
    
    // Запускаем сервис диаризации, если нужно
    const serviceStarted = await startServiceIfNeeded();
    if (!serviceStarted) {
      console.error('Failed to start diarization service. Aborting test.');
      return;
    }
    
    // Получаем список доступных моделей
    await getAvailableModels();
    
    // Генерируем тестовый аудиофайл с диалогом
    const testAudioPath = path.join(TEST_AUDIO_DIR, 'test_dialog.mp3');
    await generateTestDialog(testAudioPath);
    
    // Обрабатываем аудиофайл
    const result = await processAudioFile(testAudioPath);
    
    if (result.status === 'success') {
      console.log('=== Test Successful ===');
      console.log('Processing completed successfully.');
      console.log(`Number of speakers detected: ${result.results.audioInfo.numSpeakers}`);
      console.log(`Number of segments: ${result.results.segments.length}`);
      
      // Выводим информацию о моделях транскрипции
      console.log('\nTranscription Results:');
      
      Object.entries(result.results.transcriptions).forEach(([model, transcription]) => {
        console.log(`\n${model}:`);
        console.log(`Text: ${transcription.text}`);
        console.log(`Processing time: ${transcription.processingTime}ms`);
      });
    } else {
      console.error('=== Test Failed ===');
      console.error('Error message:', result.message);
      if (result.error) {
        console.error('Error details:', result.error);
      }
    }
  } catch (error) {
    console.error('=== Test Error ===');
    console.error('Unhandled error during test:', error.message);
  }
}

// Запускаем тестирование
runTest();