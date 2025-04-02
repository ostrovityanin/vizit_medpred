import OpenAI from 'openai';
import fs from 'fs-extra';
import path from 'path';
import { optimizeAudioForTranscription } from './audio';
import { splitAudioIntoSegments } from './ffmpeg';

// Инициализация OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Проверяет, настроен ли OpenAI API
 */
function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Очищает текст транскрипции от лишних символов
 * @param text Исходный текст
 */
function cleanText(text: string): string {
  return text
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Извлекает диалог из текста
 * @param text Исходный текст
 */
function parseDialogueFromText(text: string): string {
  return text;
}

/**
 * Рассчитывает приблизительную стоимость транскрипции
 * @param durationSeconds Длительность в секундах
 */
function calculateTranscriptionCost(durationSeconds: number): string {
  // Стоимость модели Whisper: $0.006 за минуту (цены могут измениться)
  const costPerMinute = 0.006;
  const costInUSD = (durationSeconds / 60) * costPerMinute;
  return costInUSD.toFixed(4);
}

/**
 * Объединяет несколько транскрипций в одну
 * @param transcriptions Массив транскрипций
 */
function combineTranscriptions(transcriptions: string[]): string {
  return transcriptions.join(' ');
}

/**
 * Оптимизирует аудиофайл для распознавания речи, уменьшая его размер
 * @param inputPath Путь к исходному файлу
 * @param outputPath Путь для сохранения оптимизированного файла (если не указан, сгенерируется автоматически)
 */
async function prepareAudioForTranscription(
  inputPath: string,
  outputPath?: string
): Promise<string> {
  const optimizedPath = await optimizeAudioForTranscription(inputPath, outputPath);
  return optimizedPath;
}

/**
 * Распознает аудиофайл с помощью OpenAI API
 * @param filePath Путь к аудиофайлу
 * @returns Распознанный текст, стоимость и количество обработанных токенов
 */
export async function transcribeAudio(filePath: string): Promise<{text: string | null, cost: string, tokensProcessed: number} | null> {
  if (!isOpenAIConfigured()) {
    console.error('OpenAI API не настроен. Установите OPENAI_API_KEY.');
    return null;
  }
  
  try {
    // Оптимизируем аудио для лучшего распознавания
    const optimizedFilePath = await prepareAudioForTranscription(filePath);
    
    // Если файл большой, разделим его на сегменты
    const fileSize = (await fs.stat(optimizedFilePath)).size;
    const MAX_SIZE = 25 * 1024 * 1024; // 25 МБ - максимальный размер для API
    
    let transcriptionText: string;
    let tokensProcessed = 0;
    
    if (fileSize > MAX_SIZE) {
      console.log(`Файл слишком большой (${fileSize} байт), разделяем на сегменты`);
      
      const tempDir = path.dirname(optimizedFilePath);
      const segments = await splitAudioIntoSegments(optimizedFilePath, tempDir, 300); // 5-минутные сегменты
      
      const transcriptions: string[] = [];
      
      for (let i = 0; i < segments.length; i++) {
        console.log(`Обработка сегмента ${i+1}/${segments.length}`);
        
        const response = await openai.audio.transcriptions.create({
          file: fs.createReadStream(segments[i]),
          model: 'whisper-1',
          language: 'ru'
        });
        
        transcriptions.push(cleanText(response.text));
        
        // Примерное количество токенов (1 токен ≈ 0.75 слова)
        const words = response.text.split(/\s+/).length;
        tokensProcessed += Math.ceil(words / 0.75);
      }
      
      transcriptionText = combineTranscriptions(transcriptions);
      
      // Удаляем временные файлы сегментов
      for (const segment of segments) {
        await fs.remove(segment).catch(() => {});
      }
    } else {
      console.log(`Транскрибируем файл (${fileSize} байт) целиком`);
      
      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(optimizedFilePath),
        model: 'whisper-1',
        language: 'ru'
      });
      
      transcriptionText = cleanText(response.text);
      
      // Примерное количество токенов
      const words = transcriptionText.split(/\s+/).length;
      tokensProcessed += Math.ceil(words / 0.75);
    }
    
    // Удаляем оптимизированный файл, если он отличается от исходного
    if (optimizedFilePath !== filePath) {
      await fs.remove(optimizedFilePath).catch(() => {});
    }
    
    // Рассчитываем стоимость
    const durationInSeconds = 0; // Здесь можно добавить получение длительности файла
    const cost = calculateTranscriptionCost(durationInSeconds);
    
    return {
      text: transcriptionText,
      cost,
      tokensProcessed
    };
  } catch (error) {
    console.error('Ошибка транскрипции:', error);
    return null;
  }
}