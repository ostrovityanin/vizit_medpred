/**
 * Модуль для логирования событий в сервисе GPT-4o Audio
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем текущую директорию (для ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к директории логов
const logsDir = path.join(__dirname, '../logs');

// Настройка формата логов
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${
      Object.keys(meta).length ? JSON.stringify(meta) : ''
    }`;
  })
);

// Создаем логгер
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Запись логов в файл
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log') 
    }),
    // Вывод логов в консоль
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ]
});

// Расширенные функции для логирования с контекстом
export const logRequest = (req, message) => {
  const { method, url, ip, body, query, params } = req;
  logger.info(`${message}`, {
    method,
    url,
    ip,
    body: body ? JSON.stringify(body).substring(0, 500) : undefined,
    query,
    params
  });
};

export const logResponse = (req, res, message) => {
  const { method, url, ip } = req;
  const { statusCode } = res;
  logger.info(`${message}`, {
    method,
    url,
    ip,
    statusCode
  });
};

export const logError = (err, req, message) => {
  const { method, url, ip } = req;
  logger.error(`${message}`, {
    method,
    url,
    ip,
    error: err.message,
    stack: err.stack
  });
};

export const logInfo = (message, meta = {}) => {
  logger.info(message, meta);
};

export const logWarning = (message, meta = {}) => {
  logger.warn(message, meta);
};

export const logDebug = (message, meta = {}) => {
  logger.debug(message, meta);
};

export default logger;