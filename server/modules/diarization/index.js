/**
 * Модуль аудио-диаризации
 * 
 * Отвечает за определение разных говорящих в аудиозаписи
 * и сегментацию для дальнейшей транскрипции.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';
import { log } from '../../vite';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMP_DIR = path.join(dirname(dirname(dirname(__dirname))), 'temp');

// Создаем временную директорию, если она не существует
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Выполняет упрощенную диаризацию аудио (определение говорящих)
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Опции диаризации
 * @returns {Promise<Object>} Результат диаризации
 */
export async function simpleDiarizeAudio(audioFilePath, options = {}) {
  try {
    const { 
      minSpeakers = 1, 
      maxSpeakers = 2,
      minSegmentDuration = 1.0  // Минимальная длительность сегмента в секундах
    } = options;
    
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Аудиофайл не существует: ${audioFilePath}`);
    }
    
    log(`Запуск упрощенной диаризации для файла: ${audioFilePath}`, 'diarization');
    log(`Параметры: minSpeakers=${minSpeakers}, maxSpeakers=${maxSpeakers}`, 'diarization');
    
    // Импортируем библиотеку для работы с аудио из встроенного модуля simple-diarization.js
    const { getAudioDuration } = await import('../../simple-diarization.js');
    
    // Получаем продолжительность аудио
    const duration = await getAudioDuration(audioFilePath);
    
    if (duration <= 0) {
      throw new Error('Не удалось определить продолжительность аудио или файл слишком короткий');
    }
    
    // Определяем количество говорящих на основе продолжительности и параметров
    // По умолчанию используем 2 говорящих, если не задано иное
    let numSpeakers = 2;
    
    if (duration < 3.0) {
      // Для коротких аудио (менее 3 секунд) используем одного говорящего
      numSpeakers = 1;
    } else if (minSpeakers === maxSpeakers) {
      // Если задано фиксированное количество говорящих
      numSpeakers = minSpeakers;
    } else {
      // Для более длинных аудио оцениваем количество говорящих
      // Для простоты используем 2 говорящих для аудио до 10 секунд,
      // и 3 говорящих для более длинных аудио
      numSpeakers = (duration > 10.0) ? 3 : 2;
      
      // Ограничиваем количество говорящих заданными пределами
      numSpeakers = Math.max(minSpeakers, Math.min(numSpeakers, maxSpeakers));
    }
    
    log(`Продолжительность аудио: ${duration} сек, определено говорящих: ${numSpeakers}`, 'diarization');
    
    // В упрощенной версии мы просто разделяем аудио на равные сегменты
    // и назначаем говорящих в чередующемся порядке
    const segmentDuration = 5.0; // Длительность сегмента в секундах
    
    const speakerSegments = [];
    let currentTime = 0;
    
    while (currentTime < duration) {
      // Рассчитываем длительность текущего сегмента (не больше оставшейся длительности)
      const segDuration = Math.min(segmentDuration, duration - currentTime);
      
      // Пропускаем слишком короткие сегменты
      if (segDuration < minSegmentDuration) {
        break;
      }
      
      // Назначаем говорящего (чередуем)
      const speakerIndex = (speakerSegments.length % numSpeakers) + 1;
      
      speakerSegments.push({
        start: currentTime,
        end: currentTime + segDuration,
        speaker: speakerIndex.toString()
      });
      
      currentTime += segDuration;
    }
    
    const result = {
      audio_path: audioFilePath,
      duration: duration,
      num_speakers: numSpeakers,
      segments: speakerSegments
    };
    
    log(`Упрощенная диаризация завершена. Обнаружено говорящих: ${numSpeakers}`, 'diarization');
    
    return result;
  } catch (error) {
    log(`Ошибка при обработке сегментов для диаризации: ${error}`, 'diarization');
    throw error;
  }
}

/**
 * Интеграция с транскрипцией
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Опции
 * @param {Function} transcribeFunction Функция для транскрипции
 * @returns {Promise<Object>} Результат диаризации с транскрипцией
 */
export async function simpleDiarizeAndTranscribe(audioFilePath, options, transcribeFunction) {
  try {
    // Получаем результат диаризации
    const diarizationResult = await simpleDiarizeAudio(audioFilePath, options);
    
    // Если транскрипция не требуется, возвращаем результат диаризации
    if (!transcribeFunction) {
      return diarizationResult;
    }
    
    log('Транскрибирование сегментов речи...', 'diarization');
    
    // Директория для сегментов
    const segmentsDir = path.join(TEMP_DIR, 'segments_' + Date.now());
    fs.mkdirSync(segmentsDir, { recursive: true });
    
    // Извлекаем и транскрибируем каждый сегмент
    const transcriptionPromises = diarizationResult.segments.map(async (segment, index) => {
      try {
        // Создаем файл сегмента
        const segmentPath = path.join(segmentsDir, `segment_${index}_speaker_${segment.speaker}.mp3`);
        
        // Извлекаем сегмент
        await new Promise((resolve, reject) => {
          const ffmpeg = spawn('ffmpeg', [
            '-i', audioFilePath,
            '-ss', segment.start.toString(),
            '-to', segment.end.toString(),
            '-c:a', 'mp3',
            segmentPath
          ]);
          
          ffmpeg.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Ошибка при извлечении сегмента ${index}, код: ${code}`));
            }
          });
          
          ffmpeg.on('error', reject);
        });
        
        // Транскрибируем сегмент, передавая индекс говорящего для лучшей разметки
        const transcription = await transcribeFunction(segmentPath, parseInt(segment.speaker) - 1);
        
        return { 
          ...segment, 
          segment_path: segmentPath,
          transcription 
        };
      } catch (error) {
        log(`Ошибка при транскрипции сегмента ${index}:`, error);
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
      .sort((a, b) => a.start - b.start) // Сортируем по времени
      .map(s => {
        // Не добавляем метку говорящего если текст уже содержит метку, или если это тишина/шум
        if (s.transcription.includes('[Говорящий') || 
            s.transcription.toLowerCase().includes('[тишина]') || 
            s.transcription.toLowerCase().includes('[шум]') ||
            s.transcription.includes('запись без распознаваемой речи')) {
          return s.transcription;
        } else {
          return `[Говорящий ${s.speaker}]: ${s.transcription}`;
        }
      })
      .join('\n');
    
    // Очищаем временную директорию
    try {
      fs.rmSync(segmentsDir, { recursive: true, force: true });
    } catch (err) {
      log(`Ошибка при удалении временной директории: ${err}`, 'diarization');
    }
    
    return diarizationResult;
  } catch (error) {
    log(`Ошибка при диаризации и транскрипции: ${error}`, 'diarization');
    throw error;
  }
}

