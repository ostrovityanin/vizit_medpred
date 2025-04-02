import winston from 'winston';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем директорию для логов, если не существует
const logDirectory = process.env.LOG_PATH || path.join(__dirname, '..', 'logs');
fs.ensureDirSync(logDirectory);

// Настройка форматирования для логов
const { combine, timestamp, printf, colorize, label } = winston.format;

const logFormat = printf(({ level, message, timestamp, label }) => {
  return label 
    ? `${timestamp} [${level}] [${label}]: ${message}`
    : `${timestamp} [${level}]: ${message}`;
});

// Создаем экземпляр логгера
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // Логи в консоль
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      )
    }),
    // Логи ошибок в файл
    new winston.transports.File({
      filename: path.join(logDirectory, 'error.log'),
      level: 'error'
    }),
    // Все логи в общий файл
    new winston.transports.File({
      filename: path.join(logDirectory, 'combined.log')
    })
  ],
  // Не прекращать процесс при необработанной ошибке
  exitOnError: false
});

// Добавляем метод для логирования в файл и отправки в телеграм
logger.infoWithTelegram = (message) => {
  logger.info(message);
  // Сохраняем сообщение для последующей отправки в Telegram
  // Это будет реализовано в модуле telegram.js
};

/**
 * Создает именованный логгер с указанной меткой
 * @param {string} moduleName - Имя модуля для метки логгера
 * @returns {object} - Экземпляр логгера с указанной меткой
 */
export const createLogger = (moduleName) => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
      label({ label: moduleName }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      logFormat
    ),
    transports: [
      // Логи в консоль
      new winston.transports.Console({
        format: combine(
          colorize(),
          label({ label: moduleName }),
          timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          logFormat
        )
      }),
      // Логи ошибок в файл
      new winston.transports.File({
        filename: path.join(logDirectory, 'error.log'),
        level: 'error'
      }),
      // Все логи в общий файл
      new winston.transports.File({
        filename: path.join(logDirectory, 'combined.log')
      })
    ],
    // Не прекращать процесс при необработанной ошибке
    exitOnError: false
  });
};

export default logger;