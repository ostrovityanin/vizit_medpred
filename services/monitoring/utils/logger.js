/**
 * Модуль для логирования сервиса мониторинга
 */
const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

// Создаем директорию для логов
const logPath = process.env.LOG_PATH || './logs';
fs.ensureDirSync(logPath);

// Форматирование логов
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, service }) => {
    return `[${timestamp}] [${service || 'monitoring'}] [${level.toUpperCase()}]: ${message}`;
  })
);

// Создаем логгер
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'monitoring' },
  transports: [
    // Консольный вывод
    new winston.transports.Console(),
    // Лог файл
    new winston.transports.File({ 
      filename: path.join(logPath, 'monitoring.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Файл ошибок
    new winston.transports.File({ 
      filename: path.join(logPath, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5 
    })
  ]
});

// Создаем именованный логгер для каждого сервиса
const getServiceLogger = (serviceName) => {
  return {
    info: (message) => logger.info(message, { service: serviceName }),
    warn: (message) => logger.warn(message, { service: serviceName }),
    error: (message) => logger.error(message, { service: serviceName }),
    debug: (message) => logger.debug(message, { service: serviceName })
  };
};

module.exports = {
  logger,
  getServiceLogger
};