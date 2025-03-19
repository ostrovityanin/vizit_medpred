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
    // Сначала очищаем текст от нежелательных символов
    const cleanedText = cleanText(text);
    
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
    
    return processedText.trim();
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

// Функция для разделения файла на части заданной длительности
async function splitAudioFile(
  inputPath: string, 
  outputDir: string, 
  segmentDurationSec: number = 300 // 5 минут по умолчанию
): Promise<string[]> {
  try {
    log(`Начинаем разделение большого аудиофайла на части по ${segmentDurationSec} секунд`, 'openai');
    
    // Убедимся, что директория существует
    await fsExtra.ensureDir(outputDir);
    
    // Генерируем имя для временных файлов
    const basename = path.basename(inputPath, path.extname(inputPath));
    const outputPattern = path.join(outputDir, `${basename}-%03d${path.extname(inputPath)}`);
    
    // Получаем информацию о длительности файла
    return new Promise((resolve, reject) => {
      let outputFiles: string[] = [];
      
      ffmpeg(inputPath)
        .outputOptions([
          `-f segment`,
          `-segment_time ${segmentDurationSec}`,
          `-c copy`, // Копируем без перекодирования
          `-reset_timestamps 1`,
          `-map 0`
        ])
        .output(outputPattern)
        .on('error', (err) => {
          log(`Ошибка при разделении файла: ${err.message}`, 'openai');
          reject(err);
        })
        .on('end', () => {
          // Ищем созданные файлы
          const files = fs.readdirSync(outputDir)
            .filter(file => file.startsWith(basename))
            .map(file => path.join(outputDir, file))
            .sort(); // Сортируем по имени для правильного порядка
          
          log(`Аудиофайл успешно разделен на ${files.length} частей`, 'openai');
          resolve(files);
        })
        .run();
    });
  } catch (error) {
    log(`Ошибка при разделении аудиофайла: ${error}`, 'openai');
    throw error;
  }
}

