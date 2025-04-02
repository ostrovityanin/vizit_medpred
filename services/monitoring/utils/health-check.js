/**
 * Модуль для проверки состояния сервисов
 */
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { logger, getServiceLogger } = require('./logger');
require('dotenv').config();

// Настройки для хранения истории статусов
const HISTORY_FILE = path.join(process.env.LOG_PATH || './logs', 'status-history.json');
const MAX_HISTORY_ITEMS = 1000; // Максимальное количество записей в истории

// Список сервисов для мониторинга
const services = (process.env.SERVICES || '').split(',').filter(Boolean);
const serviceUrls = (process.env.SERVICE_URLS || '').split(',').filter(Boolean);

// Статусы сервисов
const serviceStatus = {};
// История изменения статусов
let statusHistory = [];

// Порог времени ответа (мс) для предупреждений
const WARNING_THRESHOLD = 1000;
const CRITICAL_THRESHOLD = 3000;

// Загрузка истории статусов
function loadStatusHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      statusHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')) || [];
      logger.info(`Загружена история статусов: ${statusHistory.length} записей`);
    } else {
      statusHistory = [];
      logger.info('Файл истории статусов не найден, создана новая история');
      saveStatusHistory();
    }
  } catch (error) {
    logger.error(`Ошибка загрузки истории статусов: ${error.message}`);
    statusHistory = [];
  }
}

// Сохранение истории статусов
function saveStatusHistory() {
  try {
    // Оставляем только последние MAX_HISTORY_ITEMS записей
    if (statusHistory.length > MAX_HISTORY_ITEMS) {
      statusHistory = statusHistory.slice(-MAX_HISTORY_ITEMS);
    }
    
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(statusHistory, null, 2));
  } catch (error) {
    logger.error(`Ошибка сохранения истории статусов: ${error.message}`);
  }
}

/**
 * Получение форматированного времени простоя
 * @param {number} downtime - Время простоя в миллисекундах
 * @returns {string} - Отформатированное время
 */
