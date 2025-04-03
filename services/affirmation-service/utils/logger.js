/**
 * Модуль логирования для микросервиса аффирмаций
 */

const fs = require('fs');
const path = require('path');
const winston = require('winston');

// Создаем директорию логов, если она не существует
const LOG_DIR = path.join(__dirname, '../logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Настраиваем формат вывода логов
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(info => {
    return `${info.timestamp} ${info.level.toUpperCase()}: ${info.message}`;
  })
);

// Создаем логгер
const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'affirmation-service' },
  transports: [
    // Вывод в файл всех логов
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'affirmation-service.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Вывод ошибок в отдельный файл
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'affirmation-service-error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Вывод в консоль
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ]
});

// Также записываем логи консоли в файл
logger.stream = {
  write: function(message) {
    logger.info(message.trim());
  }
};

// Логирование неперехваченных исключений
process.on('uncaughtException', (err) => {
  logger.error(`Непойманное исключение: ${err.message}`, { stack: err.stack });
  process.exit(1);
});

// Логирование необработанных отклонений промисов
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Необработанное отклонение промиса: ${reason}`, { stack: reason.stack });
});

module.exports = { logger };