/**
 * Модуль для сравнительной диаризации и мульти-модельной транскрипции
 * 
 * Этот модуль выполняет следующие функции:
 * 1. Получает аудиофайл и выполняет диаризацию (разделение на говорящих)
 * 2. Для каждого сегмента делает транскрипцию с использованием трех моделей:
 *    - whisper-1 (OpenAI)
 *    - gpt-4o-mini-transcribe (OpenAI)
 *    - gpt-4o-transcribe (OpenAI)
 * 3. Возвращает результаты в формате, удобном для сравнения
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec as execCb, spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Преобразуем callback-версию exec в Promise
const exec = promisify(execCb);

// Получаем путь к текущему файлу и директории (для ESM совместимости)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Динамически импортируем функции из модуля OpenAI
let openaiModule = null;

async function getOpenAIModule() {
  if (!openaiModule) {
    openaiModule = await import('../../openai.compat.js');
  }
  return openaiModule;
}

// Пути для временных файлов
const TEMP_DIR = path.join(process.cwd(), 'temp');
const SEGMENTS_DIR = path.join(TEMP_DIR, 'segments');

// Убедимся, что временные директории существуют
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}
if (!fs.existsSync(SEGMENTS_DIR)) {
  fs.mkdirSync(SEGMENTS_DIR, { recursive: true });
}

/**
 * Функция для выполнения диаризации аудиофайла
 * @param {string} audioPath Путь к аудиофайлу
 * @param {Object} options Дополнительные опции
 * @returns {Promise<Object>} Результаты диаризации
 */
async function performDiarization(audioPath, options = {}) {
  try {
    const {
      minSpeakers = 1,
      maxSpeakers = 10,
      outputFormat = 'json'
    } = options;
    
    console.log(`[diarization-comparison] Запуск диаризации для файла: ${audioPath}`);
    
    // Полный путь к Python скрипту (от корня проекта)
    const pythonScript = path.resolve(process.cwd(), 'server', 'simple-diarization.py');
    const outputPath = path.join(TEMP_DIR, `diarization-${uuidv4()}.json`);
    
    console.log(`[diarization-comparison] Проверка наличия скрипта: ${pythonScript}`);
    if (!fs.existsSync(pythonScript)) {
      throw new Error(`Скрипт диаризации не найден: ${pythonScript}`);
    }
    
    // Запускаем Python скрипт для диаризации
    const command = `python3 "${pythonScript}" --audio_file "${audioPath}" --output_file "${outputPath}" --min_speakers ${minSpeakers} --max_speakers ${maxSpeakers} --format ${outputFormat}`;
    
    console.log(`[diarization-comparison] Выполнение команды: ${command}`);
    
    const { stdout, stderr } = await exec(command);
    
    if (stderr && !stderr.includes("Tensorflow")) {
      console.error(`[diarization-comparison] Ошибка при выполнении диаризации: ${stderr}`);
    }
    
    console.log(`[diarization-comparison] Диаризация завершена: ${stdout}`);
    
    // Проверяем, создался ли файл с результатами
    if (!fs.existsSync(outputPath)) {
      throw new Error('Не удалось получить результаты диаризации');
    }
    
    // Читаем результаты диаризации
    const diarizationResults = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    
    // Удаляем временный файл
    fs.unlinkSync(outputPath);
    
    return diarizationResults;
  } catch (error) {
    console.error(`[diarization-comparison] Ошибка при диаризации: ${error.message}`);
    throw error;
  }
}

/**
 * Функция для разделения аудио на сегменты по результатам диаризации
 * @param {string} audioPath Путь к аудиофайлу
 * @param {Array} segments Сегменты диаризации
 * @returns {Promise<Array>} Пути к созданным файлам сегментов
 */
async function extractAudioSegments(audioPath, segments) {
  const segmentFiles = [];
  
  for (const [index, segment] of segments.entries()) {
    try {
      const { start, end, speaker } = segment;
      const duration = end - start;
      
      // Пропускаем слишком короткие сегменты
      if (duration < 0.1) {
        console.log(`[diarization-comparison] Пропуск слишком короткого сегмента ${index}`);
        continue;
      }
      
      const segmentFilename = `segment_${speaker}_${index}_${uuidv4()}.mp3`;
      const segmentPath = path.join(SEGMENTS_DIR, segmentFilename);
      
      // Используем FFmpeg для извлечения сегмента
      const command = `ffmpeg -i "${audioPath}" -ss ${start} -t ${duration} -c:a libmp3lame -q:a 4 "${segmentPath}" -y`;
      
      console.log(`[diarization-comparison] Извлечение сегмента ${index}: ${command}`);
      
      await exec(command);
      
      // Проверяем, что файл сегмента создался
      if (fs.existsSync(segmentPath)) {
        segmentFiles.push({
          path: segmentPath,
          speaker: speaker,
          start: start,
          end: end,
          duration: duration,
          index: index
        });
      } else {
        console.error(`[diarization-comparison] Не удалось создать файл сегмента: ${segmentPath}`);
      }
    } catch (error) {
      console.error(`[diarization-comparison] Ошибка при извлечении сегмента ${index}: ${error.message}`);
    }
  }
  
  return segmentFiles;
}

/**
 * Функция для прямой транскрипции с использованием GPT-4o Audio API
 * @param {string} audioPath Путь к аудиофайлу
 * @param {string} model Модель для транскрипции ('gpt-4o-mini' или 'gpt-4o')
 * @returns {Promise<string>} Результат транскрипции
 */
