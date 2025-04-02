import OpenAI from 'openai';
import fs from 'fs';
import fsExtra from 'fs-extra';
import path from 'path';
import { log } from './vite';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Инициализируем ffmpeg с установленной версией
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Проверяем наличие API ключа для OpenAI
function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// Создаем экземпляр клиента OpenAI с обработкой пустого ключа
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Функция для очистки текста от нерусских символов и прочего мусора
function cleanText(text: string): string {
  // Удаляем все нерусские символы, оставляем только пунктуацию и цифры
  return text.replace(/[^А-Яа-яЁё\d\s.,!?:;()\-"']/g, '');
}

// Функция для разделения текста на диалог
function parseDialogueFromText(text: string): string {
  try {
    // Минимальная очистка - только сохраняем текст
    let cleanedText = text;
    
    // Функции очистки нет нужны, так как мы инструктировали модель не добавлять лишнее
    
    const lines = cleanedText.split('\n');
    let processedText = '';
    let currentSpeaker = '';
    
    for (const line of lines) {
      if (!line.trim()) continue; // Пропускаем пустые строки
      
      // Пытаемся найти шаблоны говорящих
      // Например: "Человек 1: Текст" или "Женщина: Текст" и т.д.
      const speakerMatch = line.match(/^([А-Яа-я]+(?:\s*[0-9])?|[A-Za-z]+(?:\s*[0-9])?):(.+)$/);
      
      if (speakerMatch) {
        // Нашли нового говорящего
        const [, speaker, speech] = speakerMatch;
        currentSpeaker = speaker.trim();
        processedText += `\n${currentSpeaker}: ${speech.trim()}`;
      } else if (line.trim() && currentSpeaker) {
        // Продолжение речи текущего говорящего
        processedText += `\n${currentSpeaker}: ${line.trim()}`;
      } else if (line.trim()) {
        // Речь без указания говорящего
        processedText += `\n${line.trim()}`;
      }
    }
    
    // Убираем потенциальные многократные переносы строк, возникшие после очистки
    let result = processedText.trim();
    result = result.replace(/\n{3,}/g, '\n\n');
    
    return result;
  } catch (error) {
    log(`Ошибка при обработке диалога: ${error}`, 'openai');
    return text;
  }
}

// Функция для расчета стоимости транскрипции в долларах
function calculateTranscriptionCost(durationSeconds: number): string {
  // Цены на Whisper API (по состоянию на март 2025)
  // https://openai.com/pricing
  const costPerMinute = 0.006; // $0.006 за минуту
  
  // Переводим секунды в минуты
  const durationMinutes = durationSeconds / 60;
  
  // Рассчитываем стоимость
  const cost = durationMinutes * costPerMinute;
  
  // Возвращаем стоимость в формате строки с двумя десятичными знаками
  return cost.toFixed(4);
}

// Функция для объединения текстов транскрипций
function combineTranscriptions(transcriptions: string[]): string {
  // Простое объединение текстов с разделителем
  return transcriptions.join('\n\n');
}

/**
 * Разделяет аудиофайл на сегменты указанной длительности
 * @param inputPath Путь к исходному файлу
 * @param outputDir Директория для сохранения сегментов
 * @param segmentDurationSeconds Длительность каждого сегмента в секундах
 * @returns Массив путей к созданным сегментам
 */
async function splitAudioFile(
  inputPath: string,
  outputDir: string,
  segmentDurationSeconds: number = 300 // 5 минут по умолчанию
): Promise<string[]> {
  try {
    log(`Разделяем аудиофайл ${inputPath} на сегменты по ${segmentDurationSeconds} секунд`, 'openai');
    
    // Создаем выходную директорию, если она не существует
    await fsExtra.ensureDir(outputDir);
    
    const basename = path.basename(inputPath, path.extname(inputPath));
    const segmentFiles: string[] = [];
    
    // Получаем информацию о длительности файла
    const ffprobePromise = new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          log(`Ошибка при получении метаданных файла: ${err.message}`, 'openai');
          reject(err);
          return;
        }
        
        if (!metadata || !metadata.format || !metadata.format.duration) {
          log('Не удалось получить длительность файла', 'openai');
          reject(new Error('Не удалось получить длительность файла'));
          return;
        }
        
        const durationSeconds = metadata.format.duration;
        log(`Длительность файла: ${durationSeconds} секунд`, 'openai');
        resolve(durationSeconds);
      });
    });
    
    const durationSeconds = await ffprobePromise;
    const segmentCount = Math.ceil(durationSeconds / segmentDurationSeconds);
    
    log(`Файл будет разделен на ${segmentCount} сегментов`, 'openai');
    
    // Создаем сегменты с помощью ffmpeg
    for (let i = 0; i < segmentCount; i++) {
      const startTime = i * segmentDurationSeconds;
      const outputPath = path.join(outputDir, `${basename}-segment-${i}.mp3`);
      
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(startTime)
          .setDuration(segmentDurationSeconds)
          .outputOptions([
            '-ac 1',          // Моно (1 канал)
            '-ar 16000',      // Частота дискретизации 16 кГц
            '-b:a 32k',       // Битрейт 32 Кбит/с
            '-f mp3'          // Формат MP3
          ])
          .output(outputPath)
          .on('error', (err) => {
            log(`Ошибка при создании сегмента ${i}: ${err.message}`, 'openai');
            reject(err);
          })
          .on('end', () => {
            log(`Создан сегмент ${i}: ${outputPath}`, 'openai');
            segmentFiles.push(outputPath);
            resolve();
          })
          .run();
      });
    }
    
    return segmentFiles;
  } catch (error) {
    log(`Ошибка при разделении аудиофайла: ${error}`, 'openai');
    return [];
  }
}

