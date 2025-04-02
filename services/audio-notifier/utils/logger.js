/**
 * Настройка логирования для микросервиса audio-notifier
 */

const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;

// Создаем директорию для логов, если она не существует
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Форматирование логов
const customFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

// Создаем логгер
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    customFormat
  ),
  transports: [
    // Запись логов в консоль
    new transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
      )
    }),
    // Запись всех логов в файл
    new transports.File({
      filename: path.join(logDir, 'audio-notifier.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Запись только ошибок в отдельный файл
    new transports.File({
      level: 'error',
      filename: path.join(logDir, 'audio-notifier-error.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

module.exports = { logger };