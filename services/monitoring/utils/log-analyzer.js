/**
 * Модуль для анализа логов и выявления проблем
 */
const fs = require('fs-extra');
const path = require('path');
const { logger } = require('./logger');
require('dotenv').config();

// Путь к директории с логами
const logPath = process.env.LOG_PATH || './logs';

// Ключевые слова для поиска ошибок
const ERROR_KEYWORDS = [
  'error', 'exception', 'fail', 'failed', 'failure', 'критическ', 'ошибк', 'сбой', 'не удалось',
  'TypeError', 'SyntaxError', 'ReferenceError', 'RangeError', 'EvalError', 'URIError'
];

// Ключевые слова для поиска предупреждений
const WARNING_KEYWORDS = [
  'warning', 'warn', 'предупрежд', 'внимани'
];

/**
 * Чтение лог-файла с определенным смещением
 * @param {string} filePath - Путь к файлу
 * @param {number} offset - Смещение в байтах от конца файла
 * @returns {string[]} - Массив строк из файла
 */
function readLogFile(filePath, offset = 50000) {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    // Если файл меньше смещения, читаем весь файл
    const position = fileSize <= offset ? 0 : fileSize - offset;
    const length = fileSize - position;
    
    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, length, position);
    fs.closeSync(fd);
    
    // Преобразуем буфер в строки
    const content = buffer.toString('utf8');
    const lines = content.split('\n').filter(Boolean);
    
    return lines;
  } catch (error) {
    logger.error(`Ошибка чтения лог-файла ${filePath}: ${error.message}`);
    return [];
  }
}

/**
 * Проверка наличия ключевых слов в строке
 * @param {string} line - Строка для проверки
 * @param {string[]} keywords - Массив ключевых слов
 * @returns {boolean} - Результат проверки
 */
function containsKeywords(line, keywords) {
  const lowercaseLine = line.toLowerCase();
  return keywords.some(keyword => lowercaseLine.includes(keyword.toLowerCase()));
}

/**
 * Анализ лог-файла на наличие ошибок и предупреждений
 * @param {string} filePath - Путь к файлу
 * @returns {Object} - Результат анализа
 */
function analyzeLogFile(filePath) {
  const lines = readLogFile(filePath);
  const errorLines = [];
  const warningLines = [];
  
  for (const line of lines) {
    if (containsKeywords(line, ERROR_KEYWORDS)) {
      errorLines.push(line);
    } else if (containsKeywords(line, WARNING_KEYWORDS)) {
      warningLines.push(line);
    }
  }
  
  return {
    filePath,
    errorCount: errorLines.length,
    warningCount: warningLines.length,
    errors: errorLines.slice(-10), // Только последние 10 ошибок
    warnings: warningLines.slice(-5) // Только последние 5 предупреждений
  };
}

/**
 * Анализ всех лог-файлов в директории
 * @returns {Object[]} - Результаты анализа
 */
function analyzeAllLogs() {
  try {
    const logFiles = fs.readdirSync(logPath)
      .filter(file => file.endsWith('.log'))
      .map(file => path.join(logPath, file));
    
    const results = [];
    
    for (const file of logFiles) {
      const result = analyzeLogFile(file);
      results.push(result);
    }
    
    return results;
  } catch (error) {
    logger.error(`Ошибка анализа логов: ${error.message}`);
    return [];
  }
}

/**
 * Получение сводки по всем логам
 * @returns {Object} - Сводная информация
 */
function getLogsSummary() {
  const results = analyzeAllLogs();
  
  const totalErrors = results.reduce((sum, result) => sum + result.errorCount, 0);
  const totalWarnings = results.reduce((sum, result) => sum + result.warningCount, 0);
  
  // Собираем последние ошибки из всех файлов
  const latestErrors = [];
  for (const result of results) {
    for (const error of result.errors) {
      latestErrors.push({
        file: path.basename(result.filePath),
        message: error
      });
    }
  }
  
  // Сортируем ошибки по времени (если в логах есть временные метки)
  latestErrors.sort((a, b) => {
    const timeA = a.message.match(/\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}/);
    const timeB = b.message.match(/\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}/);
    
    if (timeA && timeB) {
      return timeB[0].localeCompare(timeA[0]);
    }
    return 0;
  });
  
  return {
    totalFiles: results.length,
    totalErrors,
    totalWarnings,
    latestErrors: latestErrors.slice(0, 10) // Только 10 самых последних ошибок
  };
}

module.exports = {
  getLogsSummary,
  analyzeLogFile,
  analyzeAllLogs
};