// Функция для объединения текстов транскрипций
function combineTranscriptions(transcriptions: string[]): string {
  // Простое объединение текстов с разделителем
  return transcriptions.join('\n\n');
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
    
    log(`Оптимизируем аудиофайл для распознавания: ${inputPath} -> ${outputPath}`, 'openai');
    
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        // Конвертируем в MP3 с низким битрейтом, достаточным для распознавания речи
        .outputOptions([
          '-ac 1',          // Моно (1 канал)
          '-ar 16000',      // Частота дискретизации 16 кГц, достаточно для речи
          '-b:a 32k',       // Битрейт 32 Кбит/с
          '-f mp3'          // Формат MP3
        ])
        .output(outputPath)
        .on('error', (err) => {
          log(`Ошибка при оптимизации аудиофайла: ${err.message}`, 'openai');
          reject(err);
        })
        .on('end', () => {
          // Проверяем размер полученного файла
          const stats = fs.statSync(outputPath);
          const sizeMB = stats.size / (1024 * 1024);
          
          log(`Аудиофайл успешно оптимизирован: ${sizeMB.toFixed(2)} МБ`, 'openai');
          
          // Если размер всё ещё превышает 25 МБ, возвращаем null, чтобы обработать его по частям
          if (sizeMB > 25) {
            log(`Оптимизированный файл всё еще слишком большой (${sizeMB.toFixed(2)} МБ), требуется разделение`, 'openai');
          }
          
          resolve(outputPath);
        })
        .run();
    });
  } catch (error) {
    log(`Ошибка при оптимизации аудиофайла: ${error}`, 'openai');
    throw error;
  }
}

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
            
            // Вызываем транскрипцию для этой части (рекурсивно, но без дальнейшего разделения)
            const segmentResult = await transcribeAudioSegment(segmentFile);
            
            if (segmentResult && segmentResult.text) {
              transcriptions.push(`Часть ${i+1}:\n${segmentResult.text}`);
              totalCost += parseFloat(segmentResult.cost);
              totalTokens += segmentResult.tokensProcessed;
            } else {
              log(`Не удалось распознать часть ${i+1}`, 'openai');
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
        }
      } catch (optimizeError) {
        log(`Ошибка при оптимизации файла: ${optimizeError}. Продолжаем с исходным файлом.`, 'openai');
        fileToProcess = filePath; // В случае ошибки используем оригинальный файл
      }
    }
    
    log(`Отправляем аудиофайл на распознавание: ${fileToProcess}`, 'openai');
    
    // Шаг 1: Базовое распознавание с помощью Whisper
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(fileToProcess),
      model: "whisper-1",
      language: "ru",
      temperature: 0.0,
    });

    // Очищаем от нерусских символов сразу
    const transcription = cleanText(response.text);
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
    
    // Шаг 2: Используем ChatGPT для идентификации говорящих и форматирования диалога
    try {
      log(`Делим текст на говорящих...`, 'openai');
      
      // Дополнительный проход для улучшения базовой транскрипции
      const enhancedTranscription = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Ты эксперт по анализу транскрипций аудиозаписей. Твоя задача - сохранить исходный текст максимально точно, исправляя только явные ошибки распознавания. ВАЖНО: НИКОГДА не заменяй нецензурные слова на приличные эквиваленты, сохраняй ТОЧНО то, что говорили люди, даже если это грубые или нецензурные выражения. Не изобретай новое содержание, работай только с тем, что есть в тексте."
          },
          {
            role: "user",
            content: `Вот сырая транскрипция аудиозаписи. Исправь только технические ошибки, но сохрани ВСЕ слова точно как они были произнесены, включая грубые и нецензурные: "${transcription}"`
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });
      
      // Если текст очень короткий, лучше не улучшать во избежание искажений
      const improvedText = transcription.length < 20 ? transcription : 
                         (enhancedTranscription.choices[0].message.content || transcription);
      log(`Улучшенная транскрипция: ${improvedText}`, 'openai');
      
      // Проверяем, не содержит ли улучшенная транскрипция ошибок
      const firstPassErrorPatterns = [
        /в задании не указано/i,
        /исправлений не требуется/i,
        /транскрипция представлена верно/i,
        /я не могу изменить/i,
        /я должен сохранить/i
      ];
      
      const containsFirstPassErrorMessage = firstPassErrorPatterns.some(pattern => pattern.test(improvedText));
      
      if (containsFirstPassErrorMessage) {
        log('Обнаружен ответ GPT с метаинструкциями вместо транскрипции в первом проходе', 'openai');
        return {
          text: 'Качество аудиозаписи не позволяет сделать точную транскрипцию. Проверьте аудиофайл.',
          cost: calculateTranscriptionCost(60), // Предполагаем минимальную длительность
          tokensProcessed: 100 // Минимальное количество токенов
        };
      }
      
      // Теперь определяем говорящих
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Ты эксперт по анализу аудиотранскрипций. Твоя задача - тщательно определить разных говорящих в тексте, разметить каждую фразу и отформатировать диалог. ВАЖНО: НИКОГДА не изменяй содержание речи, сохраняй абсолютно все слова, включая нецензурные выражения. Каждую реплику помечай, например 'Человек 1:', 'Человек 2:' или 'Женщина:', 'Мужчина:' и т.д. Определи пол говорящих, если это возможно. Анализируй внимательно контекст, чтобы понять, кто и когда говорит."
          },
          {
            role: "user",
            content: `Определи разных говорящих в этой транскрипции и отформатируй текст как полноценный диалог, указывая, кто говорит каждую фразу. Сохрани ТОЧНОЕ содержание текста, включая нецензурные выражения: "${improvedText}"`
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
    
  } catch (error) {
    log(`Ошибка при распознавании аудио: ${error}`, 'openai');
    return null;
  }
}