function formatDowntime(downtime) {
  const seconds = Math.floor((downtime / 1000) % 60);
  const minutes = Math.floor((downtime / (1000 * 60)) % 60);
  const hours = Math.floor((downtime / (1000 * 60 * 60)) % 24);
  const days = Math.floor(downtime / (1000 * 60 * 60 * 24));
  
  const parts = [];
  if (days > 0) parts.push(`${days}д`);
  if (hours > 0) parts.push(`${hours}ч`);
  if (minutes > 0) parts.push(`${minutes}м`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}с`);
  
  return parts.join(' ');
}

/**
 * Проверка одного сервиса
 * @param {string} serviceName - Имя сервиса
 * @param {string} url - URL для проверки
 * @returns {Object} - Результат проверки
 */
async function checkService(serviceName, url) {
  const serviceLogger = getServiceLogger(serviceName);
  
  // Получаем текущий статус сервиса или создаем новый
  const currentStatus = serviceStatus[serviceName] || {
    name: serviceName,
    status: 'unknown',
    lastCheck: Date.now(),
    downSince: null,
    responseTime: 0,
    consecutiveFailures: 0
  };
  
  try {
    const startTime = Date.now();
    const response = await axios.get(url, { timeout: 5000 });
    const responseTime = Date.now() - startTime;
    
    // Определяем статус на основе времени ответа
    let status = 'healthy';
    let message = '';
    
    if (responseTime > CRITICAL_THRESHOLD) {
      status = 'warning';
      message = `Высокое время отклика: ${responseTime}ms`;
    } else if (responseTime > WARNING_THRESHOLD) {
      status = 'warning';
      message = `Повышенное время отклика: ${responseTime}ms`;
    }
    
    // Если сервис был недоступен, но теперь работает, отмечаем восстановление
    if (currentStatus.status === 'critical' && status !== 'critical') {
      const downtime = Date.now() - (currentStatus.downSince || Date.now());
      serviceLogger.info(`Сервис восстановлен после ${formatDowntime(downtime)} простоя`);
      
      // Отметка о восстановлении в истории
      statusHistory.push({
        time: new Date().toISOString(),
        service: serviceName,
        event: 'recovery',
        downtime: formatDowntime(downtime)
      });
    }
    
    // Обновляем статус
    serviceStatus[serviceName] = {
      name: serviceName,
      url,
      status,
      message,
      responseTime,
      lastCheck: Date.now(),
      downSince: status === 'critical' ? (currentStatus.downSince || Date.now()) : null,
      consecutiveFailures: 0
    };
    
    return {
      name: serviceName,
      status,
      message,
      responseTime,
      downtime: currentStatus.downSince ? formatDowntime(Date.now() - currentStatus.downSince) : null
    };
  } catch (error) {
    // Увеличиваем счетчик последовательных ошибок
    const consecutiveFailures = (currentStatus.consecutiveFailures || 0) + 1;
    const errorMessage = error.message || 'Неизвестная ошибка';
    
    // Если это первая ошибка, отмечаем время начала простоя
    const downSince = currentStatus.downSince || Date.now();
    const downtime = Date.now() - downSince;
    
    // Если это первая ошибка после рабочего состояния, логируем
    if (currentStatus.status !== 'critical') {
      serviceLogger.error(`Сервис недоступен: ${errorMessage}`);
      
      // Запись в историю
      statusHistory.push({
        time: new Date().toISOString(),
        service: serviceName,
        event: 'failure',
        error: errorMessage
      });
    }
    
    // Обновляем статус
    serviceStatus[serviceName] = {
      name: serviceName,
      url,
      status: 'critical',
      message: errorMessage,
      responseTime: 0,
      lastCheck: Date.now(),
      downSince,
      consecutiveFailures
    };
    
    return {
      name: serviceName,
      status: 'critical',
      message: errorMessage,
      responseTime: 0,
      downtime: formatDowntime(downtime)
    };
  }
}

/**
 * Проверка всех сервисов
 * @returns {Object} - Отчет о статусе всех сервисов
 */
async function checkAllServices() {
  const results = [];
  
  // Проверяем все сервисы
  for (let i = 0; i < services.length; i++) {
    if (services[i] && serviceUrls[i]) {
      const result = await checkService(services[i], serviceUrls[i]);
      results.push(result);
    }
  }
  
  // Определяем общий статус системы
  let overallStatus = 'healthy';
  for (const result of results) {
    if (result.status === 'critical') {
      overallStatus = 'critical';
      break;
    } else if (result.status === 'warning' && overallStatus !== 'critical') {
      overallStatus = 'warning';
    }
  }
  
  // Формируем отчет
  const statusReport = {
    time: new Date().toLocaleString(),
    overallStatus,
    services: results
  };
  
  // Сохраняем историю статусов, если есть изменения
  const lastHistoryItem = statusHistory[statusHistory.length - 1];
  if (!lastHistoryItem || lastHistoryItem.overallStatus !== overallStatus) {
    statusHistory.push({
      time: new Date().toISOString(),
      overallStatus,
      servicesStatus: results.map(r => ({ name: r.name, status: r.status }))
    });
    saveStatusHistory();
  }
  
  return statusReport;
}

/**
 * Получение истории статусов
 * @returns {Array} - История статусов
 */
function getStatusHistory() {
  return statusHistory;
}

/**
 * Получение текущего статуса сервисов
 * @returns {Object} - Текущий статус
 */
function getCurrentStatus() {
  const results = Object.values(serviceStatus).map(service => ({
    name: service.name,
    status: service.status,
    message: service.message,
    responseTime: service.responseTime,
    downtime: service.downSince ? formatDowntime(Date.now() - service.downSince) : null
  }));
  
  // Определяем общий статус системы
  let overallStatus = 'healthy';
  for (const result of results) {
    if (result.status === 'critical') {
      overallStatus = 'critical';
      break;
    } else if (result.status === 'warning' && overallStatus !== 'critical') {
      overallStatus = 'warning';
    }
  }
  
  return {
    time: new Date().toLocaleString(),
    overallStatus,
    services: results
  };
}

// Инициализация при импорте модуля
loadStatusHistory();

module.exports = {
  checkAllServices,
  checkService,
  getStatusHistory,
  getCurrentStatus,
  formatDowntime
};