import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Инициализируем именованный логгер для модуля log-analyzer
const logger = createLogger('log-analyzer');

/**
 * Анализирует логи статуса сервисов за указанный период
 * @param {number} days - Количество дней для анализа (по умолчанию 7)
 * @returns {Object} Результаты анализа логов
 */
export const analyzeLogs = async (days = 7) => {
  try {
    // Директория для хранения логов статуса
    const statusLogDir = process.env.STATUS_LOG_PATH || path.join(__dirname, '..', 'status_logs');
    
    // Проверяем, существует ли директория
    if (!fs.existsSync(statusLogDir)) {
      logger.warn(`Директория логов ${statusLogDir} не существует`);
      return { error: 'Логи отсутствуют' };
    }
    
    // Получаем список файлов
    const files = await fs.readdir(statusLogDir);
    
    // Фильтруем только файлы логов статуса
    const logFiles = files.filter(file => file.startsWith('status_') && file.endsWith('.json'));
    
    // Если нет файлов логов, возвращаем пустой результат
    if (logFiles.length === 0) {
      logger.warn('Файлы логов отсутствуют');
      return { error: 'Логи отсутствуют' };
    }
    
    // Сортируем по дате от самых новых к самым старым
    logFiles.sort().reverse();
    
    // Ограничиваем количество дней для анализа
    const filesToAnalyze = logFiles.slice(0, days);
    
    // Анализируем каждый файл
    const analysisResults = {
      period: `${days} дней`,
      totalChecks: 0,
      serviceAvailability: {},
      recoveryEvents: [],
      failureEvents: [],
      averageResponseTimes: {},
      uptimePercent: {},
      summaryByDate: {}
    };
    
    // Собираем данные о доступности сервисов
    for (const file of filesToAnalyze) {
      const filePath = path.join(statusLogDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      const logs = JSON.parse(content);
      
      // Дата из имени файла
      const date = file.replace('status_', '').replace('.json', '');
      analysisResults.summaryByDate[date] = {
        totalChecks: logs.length,
        serviceAvailability: {}
      };
      
      for (const log of logs) {
        analysisResults.totalChecks++;
        
        // Анализируем статус каждого сервиса
        const { serviceStatuses } = log.report;
        
        for (const [serviceName, status] of Object.entries(serviceStatuses)) {
          // Инициализируем структуру для сервиса, если она отсутствует
          if (!analysisResults.serviceAvailability[serviceName]) {
            analysisResults.serviceAvailability[serviceName] = {
              totalChecks: 0,
              availableChecks: 0,
              failedChecks: 0,
              responseTimes: []
            };
          }
          
          if (!analysisResults.summaryByDate[date].serviceAvailability[serviceName]) {
            analysisResults.summaryByDate[date].serviceAvailability[serviceName] = {
              totalChecks: 0,
              availableChecks: 0,
              failedChecks: 0
            };
          }
          
          // Увеличиваем счетчики
          analysisResults.serviceAvailability[serviceName].totalChecks++;
          analysisResults.summaryByDate[date].serviceAvailability[serviceName].totalChecks++;
          
          if (status.isActive) {
            analysisResults.serviceAvailability[serviceName].availableChecks++;
            analysisResults.summaryByDate[date].serviceAvailability[serviceName].availableChecks++;
            
            // Сохраняем время ответа
            if (status.responseTime) {
              analysisResults.serviceAvailability[serviceName].responseTimes.push(status.responseTime);
            }
          } else {
            analysisResults.serviceAvailability[serviceName].failedChecks++;
            analysisResults.summaryByDate[date].serviceAvailability[serviceName].failedChecks++;
          }
          
          // Фиксируем события восстановления
          if (status.recoveryMessage) {
            analysisResults.recoveryEvents.push({
              service: serviceName,
              time: log.timestamp,
              downtime: status.downtime
            });
          }
          
          // Фиксируем события падения
          if (status.failedAt && !status.recoveredAt) {
            analysisResults.failureEvents.push({
              service: serviceName,
              time: new Date(status.failedAt).toISOString(),
              downtime: status.downtime || 'Ongoing'
            });
          }
        }
      }
    }
    
    // Вычисляем среднее время ответа и процент аптайма для каждого сервиса
    for (const [serviceName, data] of Object.entries(analysisResults.serviceAvailability)) {
      // Среднее время ответа
      if (data.responseTimes.length > 0) {
        const totalResponseTime = data.responseTimes.reduce((sum, time) => sum + time, 0);
        analysisResults.averageResponseTimes[serviceName] = Math.round(totalResponseTime / data.responseTimes.length);
      } else {
        analysisResults.averageResponseTimes[serviceName] = 0;
      }
      
      // Процент аптайма
      analysisResults.uptimePercent[serviceName] = data.totalChecks > 0 
        ? (data.availableChecks / data.totalChecks * 100).toFixed(2) 
        : 0;
        
      // Очищаем массив времени ответа, так как он больше не нужен
      delete data.responseTimes;
    }
    
    // Рассчитываем процент аптайма по дням
    for (const [date, data] of Object.entries(analysisResults.summaryByDate)) {
      data.uptimePercent = {};
      
      for (const [serviceName, serviceData] of Object.entries(data.serviceAvailability)) {
        data.uptimePercent[serviceName] = serviceData.totalChecks > 0 
          ? (serviceData.availableChecks / serviceData.totalChecks * 100).toFixed(2) 
          : 0;
      }
    }
    
    return analysisResults;
  } catch (error) {
    logger.error(`Ошибка при анализе логов: ${error.message}`);
    return { error: error.message };
  }
};

export default { analyzeLogs };