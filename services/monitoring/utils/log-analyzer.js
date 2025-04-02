/**
 * Модуль для анализа логов и выявления проблем в работе системы
 */
const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger').createLogger('log-analyzer');

// Загрузка переменных окружения
require('dotenv').config();

// Путь к директории логов
const LOG_PATH = process.env.LOG_PATH || './logs';

// Анализируемые файлы логов
const LOG_FILES = [
  { name: 'combined.log', type: 'combined' },
  { name: 'error.log', type: 'error' }
];

/**
 * Инициализация модуля анализа логов
 */
async function initialize() {
  logger.info('Инициализация модуля анализа логов');
  
  // Проверяем наличие директории с логами
  try {
    await fs.ensureDir(LOG_PATH);
    logger.info('Директория логов проверена');
    
    // Проверяем наличие файлов логов
    for (const file of LOG_FILES) {
      const filePath = path.join(LOG_PATH, file.name);
      if (!(await fs.pathExists(filePath))) {
        await fs.writeFile(filePath, '');
        logger.info(`Создан пустой файл лога: ${file.name}`);
      }
    }
  } catch (error) {
    logger.error(`Ошибка при инициализации модуля анализа логов: ${error.message}`);
  }
}

/**
 * Анализирует логи системы для выявления проблем
 * @param {number} minutes За сколько последних минут анализировать логи
 * @returns {Object} Результаты анализа
 */
async function analyzeSystemLogs(minutes = 5) {
  logger.debug(`Анализ логов системы за последние ${minutes} минут`);
  
  try {
    // Анализируем файл combined.log
    const combinedLogPath = path.join(LOG_PATH, 'combined.log');
    const errorLogPath = path.join(LOG_PATH, 'error.log');
    
    // Проверяем существование файлов
    if (!(await fs.pathExists(combinedLogPath))) {
      logger.warn('Файл combined.log не найден');
      return { 
        errorCount: 0, 
        warningCount: 0,
        serviceErrors: {},
        patterns: [],
        recentErrors: [],
        summary: 'Файл логов не найден'
      };
    }
    
    // Временная метка N минут назад
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);
    
    // Анализируем логи
    let errorCount = 0;
    let warningCount = 0;
    const serviceErrors = {};
    const recentErrors = [];
    const patterns = [];
    
    // Читаем комбинированный лог
    const combinedData = await fs.readFile(combinedLogPath, 'utf8');
    const combinedLines = combinedData.split('\n').filter(line => line.trim() !== '');
    
    // Анализируем каждую строку лога
    for (const line of combinedLines) {
      try {
        const logEntry = JSON.parse(line);
        const logTime = new Date(logEntry.timestamp);
        
        // Анализируем только последние N минут
        if (logTime >= cutoffTime) {
          if (logEntry.level === 'error') {
            errorCount++;
            recentErrors.push(logEntry);
            
            // Группируем ошибки по сервисам
            const serviceName = logEntry.service || 'unknown';
            if (!serviceErrors[serviceName]) {
              serviceErrors[serviceName] = 0;
            }
            serviceErrors[serviceName]++;
            
            // Анализируем сообщение об ошибке для выявления паттернов
            analyzeErrorMessage(logEntry.message, patterns);
          } else if (logEntry.level === 'warn') {
            warningCount++;
          }
        }
      } catch (e) {
        // Игнорируем невалидные JSON
      }
    }
    
    // Анализируем файл ошибок отдельно, если он существует
    if (await fs.pathExists(errorLogPath)) {
      const errorData = await fs.readFile(errorLogPath, 'utf8');
      const errorLines = errorData.split('\n').filter(line => line.trim() !== '');
      
      for (const line of errorLines) {
        try {
          const logEntry = JSON.parse(line);
          const logTime = new Date(logEntry.timestamp);
          
          // Анализируем только последние N минут
          if (logTime >= cutoffTime) {
            // Анализируем сообщение об ошибке для выявления паттернов
            analyzeErrorMessage(logEntry.message, patterns);
          }
        } catch (e) {
          // Игнорируем невалидные JSON
        }
      }
    }
    
    // Группируем похожие паттерны
    const groupedPatterns = groupSimilarPatterns(patterns);
    
    // Формируем итоговый отчет
    let summary = '';
    
    if (errorCount > 0) {
      summary = `За последние ${minutes} минут обнаружено ${errorCount} ошибок и ${warningCount} предупреждений.\n`;
      summary += 'Ошибки по сервисам:\n';
      
      // Добавляем информацию о сервисах с ошибками
      for (const [service, count] of Object.entries(serviceErrors)) {
        summary += `- ${service}: ${count} ошибок\n`;
      }
      
      // Добавляем информацию о выявленных паттернах ошибок
      if (groupedPatterns.length > 0) {
        summary += '\nВыявленные паттерны ошибок:\n';
        groupedPatterns.forEach((pattern, index) => {
          summary += `${index + 1}. ${pattern.message} (встречается ${pattern.count} раз)\n`;
        });
      }
    } else if (warningCount > 0) {
      summary = `За последние ${minutes} минут обнаружено ${warningCount} предупреждений.`;
    } else {
      summary = `За последние ${minutes} минут ошибок и предупреждений не обнаружено.`;
    }
    
    logger.debug(`Анализ логов завершен: ${errorCount} ошибок, ${warningCount} предупреждений`);
    
    return {
      errorCount,
      warningCount,
      serviceErrors,
      patterns: groupedPatterns,
      recentErrors: recentErrors.slice(-10),  // Только последние 10 ошибок
      summary
    };
  } catch (error) {
    logger.error(`Ошибка при анализе логов: ${error.message}`);
    return { 
      errorCount: 0, 
      warningCount: 0,
      serviceErrors: {},
      patterns: [],
      recentErrors: [],
      summary: 'Ошибка анализа логов: ' + error.message
    };
  }
}