/**
 * Оптимизирует аудиофайл для распознавания речи, уменьшая его размер
 * @param inputPath Путь к исходному файлу
 * @param outputPath Путь для сохранения оптимизированного файла (если не указан, сгенерируется автоматически)
 * @returns Путь к оптимизированному файлу
 */
async function optimizeAudioForTranscription(
  inputPath: string,
  outputPath?: string
): Promise<string> {
  try {
    // Если выходной путь не указан, генерируем его на основе входного
    if (!outputPath) {
      const dir = path.dirname(inputPath);
      const basename = path.basename(inputPath, path.extname(inputPath));
      outputPath = path.join(dir, `${basename}-optimized.mp3`);
    }
    
    const finalOutputPath = outputPath; // Создаем локальную переменную, которая точно не undefined
    log(`Оптимизируем аудиофайл для распознавания: ${inputPath} -> ${finalOutputPath}`, 'openai');
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        // Конвертируем в MP3 с низким битрейтом, достаточным для распознавания речи
        .outputOptions([
          '-ac 1',          // Моно (1 канал)
          '-ar 16000',      // Частота дискретизации 16 кГц, достаточно для речи
          '-b:a 32k',       // Битрейт 32 Кбит/с
          '-f mp3'          // Формат MP3
        ])
        .output(finalOutputPath)
        .on('error', (err) => {
          log(`Ошибка при оптимизации аудиофайла: ${err.message}`, 'openai');
          reject(err);
        })
        .on('end', () => {
          // Проверяем размер полученного файла
          const stats = fs.statSync(finalOutputPath);
          const sizeMB = stats.size / (1024 * 1024);
          
          log(`Аудиофайл успешно оптимизирован: ${sizeMB.toFixed(2)} МБ`, 'openai');
          
          // Если размер всё ещё превышает 25 МБ, логируем это, но все равно возвращаем путь
          if (sizeMB > 25) {
            log(`Оптимизированный файл всё еще слишком большой (${sizeMB.toFixed(2)} МБ), требуется разделение`, 'openai');
          }
          
          resolve(finalOutputPath);
        })
        .run();
    });
  } catch (error) {
    log(`Ошибка при оптимизации аудиофайла: ${error}`, 'openai');
    throw error;
  }
}

/**
 * Функция для расчета стоимости распознавания GPT-4o
 * Стоимость GPT-4o Audio: $15 за 1 млн токенов ввода, $75 за 1 млн токенов вывода
 * Аудио оценивается примерно в 50 токенов за секунду
 */
function calculateGPT4oTranscriptionCost(durationSeconds: number): string {
  // $15 за 1 млн токенов ввода (аудио)
  const inputTokens = durationSeconds * 50; // примерно 50 токенов на секунду для аудио
  const inputCost = (inputTokens / 1000000) * 15;
  
  // $75 за 1 млн токенов вывода (текст)
  // Примерно 1 токен вывода на секунду (очень примерно)
  const outputTokens = durationSeconds * 1;
  const outputCost = (outputTokens / 1000000) * 75;
  
  // Общая стоимость
  const totalCost = inputCost + outputCost;
  return totalCost.toFixed(4);
}

