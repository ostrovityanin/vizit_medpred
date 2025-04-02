/**
 * Клиент для работы с GPT-4o Audio Preview через OpenAI API
 * Обеспечивает транскрипцию аудиофайлов с использованием GPT-4o
 */

const fs = require('fs');
const path = require('path');
const { log } = require('./logger');
const { optimizeAudioForTranscription } = require('./audio-processor');

// Импортируем OpenAI SDK
let OpenAI;
try {
  OpenAI = require('openai');
} catch (error) {
  log.error(`Ошибка при импорте OpenAI SDK: ${error.message}`);
  throw new Error('Не удалось загрузить OpenAI SDK. Установите пакет с помощью npm install openai');
}

class GPT4oClient {
  constructor(apiKey = process.env.OPENAI_API_KEY) {
    if (!apiKey) {
      throw new Error('Не указан API ключ для OpenAI');
    }

    this.apiKey = apiKey;
    this.openai = new OpenAI({
      apiKey: this.apiKey
    });

    // Конфигурация моделей
    this.config = {
      model: process.env.TRANSCRIPTION_MODEL || 'gpt-4o',
      language: process.env.TRANSCRIPTION_LANGUAGE || 'ru',
      temperature: parseFloat(process.env.TRANSCRIPTION_TEMPERATURE || '0.2')
    };

    log.info('GPT-4o клиент инициализирован');
    log.debug(`Модель: ${this.config.model}, Язык: ${this.config.language}, Температура: ${this.config.temperature}`);
  }

  /**
   * Выполняет транскрипцию аудиофайла с использованием GPT-4o Audio
   * @param {string} filePath Путь к аудиофайлу
   * @returns {Promise<{text: string, cost: string, tokensProcessed: number}>} Результат транскрипции
   */
  async transcribeAudio(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Файл не найден: ${filePath}`);
      }

      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        throw new Error(`Файл имеет нулевой размер: ${filePath}`);
      }

      const fileSizeMB = stats.size / (1024 * 1024);
      log.info(`Начинаем транскрибирование файла: ${filePath} (${fileSizeMB.toFixed(2)} МБ)`);

      // Оптимизируем аудиофайл, если возможно
      let fileToProcess = filePath;
      if (fileSizeMB > 10) {
        try {
          fileToProcess = await optimizeAudioForTranscription(filePath);
          log.info(`Файл оптимизирован: ${fileToProcess}`);
        } catch (optimizeError) {
          log.warn(`Ошибка при оптимизации файла: ${optimizeError.message}`);
          log.info('Продолжаем с исходным файлом');
          fileToProcess = filePath;
        }
      }

      // Для GPT-4o Audio мы используем двухшаговый подход:
      // 1. Транскрибируем с помощью Whisper API
      // 2. Форматируем с помощью GPT-4o

      const startTime = Date.now();

      // 1. Сначала используем Whisper API для базовой транскрипции
      log.info('Шаг 1: Базовая транскрипция с помощью Whisper API');
      const transcriptionResponse = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(fileToProcess),
        model: 'whisper-1',
        language: this.config.language,
        response_format: 'text',
        temperature: this.config.temperature,
      });

      // 2. Используем GPT-4o для форматирования и анализа транскрипции
      log.info('Шаг 2: Форматирование транскрипции с помощью GPT-4o');
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

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Разбей этот транскрибированный текст на диалог с выделением говорящих: ${transcriptionResponse.text}`
          }
        ],
        temperature: 0.1,
      });

      // Получаем результат транскрипции
      const transcribedText = completion.choices[0].message.content || '';

      // Рассчитываем длительность, стоимость и токены
      const fileStats = fs.statSync(fileToProcess);
      const durationSeconds = fileStats.size / 16000; // для WAV ~16 КБ на секунду при 16 кГц, моно
      const tokensProcessed = Math.round(durationSeconds * 50); // примерно 50 токенов на секунду для GPT-4o
      
      // Рассчитываем стоимость
      // GPT-4o audio: $15 за 1M токенов ввода, $75 за 1M токенов вывода
      // Примерно 50 токенов на секунду аудио
      const inputCost = (tokensProcessed / 1000000) * 15;
      // Оценка токенов вывода: примерно 1/5 от токенов ввода
      const outputTokens = Math.round(tokensProcessed * 0.2);
      const outputCost = (outputTokens / 1000000) * 75;
      const totalCost = (inputCost + outputCost).toFixed(4);

      const endTime = Date.now();
      const processingTime = (endTime - startTime) / 1000;
      log.info(`Транскрибирование завершено за ${processingTime.toFixed(2)} секунд`);
      log.debug(`Стоимость: $${totalCost}, Токены: ${tokensProcessed}`);

      return {
        text: transcribedText,
        cost: totalCost,
        tokensProcessed: tokensProcessed
      };
    } catch (error) {
      log.error(`Ошибка при транскрибировании: ${error.message}`);
      throw error;
    }
  }
}

module.exports = GPT4oClient;