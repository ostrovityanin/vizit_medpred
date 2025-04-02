/**
 * Модуль логирования для сервиса GPT-4o Audio
 */

import winston from 'winston';
import dotenv from 'dotenv';

// Загрузка переменных окружения
dotenv.config();

// Определение уровней логирования
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Функция для определения уровня логирования на основе переменной окружения
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : process.env.LOG_LEVEL || 'info';
};

// Настройка форматирования логов
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`
  )
);

// Настройка транспортов для логирования
const transports = [
  // Вывод в консоль
  new winston.transports.Console(),
  // Сохранение сообщений об ошибках в файл
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  // Сохранение всех логов в файл
  new winston.transports.File({ filename: 'logs/combined.log' }),
];

// Создание и экспорт логгера
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

export default logger;