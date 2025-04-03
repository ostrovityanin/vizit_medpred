/**
 * Прямое тестирование диаризации через Node.js
 * 
 * Этот скрипт тестирует диаризацию аудио с прямым запуском Python-скрипта
 * без использования отдельного микросервиса.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Пути к файлам и директориям
const TEST_AUDIO_DIR = path.join(__dirname, 'test_audio');
const PYTHON_DIR = path.join(__dirname, 'services', 'audio-diarization');
const TEMP_DIR = path.join(__dirname, 'temp');

// Создаем директорию для временных файлов, если не существует
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Выполняет диаризацию аудиофайла
 * 
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Опции диаризации
 * @param {number} options.minSpeakers Минимальное количество говорящих
 * @param {number} options.maxSpeakers Максимальное количество говорящих
 * @returns {Promise<Object>} Результат диаризации
 */
async function diarizeAudio(audioFilePath, options = {}) {
  const { minSpeakers = 1, maxSpeakers = 10 } = options;
  
  return new Promise((resolve, reject) => {
    console.log(`Запуск диаризации для файла: ${audioFilePath}`);
    
    // Создаем временную директорию для этого запроса
    const requestId = Date.now().toString();
    const requestDir = path.join(TEMP_DIR, requestId);
    fs.mkdirSync(requestDir, { recursive: true });
    
    // Путь к скрипту диаризации
    const scriptPath = path.join(PYTHON_DIR, 'src', 'diarization.py');
    
    console.log(`Запуск скрипта: ${scriptPath}`);
    console.log(`Аудиофайл: ${audioFilePath}`);
    console.log(`Выходная директория: ${requestDir}`);
    
    // Запускаем Python-скрипт
    const pythonProcess = spawn('python', [
      scriptPath,
      '--audio_path', audioFilePath,
      '--min_speakers', minSpeakers.toString(),
      '--max_speakers', maxSpeakers.toString(),
      '--output_dir', requestDir
    ]);
    
    let stdoutData = '';
    let stderrData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
      console.log(`[Диаризация]: ${data.toString().trim()}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error(`[Диаризация ERROR]: ${data.toString().trim()}`);
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Процесс диаризации завершился с ошибкой, код: ${code}`);
        console.error(`STDERR: ${stderrData}`);
        
        // Очищаем временную директорию
        try {
          fs.rmSync(requestDir, { recursive: true, force: true });
        } catch (err) {
          console.error('Ошибка при удалении временной директории:', err);
        }
        
        return reject(new Error(`Процесс диаризации завершился с ошибкой: ${stderrData}`));
      }
      
      // Читаем результат из JSON-файла
      try {
        const resultPath = path.join(requestDir, 'result.json');
        
        if (!fs.existsSync(resultPath)) {
          return reject(new Error('Результаты диаризации не найдены'));
        }
        
        const resultJson = fs.readFileSync(resultPath, 'utf8');
        const result = JSON.parse(resultJson);
        
        console.log(`Диаризация завершена. Обнаружено говорящих: ${result.num_speakers}`);
        
        // Очищаем временную директорию
        try {
          fs.rmSync(requestDir, { recursive: true, force: true });
        } catch (err) {
          console.error('Ошибка при удалении временной директории:', err);
        }
        
        resolve(result);
      } catch (err) {
        console.error('Ошибка при чтении результатов диаризации:', err);
        reject(err);
      }
    });
    
    pythonProcess.on('error', (err) => {
      console.error('Ошибка при запуске процесса диаризации:', err);
      reject(err);
    });
  });
}

/**
 * Основная функция
 */
async function main() {
  try {
    console.log('Запуск теста прямой диаризации...');
    
    // Пути к тестовым аудиофайлам
    const singleSpeakerPath = path.join(TEST_AUDIO_DIR, 'sample.mp3');
    const multiSpeakerPath = path.join(TEST_AUDIO_DIR, 'multi_speaker.mp3');
    
    // Проверяем существование файлов
    if (!fs.existsSync(singleSpeakerPath)) {
      console.error(`Тестовый файл не найден: ${singleSpeakerPath}`);
      console.log('Сначала запустите generate-test-audio-v2.js для создания тестовых файлов');
      return;
    }
    
    // Тестируем диаризацию
    console.log('\n=== Тест 1: Один говорящий ===');
    const result1 = await diarizeAudio(singleSpeakerPath, { minSpeakers: 1, maxSpeakers: 3 });
    console.log('\nРезультат диаризации одного говорящего:');
    console.log(JSON.stringify(result1, null, 2));
    
    console.log('\n=== Тест 2: Несколько говорящих ===');
    if (fs.existsSync(multiSpeakerPath)) {
      const result2 = await diarizeAudio(multiSpeakerPath, { minSpeakers: 2, maxSpeakers: 5 });
      console.log('\nРезультат диаризации нескольких говорящих:');
      console.log(JSON.stringify(result2, null, 2));
    } else {
      console.log(`Файл с несколькими говорящими не найден: ${multiSpeakerPath}`);
      console.log('Пропускаю тест с несколькими говорящими');
    }
    
    console.log('\nТесты успешно завершены');
    
  } catch (error) {
    console.error('Ошибка при тестировании:', error);
  }
}

// Запускаем основную функцию
main();