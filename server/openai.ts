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
      // Единственный шаг: Базовое распознавание с помощью Whisper с напрямую выделенными говорящими
      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(fileToProcess),
        model: "whisper-1",
        language: "ru",
        temperature: 0.0,
        response_format: "verbose_json", // Запрашиваем расширенный формат ответа
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
      
      // Используем однопроходный метод с GPT-4 для идентификации говорящих
      try {
        log(`Делим текст на говорящих...`, 'openai');
        
        // Единственный проход через GPT-4 для разделения на говорящих
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "Ты эксперт по анализу аудиотранскрипций. Твоя задача - тщательно определить разных говорящих в тексте, разметить каждую фразу и отформатировать диалог. ВАЖНО: 1) НИКОГДА не изменяй содержание речи, сохраняй абсолютно все слова, включая нецензурные выражения. 2) НИКОГДА не добавляй фразы типа 'Продолжение следует...', 'Редактор субтитров...', 'Корректор...', копирайты и т.п. Возвращай ТОЛЬКО слова, которые были сказаны людьми в записи. 3) НИКОГДА не добавляй никаких пояснений от себя. Каждую реплику помечай, например 'Человек 1:', 'Человек 2:' или 'Женщина:', 'Мужчина:' и т.д."
            },
            {
              role: "user",
              content: `Определи разных говорящих в этой транскрипции и отформатируй текст как полноценный диалог, указывая, кто говорит каждую фразу. Сохрани ТОЧНОЕ содержание текста, включая нецензурные выражения: "${transcription}"`
            }
          ],
          temperature: 0.1,
          max_tokens: 4000,
        });
        
        const formattedText = completion.choices[0].message.content || '';
        log(`Разделение на говорящих: ${formattedText}`, 'openai');
        
        // Проверяем, не содержит ли ответ сообщений вроде "в задании не указано", "исправлений не требуется" и т.п.
        const errorPatterns = [
          /в задании не указано/i,
          /исправлений не требуется/i,
          /транскрипция представлена верно/i,
          /я не могу изменить/i,
          /я должен сохранить/i
        ];
        
        const containsErrorMessage = errorPatterns.some(pattern => pattern.test(formattedText));
        
        if (containsErrorMessage) {
          log('Обнаружен ответ GPT с метаинструкциями вместо транскрипции', 'openai');
          return {
            text: 'Качество аудиозаписи не позволяет сделать точную транскрипцию. Проверьте аудиофайл.',
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
        log(`Ошибка при разделении на говорящих, возвращаем базовую транскрипцию: ${error}`, 'openai');
        
        // Для упрощения также вернем оценочную стоимость и для базовой транскрипции
        const stats = fs.statSync(filePath);
        const estimatedDurationSeconds = stats.size / 16000;
        const estimatedTokens = Math.round(estimatedDurationSeconds * 15);
        const cost = calculateTranscriptionCost(estimatedDurationSeconds);
        
        return {
          text: transcription,
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