/**
 * Модуль сравнения диаризации и транскрипции
 * 
 * Этот модуль предоставляет API для:
 * 1. Управления микросервисом диаризации
 * 2. Сравнения результатов транскрипции от разных моделей
 * 3. Объединения результатов диаризации и транскрипции
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as diarizationService from './diarization-service.js';
import * as transcriptionApi from '../../transcription-api.js';

// Получаем путь к текущей директории (для ES модулей)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Директории для временных файлов и результатов
const TEMP_DIR = path.join(__dirname, '..', '..', '..', 'temp');
const RESULTS_DIR = path.join(__dirname, '..', '..', '..', 'data', 'comparison_results');

// Создаем директории, если они не существуют
[TEMP_DIR, RESULTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Проверяет статус сервиса диаризации
 * @returns {Promise<object>} Информация о состоянии сервиса
 */
async function checkDiarizationServiceStatus() {
  const isRunning = await diarizationService.isServiceRunning();
  
  if (isRunning) {
    const healthInfo = await diarizationService.checkServiceHealth();
    return {
      status: 'running',
      health: healthInfo || { status: 'unknown' },
      message: 'Diarization service is running.'
    };
  } else {
    return {
      status: 'stopped',
      health: null,
      message: 'Diarization service is not running.'
    };
  }
}

/**
 * Запускает сервис диаризации
 * @param {boolean} useSimplifiedVersion Использовать ли упрощенную версию
 * @returns {Promise<object>} Результат запуска
 */
async function startDiarizationService(useSimplifiedVersion = true) {
  const started = await diarizationService.startService(useSimplifiedVersion);
  
  if (started) {
    const healthInfo = await diarizationService.checkServiceHealth();
    return {
      status: 'success',
      health: healthInfo,
      message: 'Diarization service started successfully.'
    };
  } else {
    return {
      status: 'error',
      health: null,
      message: 'Failed to start diarization service.'
    };
  }
}

/**
 * Останавливает сервис диаризации
 * @returns {Promise<object>} Результат остановки
 */
async function stopDiarizationService() {
  const stopped = await diarizationService.stopService();
  
  return {
    status: stopped ? 'success' : 'error',
    message: stopped ? 'Diarization service stopped successfully.' : 'Failed to stop diarization service.'
  };
}

/**
 * Выполняет диаризацию аудиофайла
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {object} options Дополнительные параметры
 * @returns {Promise<object>} Результат диаризации
 */
async function performDiarization(audioFilePath, options = {}) {
  try {
    const result = await diarizationService.diarizeAudio(audioFilePath, options);
    return {
      status: 'success',
      diarization: result,
      message: 'Diarization completed successfully.'
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      message: 'Failed to perform diarization.'
    };
  }
}

/**
 * Выполняет транскрипцию аудиофайла с использованием разных моделей
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {string[]} models Список моделей для транскрипции
 * @param {string} language Код языка (необязательно)
 * @returns {Promise<object>} Результаты транскрипции от разных моделей
 */
async function performMultiModelTranscription(audioFilePath, models = [], language = null) {
  try {
    // Модели по умолчанию, если не указаны
    const modelsToUse = models.length > 0 ? models : [
      'whisper-1',
      'gpt-4o-mini-transcribe',
      'gpt-4o-transcribe'
    ];
    
    console.log(`Performing transcription with models: ${modelsToUse.join(', ')}`);
    
    // Выполняем транскрипцию с каждой моделью
    const results = {};
    const errors = {};
    
    for (const model of modelsToUse) {
      try {
        console.log(`Transcribing with model: ${model}`);
        
        const transcription = await transcriptionApi.transcribeAudio(audioFilePath, model, language);
        
        results[model] = {
          text: transcription.text,
          duration: transcription.duration,
          processingTime: transcription.processingTime,
          timestamp: new Date().toISOString()
        };
      } catch (modelError) {
        console.error(`Error transcribing with model ${model}:`, modelError);
        errors[model] = modelError.message;
      }
    }
    
    return {
      status: Object.keys(results).length > 0 ? 'success' : 'error',
      transcriptions: results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      message: Object.keys(results).length > 0 
        ? `Transcription completed with ${Object.keys(results).length}/${modelsToUse.length} models.`
        : 'Failed to transcribe with any model.'
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      message: 'Failed to perform transcription.'
    };
  }
}

/**
 * Объединяет результаты диаризации и транскрипции
 * @param {object} diarizationResult Результат диаризации
 * @param {object} transcriptionResults Результаты транскрипции от разных моделей
 * @returns {object} Объединенные результаты
 */
function combineResults(diarizationResult, transcriptionResults) {
  const combinedResults = {
    status: 'success',
    timestamp: new Date().toISOString(),
    audioInfo: {
      duration: diarizationResult.duration,
      numSpeakers: diarizationResult.num_speakers
    },
    segments: diarizationResult.segments,
    transcriptions: {}
  };
  
  // Добавляем полные тексты транскрипций для каждой модели
  Object.keys(transcriptionResults).forEach(model => {
    combinedResults.transcriptions[model] = {
      text: transcriptionResults[model].text,
      processingTime: transcriptionResults[model].processingTime
    };
  });
  
  return combinedResults;
}

/**
 * Выполняет полный процесс диаризации и транскрипции аудиофайла
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {object} options Дополнительные параметры
 * @returns {Promise<object>} Комбинированные результаты
 */
async function processAudioFile(audioFilePath, options = {}) {
  try {
    // Проверяем состояние сервиса диаризации
    const serviceStatus = await checkDiarizationServiceStatus();
    
    if (serviceStatus.status !== 'running') {
      console.log('Starting diarization service...');
      const startResult = await startDiarizationService(true);
      
      if (startResult.status !== 'success') {
        return {
          status: 'error',
          error: 'Failed to start diarization service',
          serviceStatus: startResult
        };
      }
    }
    
    // Выполняем диаризацию
    console.log('Performing diarization...');
    const diarizationResult = await performDiarization(audioFilePath, options);
    
    if (diarizationResult.status !== 'success') {
      return diarizationResult;
    }
    
    // Выполняем транскрипцию с разными моделями
    console.log('Performing transcription with multiple models...');
    const transcriptionResult = await performMultiModelTranscription(
      audioFilePath, 
      options.models,
      options.language
    );
    
    if (transcriptionResult.status !== 'success') {
      return transcriptionResult;
    }
    
    // Объединяем результаты
    const combinedResults = combineResults(
      diarizationResult.diarization,
      transcriptionResult.transcriptions
    );
    
    // Сохраняем результаты в файл, если указано имя файла
    if (options.outputFilename) {
      const outputPath = path.join(RESULTS_DIR, options.outputFilename);
      fs.writeFileSync(outputPath, JSON.stringify(combinedResults, null, 2));
      console.log(`Results saved to ${outputPath}`);
    }
    
    return {
      status: 'success',
      results: combinedResults,
      message: 'Audio processing completed successfully.'
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      message: 'Failed to process audio file.'
    };
  }
}

export default {
  checkDiarizationServiceStatus,
  startDiarizationService,
  stopDiarizationService,
  performDiarization,
  performMultiModelTranscription,
  processAudioFile
};