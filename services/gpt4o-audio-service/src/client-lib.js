/**
 * Клиентская библиотека для работы с GPT-4o Audio Preview микросервисом
 * 
 * Позволяет легко интегрировать транскрипцию аудио с GPT-4o
 * в основное приложение без изменения его кода.
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

/**
 * Клиент для работы с GPT-4o Audio Preview микросервисом
 */
class GPT4oAudioClient {
  /**
   * Создает новый экземпляр клиента
   * @param {Object} options Опции подключения
   * @param {string} options.baseUrl URL микросервиса
   * @param {number} options.timeout Таймаут запросов в миллисекундах
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3400';
    this.timeout = options.timeout || 120000; // 2 минуты по умолчанию
  }

  /**
   * Проверяет работоспособность микросервиса
   * @returns {Promise<boolean>} Доступен ли сервис
   */
  async isServiceAvailable() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        return data.status === 'ok' && data.apiKeyConfigured;
      }
      
      return false;
    } catch (error) {
      console.warn(`GPT-4o Audio сервис недоступен: ${error.message}`);
      return false;
    }
  }

  /**
   * Транскрибирует аудиофайл, загружая его в микросервис
   * @param {string} filePath Путь к аудиофайлу
   * @returns {Promise<{text: string, cost: string, tokensProcessed: number}>} Результат транскрипции
   */
  async transcribeAudio(filePath) {
    try {
      // Проверяем, существует ли файл
      if (!fs.existsSync(filePath)) {
        throw new Error(`Файл не найден: ${filePath}`);
      }

      // Проверяем доступность сервиса
      const isAvailable = await this.isServiceAvailable();
      if (!isAvailable) {
        throw new Error('GPT-4o Audio микросервис недоступен');
      }

      // Проверяем размер файла
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        throw new Error(`Файл имеет нулевой размер: ${filePath}`);
      }

      console.log(`Отправляем файл на транскрибирование: ${filePath} (${(stats.size / (1024 * 1024)).toFixed(2)} МБ)`);

      // Создаем multipart/form-data
      const form = new FormData();
      form.append('audio', fs.createReadStream(filePath));

      // Отправляем запрос
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/transcribe`, {
        method: 'POST',
        body: form,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          errorText = errorJson.message || errorText;
        } catch (e) {
          // Если не удалось разобрать JSON, используем как есть
        }
        throw new Error(`Ошибка при транскрибировании: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Парсим ответ
      const result = await response.json();
      
      if (!result.success || !result.text) {
        throw new Error('Неожиданный формат ответа от сервиса');
      }

      console.log(`Транскрибирование успешно завершено. Длина текста: ${result.text.length} символов`);

      return {
        text: result.text,
        cost: result.metadata?.cost || '0.0000',
        tokensProcessed: result.metadata?.tokensProcessed || 0
      };
    } catch (error) {
      console.error(`Ошибка при вызове GPT-4o Audio микросервиса: ${error.message}`);
      throw error;
    }
  }

  /**
   * Транскрибирует аудиофайл, отправляя путь к нему в микросервис
   * Этот метод работает только если микросервис имеет доступ к файловой системе
   * @param {string} filePath Путь к аудиофайлу
   * @returns {Promise<{text: string, cost: string, tokensProcessed: number}>} Результат транскрипции
   */
  async transcribeAudioByPath(filePath) {
    try {
      // Проверяем, существует ли файл
      if (!fs.existsSync(filePath)) {
        throw new Error(`Файл не найден: ${filePath}`);
      }

      // Проверяем доступность сервиса
      const isAvailable = await this.isServiceAvailable();
      if (!isAvailable) {
        throw new Error('GPT-4o Audio микросервис недоступен');
      }

      console.log(`Отправляем путь к файлу на транскрибирование: ${filePath}`);

      // Отправляем запрос
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/transcribe/path`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filePath }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          errorText = errorJson.message || errorText;
        } catch (e) {
          // Если не удалось разобрать JSON, используем как есть
        }
        throw new Error(`Ошибка при транскрибировании: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Парсим ответ
      const result = await response.json();
      
      if (!result.success || !result.text) {
        throw new Error('Неожиданный формат ответа от сервиса');
      }

      console.log(`Транскрибирование успешно завершено. Длина текста: ${result.text.length} символов`);

      return {
        text: result.text,
        cost: result.metadata?.cost || '0.0000',
        tokensProcessed: result.metadata?.tokensProcessed || 0
      };
    } catch (error) {
      console.error(`Ошибка при вызове GPT-4o Audio микросервиса: ${error.message}`);
      throw error;
    }
  }
}

// Создаем и экспортируем экземпляр клиента
const client = new GPT4oAudioClient();

// Экспортируем метод транскрипции напрямую для удобства использования
const transcribeAudio = async (filePath) => {
  return client.transcribeAudio(filePath);
};

// Экспортируем метод транскрипции по пути напрямую
const transcribeAudioByPath = async (filePath) => {
  return client.transcribeAudioByPath(filePath);
};

module.exports = {
  GPT4oAudioClient,
  client,
  transcribeAudio,
  transcribeAudioByPath
};