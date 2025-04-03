/**
 * Модуль для выполнения диаризации (определения говорящих) в аудиофайлах
 * 
 * Этот модуль использует Python-скрипт для диаризации аудио, 
 * но запускает его напрямую в Node.js без необходимости отдельного микросервиса.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import os from 'os';

// Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Путь к директории Python-скриптов
const PYTHON_DIR = path.join(__dirname, '..', 'services', 'audio-diarization');
const TEMP_DIR = path.join(os.tmpdir(), 'audio-diarization');

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
export async function diarizeAudio(audioFilePath, options = {}) {
  const { minSpeakers = 1, maxSpeakers = 10 } = options;
  
  return new Promise((resolve, reject) => {
    console.log(`Запуск диаризации для файла: ${audioFilePath}`);
    
    // Создаем временную директорию для этого запроса
    const requestId = Date.now().toString();
    const requestDir = path.join(TEMP_DIR, requestId);
    fs.mkdirSync(requestDir, { recursive: true });
    
    // Путь к скрипту диаризации
    const scriptPath = path.join(PYTHON_DIR, 'src', 'diarization.py');
    
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
 * Выполняет полную диаризацию и транскрипцию аудиофайла
 * 
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Опции диаризации и транскрипции
 * @param {Function} transcribeFunction Функция для транскрипции отдельных сегментов
 * @returns {Promise<Object>} Результат диаризации с транскрипцией
 */
export async function diarizeAndTranscribe(audioFilePath, options, transcribeFunction) {
  try {
    // Получаем результат диаризации
    const diarizationResult = await diarizeAudio(audioFilePath, options);
    
    // Если транскрипция не требуется, возвращаем результат диаризации
    if (!transcribeFunction) {
      return diarizationResult;
    }
    
    console.log('Транскрибирование сегментов речи...');
    
    // Временная директория для сегментов
    const segmentsDir = path.join(TEMP_DIR, 'segments_' + Date.now());
    fs.mkdirSync(segmentsDir, { recursive: true });
    
    // Путь к скрипту для извлечения сегментов
    const extractScript = path.join(PYTHON_DIR, 'utils', 'extract_segments.py');
    
    // Извлекаем сегменты
    for (let i = 0; i < diarizationResult.segments.length; i++) {
      const segment = diarizationResult.segments[i];
      const segmentPath = path.join(segmentsDir, `segment_${i}_speaker_${segment.speaker}.mp3`);
      
      // Извлекаем сегмент
      await new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [
          extractScript,
          '--audio_path', audioFilePath,
          '--output_path', segmentPath,
          '--start_time', segment.start.toString(),
          '--end_time', segment.end.toString()
        ]);
        
        pythonProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Ошибка при извлечении сегмента ${i}, код: ${code}`));
          }
        });
        
        pythonProcess.on('error', reject);
      });
      
      // Добавляем путь к сегменту
      segment.segment_path = segmentPath;
    }
    
    // Запускаем транскрипцию для каждого сегмента
    const transcriptionPromises = diarizationResult.segments.map(async (segment, index) => {
      try {
        const transcription = await transcribeFunction(segment.segment_path);
        return { 
          ...segment, 
          transcription 
        };
      } catch (error) {
        console.error(`Ошибка при транскрипции сегмента ${index}:`, error);
        return { 
          ...segment, 
          transcription: null,
          error: error.message
        };
      }
    });
    
    // Дожидаемся завершения всех транскрипций
    diarizationResult.segments = await Promise.all(transcriptionPromises);
    
    // Создаем общую транскрипцию
    diarizationResult.full_transcription = diarizationResult.segments
      .filter(s => s.transcription) // Только сегменты с успешной транскрипцией
      .map(s => `[Говорящий ${s.speaker}]: ${s.transcription}`)
      .join('\n');
    
    // Очищаем временную директорию
    try {
      fs.rmSync(segmentsDir, { recursive: true, force: true });
    } catch (err) {
      console.error('Ошибка при удалении временной директории:', err);
    }
    
    return diarizationResult;
  } catch (error) {
    console.error('Ошибка при диаризации и транскрипции:', error);
    throw error;
  }
}

// Экспортируем модуль
export default {
  diarizeAudio,
  diarizeAndTranscribe
};