async function transcribeWithGPT4o(audioPath, model) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Отсутствует ключ API OpenAI');
    }
    
    // Определяем модель для API
    const apiModel = model === 'gpt-4o-mini' ? 'gpt-4o-mini' : 'gpt-4o';
    
    console.log(`[diarization-comparison] Транскрипция файла ${audioPath} с моделью ${apiModel}`);
    
    // Чтение аудиофайла в base64
    const audioData = fs.readFileSync(audioPath);
    const base64Audio = audioData.toString('base64');
    
    // Запрос к OpenAI API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: apiModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Пожалуйста, сделайте транскрипцию этого аудио. Это русская речь.' },
              {
                type: 'input_audio',
                input_audio: `data:audio/mp3;base64,${base64Audio}`
              }
            ]
          }
        ],
        temperature: 0,
        max_tokens: 4096
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    
    // Получаем текст из ответа
    const transcription = response.data.choices[0].message.content;
    
    return transcription;
  } catch (error) {
    console.error(`[diarization-comparison] Ошибка при транскрипции с GPT-4o: ${error.message}`);
    if (error.response) {
      console.error('Детали ошибки API:', error.response.data);
    }
    throw error;
  }
}

/**
 * Функция для выполнения нескольких расшифровок одного сегмента разными моделями
 * @param {Object} segment Информация о сегменте
 * @returns {Promise<Object>} Результаты расшифровок
 */
async function transcribeSegmentWithMultipleModels(segment) {
  try {
    console.log(`[diarization-comparison] Начало транскрипции сегмента ${segment.index} (говорящий ${segment.speaker})`);
    
    // Получаем модуль OpenAI для использования его функций
    const openaiModule = await getOpenAIModule();
    
    // Параллельно запускаем транскрипцию тремя разными моделями
    const [whisperResult, gpt4oMiniResult, gpt4oResult] = await Promise.allSettled([
      // 1. Whisper-1 API
      openaiModule.transcribeWithWhisper(segment.path),
      
      // 2. GPT-4o-mini Audio
      transcribeWithGPT4o(segment.path, 'gpt-4o-mini'),
      
      // 3. GPT-4o Audio
      transcribeWithGPT4o(segment.path, 'gpt-4o')
    ]);
    
    // Собираем результаты, обрабатывая возможные ошибки
    return {
      ...segment,
      transcriptions: {
        whisper: whisperResult.status === 'fulfilled' ? whisperResult.value : 'Ошибка транскрипции',
        gpt4o_mini: gpt4oMiniResult.status === 'fulfilled' ? gpt4oMiniResult.value : 'Ошибка транскрипции',
        gpt4o: gpt4oResult.status === 'fulfilled' ? gpt4oResult.value : 'Ошибка транскрипции'
      },
      transcriptionStatus: {
        whisper: whisperResult.status,
        gpt4o_mini: gpt4oMiniResult.status,
        gpt4o: gpt4oResult.status
      }
    };
  } catch (error) {
    console.error(`[diarization-comparison] Ошибка при мульти-модельной транскрипции: ${error.message}`);
    throw error;
  }
}

/**
 * Очистка временных файлов сегментов
 * @param {Array} segmentFiles Массив путей к файлам сегментов
 */
function cleanupSegmentFiles(segmentFiles) {
  for (const segment of segmentFiles) {
    try {
      if (fs.existsSync(segment.path)) {
        fs.unlinkSync(segment.path);
        console.log(`[diarization-comparison] Удален временный файл: ${segment.path}`);
      }
    } catch (error) {
      console.error(`[diarization-comparison] Ошибка при удалении файла ${segment.path}: ${error.message}`);
    }
  }
}

/**
 * Основная функция для выполнения диаризации и сравнительной транскрипции
 * @param {string} audioPath Путь к аудиофайлу
 * @param {Object} options Дополнительные опции
 * @returns {Promise<Object>} Результаты диаризации и транскрипции
 */
async function performDiarizationAndMultiTranscription(audioPath, options = {}) {
  let segmentFiles = [];
  
  try {
    console.log(`[diarization-comparison] Начало обработки файла: ${audioPath}`);
    
    // 1. Выполняем диаризацию
    const diarizationResults = await performDiarization(audioPath, options);
    
    // 2. Разбиваем аудио на сегменты по говорящим
    segmentFiles = await extractAudioSegments(audioPath, diarizationResults.segments);
    
    console.log(`[diarization-comparison] Создано ${segmentFiles.length} сегментов для транскрипции`);
    
    // 3. Выполняем расшифровку каждого сегмента тремя моделями
    const transcriptionPromises = segmentFiles.map(segment => 
      transcribeSegmentWithMultipleModels(segment)
    );
    
    const segmentsWithTranscriptions = await Promise.all(transcriptionPromises);
    
    // 4. Формируем итоговый результат
    const result = {
      metadata: {
        original_file: audioPath,
        processing_time: new Date().toISOString(),
        num_speakers: diarizationResults.num_speakers,
        total_segments: segmentsWithTranscriptions.length
      },
      segments: segmentsWithTranscriptions.map(segment => ({
        speaker: segment.speaker,
        start: segment.start,
        end: segment.end,
        duration: segment.duration,
        index: segment.index,
        transcriptions: segment.transcriptions,
        status: segment.transcriptionStatus
      }))
    };
    
    return result;
  } catch (error) {
    console.error(`[diarization-comparison] Ошибка при обработке: ${error.message}`);
    throw error;
  } finally {
    // Очищаем временные файлы сегментов
    cleanupSegmentFiles(segmentFiles);
  }
}

// Экспорт в ESM формате
export default {
  performDiarizationAndMultiTranscription
};