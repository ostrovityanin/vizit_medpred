import OpenAI from 'openai';
import fs from 'fs';
import { log } from './vite';

// Создаем экземпляр клиента OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

export async function transcribeAudio(filePath: string): Promise<string | null> {
  try {
    log(`Отправляем аудиофайл на распознавание: ${filePath}`, 'openai');
    
    // Шаг 1: Базовое распознавание с помощью Whisper
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "ru",
      temperature: 0.0,
      prompt: "Это аудио на русском языке. Пожалуйста, распознавайте только русские слова.",
    });

    // Очищаем от нерусских символов сразу
    const transcription = cleanText(response.text);
    log(`Базовое распознавание успешно: ${transcription}`, 'openai');
    
    // Шаг 2: Используем ChatGPT для идентификации говорящих и форматирования диалога
    try {
      log(`Делим текст на говорящих...`, 'openai');
      
      // Дополнительный проход для улучшения базовой транскрипции
      const enhancedTranscription = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Ты эксперт по улучшению транскрипций аудиозаписей. Твоя задача - исправить ошибки распознавания, восстановить полный текст диалога и сделать его более читаемым. В транскрипциях часто могут быть пропуски из-за тихого голоса или некачественной записи, твоя задача - восстановить текст на русском языке. Не изобретай новое содержание, работай только с тем, что есть в тексте."
          },
          {
            role: "user",
            content: `Вот сырая транскрипция аудиозаписи, пожалуйста, очисти её от ошибок и улучши текст: "${transcription}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });
      
      const improvedText = enhancedTranscription.choices[0].message.content || transcription;
      log(`Улучшенная транскрипция: ${improvedText}`, 'openai');
      
      // Теперь определяем говорящих
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Ты эксперт по анализу аудиотранскрипций. Твоя задача - тщательно определить разных говорящих в тексте, разметить каждую фразу и отформатировать диалог. Каждую реплику помечай, например 'Человек 1:', 'Человек 2:' или 'Женщина:', 'Мужчина:' и т.д. Анализируй внимательно контекст, чтобы понять, кто и когда говорит. Никогда не выдумывай новый текст или контент, работай только с предоставленным текстом."
          },
          {
            role: "user",
            content: `Определи разных говорящих в этой транскрипции и отформатируй текст как полноценный диалог, указывая, кто говорит каждую фразу: "${improvedText}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
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