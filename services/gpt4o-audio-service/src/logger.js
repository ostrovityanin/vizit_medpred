/**
 * Модуль логирования для GPT-4o Audio Preview микросервиса
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Создаем директорию для логов, если она не существует
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Конфигурация логгера
const loggerConfig = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
  },
};

// Форматирование логов
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  })
);

// Создаем логгер
const log = winston.createLogger({
  levels: loggerConfig.levels,
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Выводим логи в консоль
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        logFormat
      ),
    }),
    // Сохраняем логи в файл
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
    }),
  ],
});

// Добавляем цвета
winston.addColors(loggerConfig.colors);

// Пример использования:
// log.debug('Отладочное сообщение');
// log.info('Информационное сообщение');
// log.warn('Предупреждение');
// log.error('Ошибка');

module.exports = { log };