/**
 * Распознает аудиофайл с помощью GPT-4o Audio Preview
 * @param filePath Путь к аудиофайлу
 * @returns Распознанный текст, стоимость и количество обработанных токенов
 */
async function transcribeWithGPT4o(filePath: string): Promise<{text: string, cost: string, tokensProcessed: number} | null> {
  try {
    // Проверяем, существует ли файл
    if (!fs.existsSync(filePath)) {
      log(`Файл не найден: ${filePath}`, 'openai');
      return null;
    }
    
    // Проверяем размер файла
    const fileStats = fs.statSync(filePath);
    if (fileStats.size === 0) {
      log(`Файл имеет нулевой размер: ${filePath}`, 'openai');
      return null;
    }
    
    log(`Распознавание с помощью GPT-4o Audio Preview: ${filePath}`, 'openai');
    log(`Размер аудиофайла: ${(fileStats.size / (1024 * 1024)).toFixed(2)} МБ`, 'openai');
    
    // Инструкция для GPT-4o
    const systemPrompt = `
    Ты русскоязычный эксперт по транскрипции речи.
    
    Выполни транскрипцию аудиозаписи и выдели разных говорящих.
    
    Правила:
    1. Расшифруй аудио максимально точно и полностью
    2. Формат ответа: "Говорящий 1: [текст]", "Говорящий 2: [текст]" или "Женщина: [текст]", "Мужчина: [текст]"
    3. Если невозможно определить разных говорящих или это монолог, используй формат "Говорящий: [текст]"
    4. Никогда не пиши комментарии к транскрипции. Не пиши вступительных или заключительных фраз.
    5. Выдай только распознанный текст, никаких пояснений или метаданных
    6. Сохраняй оригинальный стиль речи, сленг, повторы и особенности произношения
    7. Ты не должен объяснять невозможность разделить говорящих и не должен писать о проблемах с качеством аудио
    `;
    
    try {
      // Получаем API ключ (уже должен быть настроен)
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      
      if (!OPENAI_API_KEY) {
        log(`OPENAI_API_KEY отсутствует, GPT-4o не может быть использован`, 'openai');
        return null;
      }
      
      // Замер времени начала распознавания
      const startTime = Date.now();
      
      // По документации из https://cookbook.openai.com/examples/gpt4o/introduction_to_gpt4o
      // 1. Проверяем, есть ли доступ к модели gpt-4o-audio-preview
      try {
        log('Проверка доступа к gpt-4o-audio-preview...', 'openai');
        
        // Проверяем наличие модели путем вызова простого запроса
        const testResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{role: "user", content: "Test connection"}],
          max_tokens: 10
        });
        
        log('Доступ к GPT-4o подтвержден, продолжаем с аудио', 'openai');
      } catch (modelError: any) {
        if (modelError.status === 404 || modelError.message?.includes('does not exist')) {
          log('Модель gpt-4o-audio-preview не найдена в вашем аккаунте OpenAI', 'openai');
          return null;
        } else {
          log(`Ошибка при проверке доступа к модели: ${modelError}`, 'openai');
          return null;
        }
      }
      
      // 2. Создаем FormData для отправки аудиофайла
      // Для этого будем использовать fetch API вместо OpenAI SDK
      const fs = require('fs');
      const { Readable } = require('stream');
      const { FormData } = require('formdata-node');
      const { fileFromPath } = require('formdata-node/file-from-path');
      
      // Создаем FormData
      const formData = new FormData();
      
      // Добавляем JSON с сообщениями
      const messages = [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user", 
          content: [
            {
              type: "text",
              text: "Распознай эту аудиозапись с выделением говорящих. Выдай только транскрипцию, без комментариев и метаданных."
            },
            {
              type: "audio",
              audio_url: "data:audio/wav;base64,${audioBase64}"
            }
          ]
        }
      ];
      
      // Читаем файл в Base64
      const audioBuffer = fs.readFileSync(filePath);
      const audioBase64 = audioBuffer.toString('base64');
      
      // Заменяем placeholder в сообщении на реальные данные
      messages[1].content[1].audio_url = `data:audio/wav;base64,${audioBase64}`;
      
      formData.append('model', 'gpt-4o-audio-preview');
      formData.append('messages', JSON.stringify(messages));
      formData.append('temperature', '0.1');
      
      // 3. Отправляем запрос напрямую к API
      log('Отправка запроса к GPT-4o Audio API...', 'openai');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: formData
      });
      
      // 4. Обрабатываем ответ
      if (!response.ok) {
        const errorText = await response.text();
        log(`Ошибка при обращении к GPT-4o Audio API: ${response.status} ${response.statusText}`, 'openai');
        log(`Детали ошибки: ${errorText}`, 'openai');
        return null;
      }
      
      const result = await response.json();
      
      // Получаем текст из ответа
      const transcribedText = result.choices[0].message.content;
      
      // Рассчитываем длительность аудиофайла на основе размера (приблизительно)
      // Для WAV файла: ~16 КБ на секунду для моно, 16-бит, 16 кГц
      const durationSeconds = fileStats.size / 16000;
      
      // Рассчитываем стоимость
      const cost = calculateGPT4oTranscriptionCost(durationSeconds);
      
      // Рассчитываем количество обработанных токенов
      // Для аудио: примерно 50 токенов на секунду
      const tokensProcessed = Math.round(durationSeconds * 50);
      
      // Время распознавания
      const endTime = Date.now();
      const processingTime = (endTime - startTime) / 1000;
      
      log(`GPT-4o успешно распознал аудио за ${processingTime.toFixed(2)} секунд`, 'openai');
      log(`Результат распознавания: ${transcribedText.substring(0, 100)}...`, 'openai');
      
      return {
        text: transcribedText,
        cost: cost,
        tokensProcessed: tokensProcessed
      };
    } catch (apiError) {
      log(`Ошибка при вызове GPT-4o API: ${apiError}`, 'openai');
      log('Продолжаем с использованием стандартного Whisper API', 'openai');
      return null;
    }
  } catch (error) {
    log(`Ошибка при распознавании с GPT-4o Audio Preview: ${error}`, 'openai');
    return null;
  }
}

