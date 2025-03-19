import OpenAI from 'openai';
import fs from 'fs';
import { log } from './vite';

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
    
    log(`Отправляем аудиофайл на распознавание: ${filePath}`, 'openai');
    
    // Шаг 1: Базовое распознавание с помощью Whisper
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "ru",
      temperature: 0.0,
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