/**
 * Анализирует сообщение об ошибке для выявления паттернов
 * @param {string} message Сообщение об ошибке
 * @param {Array} patterns Массив паттернов
 */
function analyzeErrorMessage(message, patterns) {
  if (!message) return;
  
  // Удаление переменных частей сообщения (id, timestamp, etc.)
  const normalized = normalizeErrorMessage(message);
  
  // Ищем похожий паттерн
  const existingPattern = patterns.find(p => p.normalized === normalized);
  
  if (existingPattern) {
    existingPattern.count++;
    existingPattern.examples.push(message);
    
    // Ограничиваем количество примеров
    if (existingPattern.examples.length > 5) {
      existingPattern.examples = existingPattern.examples.slice(-5);
    }
  } else {
    patterns.push({
      normalized,
      message: message.length > 100 ? message.substring(0, 97) + '...' : message,
      count: 1,
      examples: [message]
    });
  }
}

/**
 * Нормализует сообщение об ошибке, удаляя переменные части
 * @param {string} message Сообщение об ошибке
 * @returns {string} Нормализованное сообщение
 */
function normalizeErrorMessage(message) {
  // Заменяем числа на <NUMBER>
  let normalized = message.replace(/\d+/g, '<NUMBER>');
  
  // Заменяем UUID на <UUID>
  normalized = normalized.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>');
  
  // Заменяем пути к файлам на <FILE_PATH>
  normalized = normalized.replace(/\/[\w\/\.-]+/g, '<FILE_PATH>');
  
  // Заменяем URL на <URL>
  normalized = normalized.replace(/https?:\/\/[\w\.-]+/g, '<URL>');
  
  // Заменяем адреса электронной почты на <EMAIL>
  normalized = normalized.replace(/[\w.-]+@[\w.-]+/g, '<EMAIL>');
  
  return normalized;
}

/**
 * Группирует похожие паттерны ошибок
 * @param {Array} patterns Массив паттернов
 * @returns {Array} Сгруппированные паттерны
 */
function groupSimilarPatterns(patterns) {
  // Сортируем по количеству вхождений
  return patterns
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);  // Возвращаем только топ-10 паттернов
}

/**
 * Проверка наличия критических ошибок в логах за последний час
 * @returns {Promise<Object>} Результаты проверки
 */
async function checkCriticalErrors() {
  try {
    const results = await analyzeSystemLogs(60);  // Проверяем за последний час
    
    // Определяем наличие критических ошибок
    const hasCriticalErrors = results.errorCount > 10 || 
      Object.values(results.serviceErrors).some(count => count > 5);
    
    return {
      hasCriticalErrors,
      errorCount: results.errorCount,
      mostProblematicService: getMostProblematicService(results.serviceErrors),
      description: hasCriticalErrors 
        ? 'Обнаружено большое количество ошибок за последний час' 
        : 'Критических ошибок не обнаружено'
    };
  } catch (error) {
    logger.error(`Ошибка при проверке критических ошибок: ${error.message}`);
    return {
      hasCriticalErrors: false,
      errorCount: 0,
      mostProblematicService: null,
      description: 'Ошибка при проверке критических ошибок: ' + error.message
    };
  }
}

/**
 * Определяет наиболее проблемный сервис по количеству ошибок
 * @param {Object} serviceErrors Объект с ошибками по сервисам
 * @returns {Object|null} Информация о наиболее проблемном сервисе
 */
function getMostProblematicService(serviceErrors) {
  if (!serviceErrors || Object.keys(serviceErrors).length === 0) {
    return null;
  }
  
  // Сортируем сервисы по количеству ошибок
  const sortedServices = Object.entries(serviceErrors)
    .sort((a, b) => b[1] - a[1]);
  
  if (sortedServices.length === 0) {
    return null;
  }
  
  const [serviceName, errorCount] = sortedServices[0];
  
  return {
    name: serviceName,
    errorCount
  };
}

module.exports = {
  initialize,
  analyzeSystemLogs,
  checkCriticalErrors
};