/**
 * Простая имплементация диаризации аудио в Node.js
 * 
 * Этот модуль предоставляет упрощенную версию диаризации аудио,
 * которая работает быстрее, но с меньшей точностью.
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

// Директория для временных файлов
const TEMP_DIR = path.join(os.tmpdir(), 'simple-diarization');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Анализирует аудиофайл и определяет тишину/речь
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {Promise<Array>} Массив сегментов [{ start, end, isSilence }]
 */
async function detectSilenceSegments(audioFilePath) {
  return new Promise((resolve, reject) => {
    // ffmpeg -i input.mp3 -af silencedetect=noise=-30dB:d=0.5 -f null -
    const ffmpeg = spawn('ffmpeg', [
      '-i', audioFilePath,
      '-af', 'silencedetect=noise=-30dB:d=0.5',
      '-f', 'null',
      '-'
    ]);
    
    let stderrOutput = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`FFmpeg завершился с ошибкой: ${code}`));
      }
      
      // Парсим вывод FFmpeg для получения начала и конца тишины
      const silenceStartRegex = /silence_start: (\d+(\.\d+)?)/g;
      const silenceEndRegex = /silence_end: (\d+(\.\d+)?)/g;
      
      const silenceStarts = [];
      const silenceEnds = [];
      
      let match;
      while ((match = silenceStartRegex.exec(stderrOutput)) !== null) {
        silenceStarts.push(parseFloat(match[1]));
      }
      
      while ((match = silenceEndRegex.exec(stderrOutput)) !== null) {
        silenceEnds.push(parseFloat(match[1]));
      }
      
      // Получаем длительность аудио
      const durationMatch = stderrOutput.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d+)/);
      let duration = 0;
      if (durationMatch) {
        const hours = parseInt(durationMatch[1]);
        const minutes = parseInt(durationMatch[2]);
        const seconds = parseFloat(durationMatch[3]);
        duration = hours * 3600 + minutes * 60 + seconds;
      }
      
      // Создаем массив сегментов
      const segments = [];
      
      // Если тишина в начале, добавляем ее
      if (silenceEnds.length > 0 && (silenceStarts.length === 0 || silenceEnds[0] < silenceStarts[0])) {
        segments.push({
          start: 0,
          end: silenceEnds[0],
          isSilence: true
        });
      }
      
      // Обрабатываем все остальные сегменты
      for (let i = 0; i < silenceStarts.length; i++) {
        // Добавляем речевой сегмент перед тишиной
        if (i === 0 && silenceStarts[i] > 0) {
          segments.push({
            start: 0,
            end: silenceStarts[i],
            isSilence: false
          });
        } else if (i > 0) {
          segments.push({
            start: silenceEnds[i - 1],
            end: silenceStarts[i],
            isSilence: false
          });
        }
        
        // Добавляем сегмент тишины
        if (i < silenceEnds.length) {
          segments.push({
            start: silenceStarts[i],
            end: silenceEnds[i],
            isSilence: true
          });
        } else {
          // Тишина до конца файла
          segments.push({
            start: silenceStarts[i],
            end: duration,
            isSilence: true
          });
        }
      }
      
      // Если последний сегмент не тишина и не достигает конца файла
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        if (!lastSegment.isSilence && lastSegment.end < duration) {
          segments.push({
            start: lastSegment.end,
            end: duration,
            isSilence: true
          });
        }
      }
      
      // Если нет сегментов, считаем весь файл речью
      if (segments.length === 0 && duration > 0) {
        segments.push({
          start: 0,
          end: duration,
          isSilence: false
        });
      }
      
      resolve(segments);
    });
    
    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Анализирует частотную характеристику сегмента для определения говорящего
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {number} start Начало сегмента в секундах
 * @param {number} end Конец сегмента в секундах
 * @returns {Promise<number>} Усредненная частота сегмента
 */
