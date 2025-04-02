/**
 * Клиентская библиотека для интеграции с сервисом GPT-4o Audio
 * 
 * Предоставляет функции для взаимодействия с сервисом транскрипции
 * из основного приложения.
 */

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { logInfo, logError, logDebug } from './logger.js';

/**
 * Настройки для подключения к сервису GPT-4o Audio
 */
const config = {
  serviceUrl: process.env.GPT4O_SERVICE_URL || 'http://localhost:3100',
  serviceToken: process.env.GPT4O_SERVICE_TOKEN,
  defaultTimeout: 600000 // 10 минут
};

/**
 * Отправляет аудиофайл на транскрипцию
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Дополнительные опции
 * @returns {Promise<Object>} Результат транскрипции
 */
export async function transcribeAudio(audioFilePath, options = {}) {
  try {
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Файл не найден: ${audioFilePath}`);
    }
    
    logInfo(`Отправка файла на транскрипцию: ${audioFilePath}`);
    
    const formData = new FormData();
    formData.append('audioFile', fs.createReadStream(audioFilePath));
    
    // Добавляем дополнительные параметры
    if (options.optimize !== undefined) {
      formData.append('optimize', options.optimize.toString());
    }
    
    if (options.format !== undefined) {
      formData.append('format', options.format);
    }
    
    const startTime = Date.now();
    
    // Отправляем запрос на сервис
    const response = await fetch(`${config.serviceUrl}/api/transcribe`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': config.serviceToken ? `Bearer ${config.serviceToken}` : undefined,
        ...formData.getHeaders()
      },
      timeout: options.timeout || config.defaultTimeout
    });
    
    const responseTime = Date.now() - startTime;
    logDebug(`Получен ответ от сервиса за ${responseTime}ms`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка сервиса GPT-4o Audio (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    logInfo(`Транскрипция завершена успешно. Использовано ${result.tokensProcessed || 0} токенов.`);
    
    return result;
  } catch (error) {
    logError(error, 'Ошибка при отправке аудио на транскрипцию');
    throw error;
  }
}

/**
 * Оптимизирует аудиофайл для лучшего распознавания
 * @param {string} inputPath Путь к входному файлу
 * @param {string} outputPath Путь для сохранения оптимизированного файла
 * @returns {Promise<Object>} Результат оптимизации
 */
export async function optimizeAudio(inputPath, outputPath) {
  try {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Файл не найден: ${inputPath}`);
    }
    
    logInfo(`Отправка файла на оптимизацию: ${inputPath}`);
    
    const formData = new FormData();
    formData.append('audioFile', fs.createReadStream(inputPath));
    
    if (outputPath) {
      formData.append('outputPath', outputPath);
    }
    
    // Отправляем запрос на сервис
    const response = await fetch(`${config.serviceUrl}/api/optimize`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': config.serviceToken ? `Bearer ${config.serviceToken}` : undefined,
        ...formData.getHeaders()
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка сервиса GPT-4o Audio (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    logInfo(`Оптимизация завершена успешно: ${result.outputPath}`);
    
    return result;
  } catch (error) {
    logError(error, 'Ошибка при оптимизации аудио');
    throw error;
  }
}

/**
 * Проверяет доступность сервиса GPT-4o Audio
 * @returns {Promise<boolean>} Результат проверки
 */
export async function checkServiceAvailability() {
  try {
    const response = await fetch(`${config.serviceUrl}/health`, {
      method: 'GET',
      headers: {
        'Authorization': config.serviceToken ? `Bearer ${config.serviceToken}` : undefined
      },
      timeout: 5000 // 5 секунд
    });
    
    if (!response.ok) {
      logWarning(`Сервис GPT-4o Audio недоступен. Статус: ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    logInfo(`Сервис GPT-4o Audio доступен. Версия: ${data.version}`);
    
    return true;
  } catch (error) {
    logError(error, 'Ошибка при проверке доступности сервиса GPT-4o Audio');
    return false;
  }
}

/**
 * Получает информацию о версии и состоянии сервиса
 * @returns {Promise<Object>} Информация о сервисе
 */
export async function getServiceInfo() {
  try {
    const response = await fetch(`${config.serviceUrl}/api/info`, {
      method: 'GET',
      headers: {
        'Authorization': config.serviceToken ? `Bearer ${config.serviceToken}` : undefined
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка сервиса GPT-4o Audio (${response.status}): ${errorText}`);
    }
    
    const info = await response.json();
    return info;
  } catch (error) {
    logError(error, 'Ошибка при получении информации о сервисе');
    throw error;
  }
}