/**
 * Распознает аудиофайл с помощью OpenAI API
 * @param filePath Путь к аудиофайлу
 * @returns Распознанный текст, стоимость и количество обработанных токенов
 */
export async function transcribeAudio(filePath: string): Promise<{text: string | null, cost: string, tokensProcessed: number} | null> {
  try {
    // Проверяем наличие API ключа
    if (!isOpenAIConfigured()) {
      log('OPENAI_API_KEY не настроен, пропускаем распознавание речи', 'openai');
      return { 
        text: 'API ключ не настроен. Добавьте OPENAI_API_KEY для активации распознавания.', 
        cost: '0.0000', 
        tokensProcessed: 0 
      };
    }
    
    // Проверяем размер исходного файла
    const fileStats = fs.statSync(filePath);
    const fileSizeMB = fileStats.size / (1024 * 1024);
    
    log(`Размер исходного аудиофайла: ${fileSizeMB.toFixed(2)} МБ`, 'openai');
    
    // Проверяем, нужно ли оптимизировать файл
    let fileToProcess = filePath;
    
    if (fileSizeMB > 20) { // Если файл больше 20 МБ, оптимизируем его
      try {
        // Оптимизируем файл
        fileToProcess = await optimizeAudioForTranscription(filePath);
        
        // Проверяем размер оптимизированного файла
        const optimizedStats = fs.statSync(fileToProcess);
        const optimizedSizeMB = optimizedStats.size / (1024 * 1024);
        
        // Если файл все равно больше 25 МБ (лимит OpenAI), разделяем его и обрабатываем по частям
        if (optimizedSizeMB > 25) {
          log(`Оптимизированный файл слишком большой (${optimizedSizeMB.toFixed(2)} МБ), разделяем его на части`, 'openai');
          
          // Создаем временную директорию для частей файла
          const tempDir = path.join(path.dirname(filePath), 'temp_segments');
          await fsExtra.ensureDir(tempDir);
          
          try {
            // Разделяем файл на части по 5 минут
            const segmentFiles = await splitAudioFile(fileToProcess, tempDir, 300);
            
            if (segmentFiles.length === 0) {
              throw new Error('Не удалось разделить файл на части');
            }
            
            log(`Файл разделен на ${segmentFiles.length} частей, обрабатываем последовательно`, 'openai');
            
            // Выполняем транскрипцию каждой части отдельно
            const transcriptions: string[] = [];
            let totalCost = 0;
            let totalTokens = 0;
            
            for (let i = 0; i < segmentFiles.length; i++) {
              const segmentFile = segmentFiles[i];
              log(`Обрабатываем часть ${i+1}/${segmentFiles.length}: ${segmentFile}`, 'openai');
              
              try {
                // Базовое распознавание с помощью Whisper для каждого сегмента
                const response = await openai.audio.transcriptions.create({
                  file: fs.createReadStream(segmentFile),
                  model: "whisper-1",
                  language: "ru",
                  temperature: 0.0,
                });
                
                // Очищаем от нерусских символов
                const segmentTranscription = cleanText(response.text);
                log(`Распознавание сегмента ${i+1} успешно, длина текста: ${segmentTranscription.length}`, 'openai');
                
                // Получаем статистику файла для расчета стоимости
                const segmentStats = fs.statSync(segmentFile);
                const segmentDurationSeconds = segmentStats.size / 16000; // примерная оценка для WAV
                const segmentTokens = Math.round(segmentDurationSeconds * 15);
                const segmentCost = calculateTranscriptionCost(segmentDurationSeconds);
                
                transcriptions.push(`Часть ${i+1}:\n${segmentTranscription}`);
                totalCost += parseFloat(segmentCost);
                totalTokens += segmentTokens;
              } catch (segmentError) {
                log(`Ошибка при распознавании части ${i+1}: ${segmentError}`, 'openai');
                transcriptions.push(`[Часть ${i+1}: Не распознана]`);
              }
            }
            
            // Объединяем все транскрипции
            const combinedText = combineTranscriptions(transcriptions);
            
            // Очищаем временные файлы
            try {
              await fsExtra.remove(tempDir);
              log(`Удалена временная директория: ${tempDir}`, 'openai');
            } catch (cleanupError) {
              log(`Ошибка при удалении временных файлов: ${cleanupError}`, 'openai');
            }
            
            return {
              text: combinedText,
              cost: totalCost.toFixed(4),
              tokensProcessed: totalTokens
            };
          } catch (splitError) {
            log(`Ошибка при разделении и обработке файла: ${splitError}`, 'openai');
            // Продолжаем с оптимизированным файлом, даже если он слишком большой
            // OpenAI API может отклонить запрос, но мы все равно попробуем
          }
        }
      } catch (optimizeError) {
        log(`Ошибка при оптимизации файла: ${optimizeError}. Продолжаем с исходным файлом.`, 'openai');
        fileToProcess = filePath; // В случае ошибки используем оригинальный файл
      }
    }
    
    log(`Отправляем аудиофайл на распознавание: ${fileToProcess}`, 'openai');
    
    try {
      // Проверяем существование и размер файла перед обработкой
      if (!fs.existsSync(fileToProcess)) {
        log(`Ошибка: файл ${fileToProcess} не найден`, 'openai');
        return {
          text: 'Ошибка: аудиофайл не найден',
          cost: '0.0000',
          tokensProcessed: 0
        };
      }
      
      const fileInfo = fs.statSync(fileToProcess);
      if (fileInfo.size === 0) {
        log(`Ошибка: файл ${fileToProcess} имеет нулевой размер`, 'openai');
        return {
          text: 'Ошибка: аудиофайл имеет нулевой размер',
          cost: '0.0000',
          tokensProcessed: 0
        };
      }
      
      log(`Проверка файла ${fileToProcess} перед отправкой: ${fileInfo.size} байт`, 'openai');
      
      // Пробуем сначала использовать GPT-4o Audio Preview
      try {
        log(`Пробуем использовать GPT-4o Audio Preview для улучшенной транскрипции...`, 'openai');
        const gpt4oResult = await transcribeWithGPT4o(fileToProcess);
        
        if (gpt4oResult && gpt4oResult.text) {
          log(`Успешно распознано с GPT-4o Audio Preview!`, 'openai');
          return {
            text: gpt4oResult.text,
            cost: gpt4oResult.cost,
            tokensProcessed: gpt4oResult.tokensProcessed
          };
        }
        
        log(`GPT-4o Audio Preview не вернул результат, переключаемся на стандартный Whisper...`, 'openai');
      } catch (gpt4oError) {
        log(`Ошибка при использовании GPT-4o Audio Preview: ${gpt4oError}. Переключаемся на стандартный Whisper...`, 'openai');
      }
      
      // Проверяем формат файла с помощью ffprobe
      try {
        const ffprobePromise = new Promise<boolean>((resolve, reject) => {
          ffmpeg.ffprobe(fileToProcess, (err, metadata) => {
            if (err) {
              log(`Ошибка при анализе аудиофайла: ${err.message}`, 'openai');
              reject(err);
              return;
            }
            
            if (!metadata || !metadata.format) {
              log('Не удалось получить информацию о формате аудиофайла', 'openai');
              reject(new Error('Неизвестный формат аудиофайла'));
              return;
            }
            
            // Проверяем, что файл содержит аудиопотоки
            const hasAudioStreams = metadata.streams?.some(stream => stream.codec_type === 'audio');
            if (!hasAudioStreams) {
              log('Аудиофайл не содержит аудиопотоков', 'openai');
              reject(new Error('Файл не содержит аудиопотоков'));
              return;
            }
            
            log(`Формат аудиофайла: ${metadata.format.format_name}, аудиопотоки: ${metadata.streams?.filter(s => s.codec_type === 'audio').length}`, 'openai');
            resolve(true);
          });
        }).catch((error) => {
          log(`Предупреждение при проверке аудиофайла: ${error}`, 'openai');
          // Продолжаем даже при ошибке анализа, OpenAI API может справиться
          return true;
        });
        
        await ffprobePromise;
      } catch (ffprobeError) {
        log(`Ошибка при выполнении ffprobe: ${ffprobeError}`, 'openai');
        // Продолжаем выполнение, так как эта проверка не критична
      }
      
      // Единственный шаг: Базовое распознавание с помощью Whisper с напрямую выделенными говорящими
      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(fileToProcess),
        model: "whisper-1",
        language: "ru",
        temperature: 0.2, // Небольшое увеличение temperature для более полного распознавания
        response_format: "verbose_json", // Запрашиваем расширенный формат ответа
        prompt: "Это аудиозапись диалога. Пожалуйста, распознай весь текст полностью." // Подсказка для улучшения распознавания
      });
      
      // Извлекаем текст и информацию о сегментах
      let transcription = '';
      let segments = [];
      
      try {
        if (typeof response === 'string') {
          // Если ответ получен как строка, пробуем распарсить JSON
          const parsedResponse = JSON.parse(response);
          transcription = parsedResponse.text || '';
          segments = parsedResponse.segments || [];
        } else {
          // Если ответ уже является объектом
          transcription = response.text || '';
          segments = (response as any).segments || [];
        }
      } catch (parseError) {
        log(`Ошибка при парсинге ответа Whisper: ${parseError}. Используем текст напрямую.`, 'openai');
        if (typeof response === 'string') {
          transcription = response;
        } else if (typeof response.text === 'string') {
          transcription = response.text;
        }
      }
  
      // Очищаем от нерусских символов сразу
      transcription = cleanText(transcription);
      log(`Базовое распознавание успешно: ${transcription}`, 'openai');
      
      // Проверка на повторяющиеся паттерны, что может указывать на проблему с аудио
      const hasPatternRepetition = /(.{2,5})\1{10,}/g.test(transcription) || 
                                /((?:[А-Яа-я]+ ){1,3})\1{5,}/g.test(transcription);
      if (hasPatternRepetition) {
        log(`Обнаружен повторяющийся паттерн в транскрипции, возможно проблема с аудиофайлом`, 'openai');
        return {
          text: 'В аудиофайле обнаружены повторяющиеся паттерны или шум. Возможно проблема с записью.',
          cost: calculateTranscriptionCost(60), // Предполагаем минимальную длительность 1 минута
          tokensProcessed: 100 // Минимальное количество токенов
        };
      }
      
      // Проверяем, достаточно ли текста для анализа
      if (transcription.trim().length < 10) {
        log(`Транскрипция слишком короткая для анализа: "${transcription}"`, 'openai');
        return {
          text: `Говорящий: ${transcription}`,
          cost: calculateTranscriptionCost(30),
          tokensProcessed: 50
        };
      }
      
      // Используем однопроходный метод с GPT-4 для идентификации говорящих
      try {
        log(`Делим текст на говорящих...`, 'openai');
        
        // Создаем промпт для системы
        const systemPrompt = "Ты эксперт по обработке аудиотранскрипций. Обязательно добавь метки говорящих, не меняй текст. Используй 'Говорящий:' для монологов. НИКОГДА не пиши комментарии о невозможности разделения. Возвращай только отформатированный текст."; 
        
        // Создаем промпт для пользователя
        const userPrompt = `Транскрипция: "${transcription}". Добавь метки говорящих. Если сложно определить разных говорящих, пометь как "Говорящий: ${transcription}".`;
        
        // Отправляем запрос к OpenAI API
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user", 
              content: userPrompt
            }
          ],
          temperature: 0.1,
          max_tokens: 4000,
        });
        
        const formattedText = completion.choices[0].message.content || '';
        log(`Разделение на говорящих: ${formattedText}`, 'openai');
        
        // Проверяем, не содержит ли ответ метакомментариев вместо размеченного диалога
        const errorPatterns = [
          /в задании не указано/i,
          /исправлений не требуется/i,
          /транскрипция представлена верно/i,
          /я не могу изменить/i,
          /я должен сохранить/i,
          /извините/i,
          /извиняюсь/i,
          /недостаточно информации/i,
          /недостаточно данных/i,
          /предоставьте более/i,
          /предоставьте дополнительную/i,
          /предоставьте контекст/i,
          /недостаточно контекста/i,
          /не могу определить/i,
          /трудно определить/i,
          /невозможно определить/i,
          /пожалуйста/i,
          /к сожалению/i,
          /без контекста/i,
          /не хватает данных/i
        ];
        
        const containsErrorMessage = errorPatterns.some(pattern => pattern.test(formattedText));
        
        if (containsErrorMessage) {
          log('Обнаружен ответ GPT с метаинструкциями вместо транскрипции', 'openai');
          
          // Если GPT вернул метакомментарий, форматируем базовую транскрипцию самостоятельно
          const formattedBasicText = `Говорящий: ${transcription}`;
          
          return {
            text: formattedBasicText,
            cost: calculateTranscriptionCost(60), // Предполагаем минимальную длительность
            tokensProcessed: 100 // Минимальное количество токенов
          };
        }
        
        // Обрабатываем результат для лучшего форматирования
        const finalText = parseDialogueFromText(formattedText);
        
        // Получаем статистику файла, чтобы узнать его продолжительность
        const stats = fs.statSync(filePath);
        
        // Используем общую продолжительность аудио для расчета стоимости
        // Это берем из продолжительности файла в байтах / средний битрейт
        // Для простоты возьмем примерную оценку: 16KB на 1 секунду для WAV файла
        const estimatedDurationSeconds = stats.size / 16000;
        
        // Оценка количества токенов: приблизительно 15 токенов на секунду для русского языка
        const estimatedTokens = Math.round(estimatedDurationSeconds * 15);
        
        // Рассчитываем стоимость
        const cost = calculateTranscriptionCost(estimatedDurationSeconds);
        
        log(`Стоимость распознавания: $${cost} (${estimatedTokens} токенов)`, 'openai');
        
        return {
          text: finalText,
          cost: cost,
          tokensProcessed: estimatedTokens
        };
        
      } catch (error) {
        log(`Ошибка при разделении на говорящих, возвращаем базовую транскрипцию с форматированием: ${error}`, 'openai');
        
        // Для упрощения также вернем оценочную стоимость и для базовой транскрипции
        const stats = fs.statSync(filePath);
        const estimatedDurationSeconds = stats.size / 16000;
        const estimatedTokens = Math.round(estimatedDurationSeconds * 15);
        const cost = calculateTranscriptionCost(estimatedDurationSeconds);
        
        // Форматируем базовую транскрипцию самостоятельно
        const formattedBasicText = `Говорящий: ${transcription}`;
        
        return {
          text: formattedBasicText,
          cost: cost,
          tokensProcessed: estimatedTokens
        };
      }
    } catch (whisperError) {
      log(`Ошибка при базовом распознавании: ${whisperError}`, 'openai');
      throw whisperError;
    }
  } catch (error) {
    log(`Ошибка при распознавании аудио: ${error}`, 'openai');
    return null;
  }
}