async function analyzeFrequencyCharacteristics(audioFilePath, start, end) {
  const segmentPath = path.join(TEMP_DIR, `segment_${Date.now()}.wav`);
  
  return new Promise((resolve, reject) => {
    // Извлекаем сегмент
    const ffmpeg = spawn('ffmpeg', [
      '-i', audioFilePath,
      '-ss', start.toString(),
      '-to', end.toString(),
      '-c:a', 'pcm_s16le',
      segmentPath
    ]);
    
    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Ошибка при извлечении сегмента: ${code}`));
      }
      
      // Анализируем частотную характеристику
      const ffprobe = spawn('ffprobe', [
        '-i', segmentPath,
        '-show_entries',
        'frame_tags=lavfi.r128.I',
        '-f', 'csv',
        '-v', 'quiet'
      ]);
      
      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ffprobe.on('close', (code) => {
        // Удаляем временный файл
        if (fs.existsSync(segmentPath)) {
          fs.unlinkSync(segmentPath);
        }
        
        if (code !== 0) {
          return resolve(0); // Не удалось проанализировать, возвращаем 0
        }
        
        // Парсим вывод
        const lines = output.trim().split('\n');
        const values = [];
        
        for (const line of lines) {
          if (line.includes('lavfi.r128.I=')) {
            const value = parseFloat(line.split('lavfi.r128.I=')[1]);
            if (!isNaN(value)) {
              values.push(value);
            }
          }
        }
        
        // Усредняем значения
        const average = values.length ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
        resolve(average);
      });
      
      ffprobe.on('error', (err) => {
        // Удаляем временный файл
        if (fs.existsSync(segmentPath)) {
          fs.unlinkSync(segmentPath);
        }
        reject(err);
      });
    });
    
    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Выполняет упрощенную диаризацию аудиофайла
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Опции диаризации
 * @returns {Promise<Object>} Результат диаризации
 */
export async function simpleDiarizeAudio(audioFilePath, options = {}) {
  try {
    console.log(`Начало упрощенной диаризации для файла: ${audioFilePath}`);
    
    // Определяем сегменты тишины/речи
    const allSegments = await detectSilenceSegments(audioFilePath);
    
    // Фильтруем только речевые сегменты
    const speechSegments = allSegments.filter(segment => !segment.isSilence);
    
    // Если нет речевых сегментов, возвращаем пустой результат
    if (speechSegments.length === 0) {
      return {
        audio_path: audioFilePath,
        duration: allSegments.length > 0 ? allSegments[allSegments.length - 1].end : 0,
        num_speakers: 0,
        segments: []
      };
    }
    
    // Характеристики для каждого сегмента
    const segmentCharacteristics = [];
    
    // Анализируем каждый речевой сегмент
    for (const segment of speechSegments) {
      const characteristics = await analyzeFrequencyCharacteristics(
        audioFilePath,
        segment.start,
        segment.end
      );
      
      segmentCharacteristics.push({
        ...segment,
        characteristics
      });
    }
    
    // Простая кластеризация на основе частотных характеристик
    // Для демонстрации используем пороговое значение
    const cluster1 = [];
    const cluster2 = [];
    
    // Находим минимальное и максимальное значение характеристик
    const values = segmentCharacteristics.map(s => s.characteristics);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const threshold = (minValue + maxValue) / 2;
    
    // Группируем сегменты по характеристикам
    for (const segment of segmentCharacteristics) {
      if (segment.characteristics <= threshold) {
        cluster1.push(segment);
      } else {
        cluster2.push(segment);
      }
    }
    
    // Определяем количество говорящих
    let numSpeakers = 0;
    if (cluster1.length > 0) numSpeakers++;
    if (cluster2.length > 0) numSpeakers++;
    
    // Создаем сегменты с идентификаторами говорящих
    const speakerSegments = [];
    
    for (const segment of cluster1) {
      speakerSegments.push({
        speaker: 0,
        start: segment.start,
        end: segment.end
      });
    }
    
    for (const segment of cluster2) {
      speakerSegments.push({
        speaker: 1,
        start: segment.start,
        end: segment.end
      });
    }
    
    // Сортируем сегменты по времени
    speakerSegments.sort((a, b) => a.start - b.start);
    
    const result = {
      audio_path: audioFilePath,
      duration: allSegments.length > 0 ? allSegments[allSegments.length - 1].end : 0,
      num_speakers: numSpeakers,
      segments: speakerSegments
    };
    
    console.log(`Упрощенная диаризация завершена. Обнаружено говорящих: ${numSpeakers}`);
    
    return result;
  } catch (error) {
    console.error('Ошибка при выполнении упрощенной диаризации:', error);
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
    
    console.log('Транскрибирование сегментов речи...');
    
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
        
        // Транскрибируем сегмент
        const transcription = await transcribeFunction(segmentPath);
        
        return { 
          ...segment, 
          segment_path: segmentPath,
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
      .sort((a, b) => a.start - b.start) // Сортируем по времени
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

export default {
  simpleDiarizeAudio,
  simpleDiarizeAndTranscribe
};