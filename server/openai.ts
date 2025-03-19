import OpenAI from 'openai';
import fs from 'fs';
import { log } from './vite';

// Создаем экземпляр клиента OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function transcribeAudio(filePath: string): Promise<string | null> {
  try {
    log(`Отправляем аудиофайл на распознавание: ${filePath}`, 'openai');
    
    // Читаем файл и отправляем его в OpenAI API
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "ru",
    });

    // Возвращаем распознанный текст
    log(`Распознавание успешно: ${response.text}`, 'openai');
    return response.text;
  } catch (error) {
    log(`Ошибка при распознавании аудио: ${error}`, 'openai');
    return null;
  }
}