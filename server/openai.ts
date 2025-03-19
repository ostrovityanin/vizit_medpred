import OpenAI from 'openai';
import fs from 'fs';
import { log } from './vite';

// Создаем экземпляр клиента OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Функция для разделения текста на диалог
function parseDialogueFromText(text: string): string {
  try {
    const lines = text.split('\n');
    let processedText = '';
    let currentSpeaker = '';
    
    for (const line of lines) {
      // Пытаемся найти шаблоны говорящих
      // Например: "Человек 1: Текст" или "Женщина: Текст" и т.д.
      const speakerMatch = line.match(/^([А-Яа-я]+(?:\s[0-9])?|[A-Za-z]+(?:\s[0-9])?):(.+)$/);
      
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

export async function transcribeAudio(filePath: string): Promise<string | null> {
  try {
    log(`Отправляем аудиофайл на распознавание: ${filePath}`, 'openai');
    
    // Шаг 1: Базовое распознавание с помощью Whisper
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "ru",
    });

    const transcription = response.text;
    log(`Базовое распознавание успешно: ${transcription}`, 'openai');
    
    // Шаг 2: Используем ChatGPT для идентификации говорящих и форматирования диалога
    try {
      log(`Делим текст на говорящих...`, 'openai');
      
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Ты эксперт по анализу транскрипций. Твоя задача - определить разных говорящих в тексте и отформатировать диалог. Пометить каждую реплику говорящего, например 'Человек 1:', 'Человек 2:' и т.д. Никогда не выдумывай новый текст или контент, работай только с предоставленным текстом."
          },
          {
            role: "user",
            content: `Определи разных говорящих в этой транскрипции и отформатируй текст как диалог: "${transcription}"`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });
      
      const formattedText = completion.choices[0].message.content || '';
      log(`Разделение на говорящих: ${formattedText}`, 'openai');
      
      // Обрабатываем результат для лучшего форматирования
      const finalText = parseDialogueFromText(formattedText);
      return finalText;
      
    } catch (error) {
      log(`Ошибка при разделении на говорящих, возвращаем базовую транскрипцию: ${error}`, 'openai');
      return transcription;
    }
    
  } catch (error) {
    log(`Ошибка при распознавании аудио: ${error}`, 'openai');
    return null;
  }
}