/**
 * Диаризация и сравнительная транскрипция с разными моделями
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Опции диаризации
 * @param {Function} transcribeCompareFunction Функция для транскрипции с разными моделями
 * @returns {Promise<Object>} Результат диаризации с транскрипцией и сравнением
 */
export async function simpleDiarizeAndCompareModels(audioFilePath, options, transcribeCompareFunction) {
  try {
    // Получаем результат диаризации
    const diarizationResult = await simpleDiarizeAudio(audioFilePath, options);
    
    // Если функция сравнения не предоставлена, возвращаем результат диаризации
    if (!transcribeCompareFunction) {
      return diarizationResult;
    }
    
    log('Подготовка сегментов для сравнения моделей транскрипции...', 'diarization');
    
    // Директория для сегментов
    const segmentsDir = path.join(TEMP_DIR, 'segments_compare_' + Date.now());
    fs.mkdirSync(segmentsDir, { recursive: true });
    
    // Список моделей для сравнения
    const models = ['whisper-1', 'gpt-4o-mini-transcribe', 'gpt-4o-transcribe'];
    
    // Извлекаем сегменты и сравниваем транскрипцию с разными моделями
    const segmentComparisonPromises = diarizationResult.segments.map(async (segment, index) => {
      try {
        // Создаем файл сегмента
        const segmentPath = path.join(segmentsDir, `segment_${index}_speaker_${segment.speaker}.mp3`);
        
        // Извлекаем сегмент
        await new Promise((resolve, reject) => {
          const ffmpeg = spawn('ffmpeg', [
            '-i', audioFilePath,
            '-ss', segment.start.toString(),
            '-to', segment.end.toString(),
            '-c:a', 'mp3',
            segmentPath
          ]);
          
          ffmpeg.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Ошибка при извлечении сегмента ${index}, код: ${code}`));
            }
          });
          
          ffmpeg.on('error', reject);
        });
        
        // Получаем сравнительные результаты транскрипции для этого сегмента
        const comparisonResults = await transcribeCompareFunction(segmentPath, {
          speakerIndex: parseInt(segment.speaker) - 1 // Передаём индекс говорящего (0-based)
        });
        
        return { 
          ...segment, 
          segment_path: segmentPath,
          transcriptions: comparisonResults
        };
      } catch (error) {
        log(`Ошибка при сравнительной транскрипции сегмента ${index}: ${error}`, 'diarization');
        return { 
          ...segment, 
          transcriptions: {
            error: error.message
          }
        };
      }
    });
    
    // Дожидаемся завершения всех транскрипций
    const segmentsWithComparisons = await Promise.all(segmentComparisonPromises);
    
    // Форматируем результаты для каждой модели
    const modelResults = {};
    
    models.forEach(model => {
      // Полная транскрипция для каждой модели
      const transcriptsByModel = segmentsWithComparisons
        .filter(s => s.transcriptions && s.transcriptions[model] && s.transcriptions[model].text)
        .sort((a, b) => a.start - b.start)
        .map(s => ({
          speaker: s.speaker,
          text: s.transcriptions[model].text,
          start: s.start,
          end: s.end,
          processingTime: s.transcriptions[model].processingTime
        }));
      
      // Формируем полный текст для этой модели
      const fullText = transcriptsByModel
        .map(item => {
          // Если текст уже содержит метку [Говорящий], или это тишина/шум, оставляем как есть
          if (item.text.includes('[Говорящий') || 
              item.text.toLowerCase().includes('[тишина]') || 
              item.text.toLowerCase().includes('[шум]') ||
              item.text.includes('запись без распознаваемой речи')) {
            return item.text;
          } else {
            return `[Говорящий ${item.speaker}]: ${item.text}`;
          }
        })
        .join('\n');
      
      modelResults[model] = {
        segments: transcriptsByModel,
        full_text: fullText,
        avg_processing_time: transcriptsByModel.length > 0 
          ? transcriptsByModel.reduce((sum, s) => sum + s.processingTime, 0) / transcriptsByModel.length 
          : 0
      };
    });
    
    // Обновляем результат
    diarizationResult.segments = segmentsWithComparisons;
    diarizationResult.model_results = modelResults;
    
    // Базовая транскрипция для совместимости (используем gpt-4o-transcribe как основную)
    diarizationResult.full_transcription = modelResults['gpt-4o-transcribe']?.full_text || 
      modelResults['gpt-4o-mini-transcribe']?.full_text || 
      modelResults['whisper-1']?.full_text || '';
    
    // Очищаем временную директорию
    try {
      fs.rmSync(segmentsDir, { recursive: true, force: true });
    } catch (err) {
      log(`Ошибка при удалении временной директории: ${err}`, 'diarization');
    }
    
    return diarizationResult;
  } catch (error) {
    log(`Ошибка при диаризации и сравнительной транскрипции: ${error}`, 'diarization');
    throw error;
  }
}

export default {
  simpleDiarizeAudio,
  simpleDiarizeAndTranscribe,
  simpleDiarizeAndCompareModels
};