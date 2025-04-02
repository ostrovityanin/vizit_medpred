/**
 * Клиентская библиотека для взаимодействия с GPT-4o Audio Preview микросервисом
 * 
 * Эту библиотеку можно использовать в основном приложении для отправки
 * запросов на транскрипцию аудио в микросервис GPT-4o Audio Preview.
 */

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

class GPT4oAudioClient {
  /**
   * Создает экземпляр клиента GPT-4o Audio Preview
   * @param {Object} options Параметры подключения
   * @param {string} options.baseUrl Базовый URL микросервиса
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3003';
    this.axios = axios.create({
      baseURL: this.baseUrl,
      timeout: 300000, // 5 минут таймаут для длительных транскрипций
    });
  }

  /**
   * Проверяет статус микросервиса
   * @returns {Promise<Object>} Статус сервиса
   */
  async checkHealth() {
    try {
      const response = await this.axios.get('/health');
      return response.data;
    } catch (error) {
      throw new Error(`Ошибка при проверке статуса: ${error.message}`);
    }
  }

  /**
   * Транскрибирует аудиофайл с помощью GPT-4o Audio Preview
   * @param {string|Buffer|Stream} audioFile Путь к файлу, Buffer или Stream
   * @param {Object} options Дополнительные опции
   * @param {string} options.prompt Промпт для GPT-4o
   * @returns {Promise<Object>} Результат транскрипции
   */
  async transcribeAudio(audioFile, options = {}) {
    const formData = new FormData();
    
    // Добавляем аудиофайл в форму
    if (typeof audioFile === 'string') {
      // Если передан путь к файлу
      formData.append('audio', fs.createReadStream(audioFile));
    } else if (Buffer.isBuffer(audioFile)) {
      // Если передан буфер
      const tempFile = path.join(process.cwd(), `temp-${Date.now()}.mp3`);
      fs.writeFileSync(tempFile, audioFile);
      formData.append('audio', fs.createReadStream(tempFile));
      
      // Регистрируем функцию очистки временного файла
      this._cleanupTempFile(tempFile);
    } else {
      // Предполагаем, что это stream
      formData.append('audio', audioFile);
    }
    
    // Добавляем промпт, если указан
    if (options.prompt) {
      formData.append('prompt', options.prompt);
    }
    
    try {
      const response = await this.axios.post('/transcribe', formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });
      
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Ошибка при транскрипции: ${error.response.data.error || error.message}`);
      } else {
        throw new Error(`Ошибка соединения: ${error.message}`);
      }
    }
  }

  /**
   * Получает список доступных моделей
   * @returns {Promise<Array>} Список моделей
   */
  async getModels() {
    try {
      const response = await this.axios.get('/models');
      return response.data.models;
    } catch (error) {
      throw new Error(`Ошибка при получении моделей: ${error.message}`);
    }
  }

  /**
   * Регистрирует функцию очистки временного файла
   * @private
   * @param {string} filePath Путь к временному файлу
   */
  _cleanupTempFile(filePath) {
    setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error(`Ошибка при удалении временного файла: ${error.message}`);
      }
    }, 5000); // Удалить через 5 секунд после запроса
  }
}

module.exports = GPT4oAudioClient;