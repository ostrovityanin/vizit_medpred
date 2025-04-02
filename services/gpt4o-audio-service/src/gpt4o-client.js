const fs = require('fs');
const OpenAI = require('openai');
const config = require('./config');
const logger = require('./logger');

// Инициализация клиента OpenAI
const openai = new OpenAI({
  apiKey: config.openaiApiKey
});

/**
 * Проверяет наличие ключа API OpenAI
 * @returns {boolean} True, если ключ API настроен
 */
function isOpenAIConfigured() {
  if (!config.openaiApiKey) {
    logger.error('OPENAI_API_KEY не настроен. Пожалуйста, установите ключ API в переменных окружения.');
    return false;
  }
  return true;
}

/**
 * Распознает аудиофайл с помощью GPT-4o Audio Preview
 * @param {string} filePath Путь к аудиофайлу
 * @param {string} [prompt] Промпт для обработки аудио (опционально)
 * @returns {Promise<Object>} Результат распознавания
 */
async function transcribeWithGPT4o(filePath, prompt = config.gpt4o.defaultPrompt) {
  if (!isOpenAIConfigured()) {
    throw new Error('OpenAI API не настроен');
  }

  try {
    logger.info(`Начало транскрипции аудиофайла: ${filePath}`);
    
    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      throw new Error(`Файл не существует: ${filePath}`);
    }
    
    // Проверяем размер файла
    const fileStats = fs.statSync(filePath);
    if (fileStats.size > config.gpt4o.maxAudioSizeBytes) {
      throw new Error(`Размер файла (${fileStats.size} байт) превышает лимит (${config.gpt4o.maxAudioSizeBytes} байт)`);
    }
    
    logger.info(`Подготовка аудиофайла (${fileStats.size} байт) для отправки в GPT-4o Audio Preview`);
    
    // Открываем файл как ReadStream
    const audioFileStream = fs.createReadStream(filePath);
    
    // Создаем сообщения для отправки в GPT-4o Audio Preview
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "audio",
            audio: audioFileStream
          }
        ]
      }
    ];
    
    logger.info('Отправка запроса к GPT-4o Audio Preview API');
    
    // Отправляем запрос к GPT-4o Audio Preview
    const response = await openai.chat.completions.create({
      model: config.gpt4o.audioModel,
      messages,
      max_tokens: 4096
    });
    
    // Получаем текст из ответа
    const transcription = response.choices[0].message.content;
    
    // Подсчитываем использование токенов
    const inputTokens = response.usage.prompt_tokens;
    const outputTokens = response.usage.completion_tokens;
    const totalTokens = response.usage.total_tokens;
    
    // Рассчитываем примерную стоимость (обновлять при изменении цены API)
    const inputCost = (inputTokens / 1000000) * 15; // $15 за 1M токенов ввода
    const outputCost = (outputTokens / 1000000) * 75; // $75 за 1M токенов вывода
    const totalCost = inputCost + outputCost;
    
    logger.info(`Транскрипция завершена. Токены: ${totalTokens}, Стоимость: $${totalCost.toFixed(6)}`);
    
    return {
      text: transcription,
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens
      },
      cost: {
        input: inputCost,
        output: outputCost,
        total: totalCost
      }
    };
    
  } catch (error) {
    logger.error(`Ошибка при транскрипции аудио: ${error.message}`);
    if (error.response) {
      logger.error(`Детали ошибки API: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Получает информацию о моделях доступных в OpenAI API
 * @returns {Promise<Array>} Список моделей
 */
async function getAvailableModels() {
  if (!isOpenAIConfigured()) {
    throw new Error('OpenAI API не настроен');
  }

  try {
    logger.info('Запрос списка доступных моделей OpenAI');
    const response = await openai.models.list();
    return response.data;
  } catch (error) {
    logger.error(`Ошибка при получении списка моделей: ${error.message}`);
    throw error;
  }
}

module.exports = {
  transcribeWithGPT4o,
  getAvailableModels,
  isOpenAIConfigured
};