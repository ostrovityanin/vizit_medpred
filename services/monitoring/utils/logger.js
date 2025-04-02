/**
 * Модуль логирования для сервиса мониторинга
 */
const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

// Путь к директории логов из .env или по умолчанию
const LOG_PATH = process.env.LOG_PATH || './logs';

// Создаем директорию для логов, если она не существует
fs.ensureDirSync(LOG_PATH);

// Форматирование сообщений для консоли
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, service }) => {
    return `${timestamp} [${service || 'monitor'}] ${level}: ${message}`;
  })
);

// Форматирование сообщений для файла
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

// Создание основного логгера
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: { service: 'monitor' },
  transports: [
    // Логирование в консоль всех уровней
    new winston.transports.Console({
      format: consoleFormat
    }),
    // Логирование в файл только ошибок
    new winston.transports.File({
      filename: path.join(LOG_PATH, 'error.log'),
      level: 'error',
      format: fileFormat
    }),
    // Логирование в общий файл всех сообщений
    new winston.transports.File({
      filename: path.join(LOG_PATH, 'combined.log'),
      format: fileFormat
    })
  ]
});

/**
 * Создаёт именованный логгер для конкретного модуля
 * @param {string} serviceName Имя сервиса/модуля для логирования
 * @returns {object} Объект логгера
 */
function createLogger(serviceName) {
  return {
    debug: (message) => logger.debug(message, { service: serviceName }),
    info: (message) => logger.info(message, { service: serviceName }),
    warn: (message) => logger.warn(message, { service: serviceName }),
    error: (message) => logger.error(message, { service: serviceName })
  };
}

/**
 * Возвращает последние N строк логов
 * @param {string} logType Тип лога ('error', 'combined')
 * @param {number} lines Количество строк
 * @returns {Promise<Array>} Массив строк логов
 */
async function getRecentLogs(logType = 'combined', lines = 100) {
  try {
    const logFile = path.join(LOG_PATH, `${logType}.log`);
    
    // Проверяем существование файла
    if (!await fs.pathExists(logFile)) {
      return [];
    }
    
    // Читаем последние строки файла
    const data = await fs.readFile(logFile, 'utf8');
    const logLines = data.split('\n').filter(line => line.trim() !== '');
    
    // Возвращаем последние N строк
    return logLines.slice(-lines).map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return line;
      }
    });
  } catch (error) {
    console.error(`Ошибка при чтении логов: ${error.message}`);
    return [];
  }
}

/**
 * Анализ логов на наличие ошибок за последние N минут
 * @param {number} minutes Количество минут
 * @returns {Promise<Object>} Результат анализа логов
 */
async function analyzeRecentLogs(minutes = 5) {
  try {
    const logFile = path.join(LOG_PATH, 'combined.log');
    
    // Проверяем существование файла
    if (!await fs.pathExists(logFile)) {
      return { 
        errorCount: 0, 
        warningCount: 0,
        recentErrors: [],
        summary: 'Нет данных для анализа'
      };
    }
    
    // Читаем весь файл
    const data = await fs.readFile(logFile, 'utf8');
    const logLines = data.split('\n').filter(line => line.trim() !== '');
    
    // Временная метка N минут назад
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);
    
    // Анализируем логи
    let errorCount = 0;
    let warningCount = 0;
    const recentErrors = [];
    const serviceErrors = {};
    
    logLines.forEach(line => {
      try {
        const logEntry = JSON.parse(line);
        const logTime = new Date(logEntry.timestamp);
        
        // Проверяем только логи за последние N минут
        if (logTime >= cutoffTime) {
          if (logEntry.level === 'error') {
            errorCount++;
            recentErrors.push(logEntry);
            
            // Группируем ошибки по сервисам
            const service = logEntry.service || 'unknown';
            if (!serviceErrors[service]) {
              serviceErrors[service] = 0;
            }
            serviceErrors[service]++;
          } else if (logEntry.level === 'warn') {
            warningCount++;
          }
        }
      } catch (e) {
        // Игнорируем невалидные JSON
      }
    });
    
    // Формируем отчет
    let summary = '';
    if (errorCount > 0) {
      summary = `За последние ${minutes} минут обнаружено ${errorCount} ошибок и ${warningCount} предупреждений.\n`;
      summary += 'Ошибки по сервисам:\n';
      
      for (const [service, count] of Object.entries(serviceErrors)) {
        summary += `- ${service}: ${count} ошибок\n`;
      }
    } else if (warningCount > 0) {
      summary = `За последние ${minutes} минут обнаружено ${warningCount} предупреждений.`;
    } else {
      summary = `За последние ${minutes} минут ошибок и предупреждений не обнаружено.`;
    }
    
    return {
      errorCount,
      warningCount,
      recentErrors: recentErrors.slice(-10),  // Только последние 10 ошибок
      serviceErrors,
      summary
    };
  } catch (error) {
    console.error(`Ошибка при анализе логов: ${error.message}`);
    return { 
      errorCount: 0, 
      warningCount: 0,
      recentErrors: [],
      summary: 'Ошибка анализа логов: ' + error.message
    };
  }
}

// Экспортируем обычный логгер и функции создания логгеров
module.exports = {
  ...logger,
  createLogger,
  getRecentLogs,
  analyzeRecentLogs
};