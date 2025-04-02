/**
 * Модуль для проверки работоспособности микросервисов
 */
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');

// Загрузка переменных окружения
require('dotenv').config();

// Список сервисов для мониторинга
const services = [
  {
    id: 'data-storage',
    name: 'Сервис хранения данных',
    url: process.env.DATA_STORAGE_URL || 'http://localhost:3002',
    healthEndpoint: '/health'
  },
  {
    id: 'audio-processor',
    name: 'Сервис обработки аудио',
    url: process.env.AUDIO_PROCESSOR_URL || 'http://localhost:3003',
    healthEndpoint: '/health'
  },
  {
    id: 'api-core',
    name: 'API Core сервис',
    url: process.env.API_CORE_URL || 'http://localhost:3001',
    healthEndpoint: '/health'
  },
  {
    id: 'documentation',
    name: 'Сервис документации',
    url: process.env.DOCUMENTATION_URL || 'http://localhost:3004',
    healthEndpoint: '/health'
  },
  {
    id: 'telegram-app',
    name: 'Telegram Mini App',
    url: process.env.TELEGRAM_APP_URL || 'http://localhost:3000',
    healthEndpoint: '/health'
  },
  {
    id: 'admin-panel',
    name: 'Админ-панель',
    url: process.env.ADMIN_PANEL_URL || 'http://localhost:3005',
    healthEndpoint: '/health'
  }
];

// Статус сервисов
let servicesStatus = {};

// История статусов сервисов для отслеживания восстановления
let serviceHistory = {};

// Путь к файлу журнала статуса
const STATUS_LOG_PATH = process.env.STATUS_LOG_PATH || './status_logs';
const STATUS_LOG_FILE = path.join(STATUS_LOG_PATH, 'status_history.json');

// События восстановления
let recoveryEvents = [];
const RECOVERY_LOG_FILE = path.join(STATUS_LOG_PATH, 'recovery_events.json');

/**
 * Инициализация модуля проверки здоровья
 */
async function initialize() {
  logger.info('Инициализация модуля проверки работоспособности');
  
  // Создаем директорию для логов статуса, если она не существует
  await fs.ensureDir(STATUS_LOG_PATH);
  
  // Загружаем историю статусов, если файл существует
  try {
    if (await fs.pathExists(STATUS_LOG_FILE)) {
      const historyData = await fs.readJson(STATUS_LOG_FILE);
      serviceHistory = historyData;
      logger.info(`Загружена история статусов для ${Object.keys(serviceHistory).length} сервисов`);
    }
  } catch (error) {
    logger.error(`Ошибка загрузки истории статусов: ${error.message}`);
  }
  
  // Загружаем события восстановления, если файл существует
  try {
    if (await fs.pathExists(RECOVERY_LOG_FILE)) {
      recoveryEvents = await fs.readJson(RECOVERY_LOG_FILE);
      logger.info(`Загружены ${recoveryEvents.length} событий восстановления`);
    }
  } catch (error) {
    logger.error(`Ошибка загрузки событий восстановления: ${error.message}`);
  }
  
  // Инициализируем статус сервисов
  services.forEach(service => {
    servicesStatus[service.id] = {
      id: service.id,
      name: service.name,
      url: service.url,
      active: false,
      responseTime: null,
      lastCheck: new Date(),
      downSince: null,
      upSince: null
    };
    
    // Инициализируем историю для сервиса, если она не существует
    if (!serviceHistory[service.id]) {
      serviceHistory[service.id] = {
        statusChanges: [],
        lastStatus: false,
        downtime: 0
      };
    }
  });
  
  logger.info('Модуль проверки работоспособности инициализирован');
}

/**
 * Проверка работоспособности всех сервисов
 * @returns {Object} Статус всех сервисов
 */
async function checkAllServices() {
  const timestamp = new Date();
  logger.debug('Запуск проверки работоспособности всех сервисов');
  
  // Проверяем каждый сервис
  const checkPromises = services.map(service => checkService(service, timestamp));
  await Promise.all(checkPromises);
  
  // Сохраняем историю статусов
  await saveStatusHistory();
  
  return {
    timestamp,
    services: servicesStatus,
    system: getSystemStatus()
  };
}

/**
 * Проверка работоспособности отдельного сервиса
 * @param {Object} service Информация о сервисе
 * @param {Date} timestamp Временная метка проверки
 * @returns {Object} Обновленный статус сервиса
 */
async function checkService(service, timestamp) {
  const serviceId = service.id;
  const healthUrl = `${service.url}${service.healthEndpoint}`;
  const startTime = Date.now();
  let responseTime = null;
  let active = false;
  
  try {
    logger.debug(`Проверка сервиса ${service.name} по URL: ${healthUrl}`);
    const response = await axios.get(healthUrl, { timeout: 5000 });
    responseTime = Date.now() - startTime;
    active = response.status === 200;
    
    logger.debug(`Сервис ${service.name} ${active ? 'активен' : 'недоступен'}, время отклика: ${responseTime}ms`);
  } catch (error) {
    logger.warn(`Ошибка при проверке сервиса ${service.name}: ${error.message}`);
    active = false;
  }
  
  // Обновляем статус сервиса
  const previousStatus = servicesStatus[serviceId].active;
  servicesStatus[serviceId] = {
    ...servicesStatus[serviceId],
    active,
    responseTime,
    lastCheck: timestamp,
  };
  
  // Если статус изменился, обновляем информацию о времени
  if (active !== previousStatus) {
    handleStatusChange(serviceId, active, timestamp);
  }
  
  return servicesStatus[serviceId];
}

/**
 * Обработка изменения статуса сервиса
 * @param {string} serviceId Идентификатор сервиса
 * @param {boolean} active Новый статус сервиса
 * @param {Date} timestamp Временная метка изменения
 */
function handleStatusChange(serviceId, active, timestamp) {
  const service = services.find(s => s.id === serviceId);
  const serviceName = service ? service.name : serviceId;
  
  // Добавляем запись в историю статусов
  if (!serviceHistory[serviceId]) {
    serviceHistory[serviceId] = {
      statusChanges: [],
      lastStatus: active,
      downtime: 0
    };
  }
  
  serviceHistory[serviceId].statusChanges.push({
    timestamp,
    status: active
  });
  
  // Ограничиваем размер истории
  if (serviceHistory[serviceId].statusChanges.length > 100) {
    serviceHistory[serviceId].statusChanges.shift();
  }
  
  // Обновляем время простоя/активности
  if (active) {
    // Сервис стал активным после простоя
    logger.info(`Сервис ${serviceName} ВОССТАНОВЛЕН`);
    servicesStatus[serviceId].upSince = timestamp;
    servicesStatus[serviceId].downSince = null;
    
    // Рассчитываем время простоя, если сервис был недоступен
    if (serviceHistory[serviceId].lastStatus === false) {
      const lastDowntime = calculateDowntime(serviceId, timestamp);
      
      // Добавляем событие восстановления
      const recoveryEvent = {
        service: serviceName,
        serviceId,
        timestamp: timestamp.toISOString(),
        downtime: Math.round(lastDowntime / 1000) // в секундах
      };
      
      recoveryEvents.push(recoveryEvent);
      saveRecoveryEvents();
      
      logger.info(`Сервис ${serviceName} был недоступен ${Math.round(lastDowntime / 1000)} секунд`);
    }
  } else {
    // Сервис стал недоступен
    logger.warn(`Сервис ${serviceName} НЕДОСТУПЕН`);
    servicesStatus[serviceId].downSince = timestamp;
    servicesStatus[serviceId].upSince = null;
  }
  
  serviceHistory[serviceId].lastStatus = active;
}

/**
 * Рассчитывает время простоя сервиса в миллисекундах
 * @param {string} serviceId Идентификатор сервиса
 * @param {Date} currentTime Текущее время
 * @returns {number} Время простоя в миллисекундах
 */
function calculateDowntime(serviceId, currentTime) {
  const changes = serviceHistory[serviceId].statusChanges;
  
  // Находим последнюю запись о недоступности сервиса
  for (let i = changes.length - 1; i >= 0; i--) {
    if (changes[i].status === false) {
      const downTimestamp = new Date(changes[i].timestamp);
      return currentTime - downTimestamp;
    }
  }
  
  return 0;
}

/**
 * Получение статуса системы (памяти, процессора и т.д.)
 * @returns {Object} Статус системы
 */
function getSystemStatus() {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  return {
    uptime,
    memoryUsed: memoryUsage.rss,
    memoryTotal: memoryUsage.heapTotal,
    cpuUsage: null, // Заполняется в другом модуле
    startTime: process.env.SERVICE_START_TIME || new Date().toISOString()
  };
}

/**
 * Сохранение истории статусов в файл
 */
async function saveStatusHistory() {
  try {
    await fs.writeJson(STATUS_LOG_FILE, serviceHistory, { spaces: 2 });
    logger.debug('История статусов сохранена');
  } catch (error) {
    logger.error(`Ошибка при сохранении истории статусов: ${error.message}`);
  }
}

/**
 * Сохранение событий восстановления в файл
 */
async function saveRecoveryEvents() {
  try {
    // Ограничиваем количество сохраняемых событий
    if (recoveryEvents.length > 100) {
      recoveryEvents = recoveryEvents.slice(-100);
    }
    
    await fs.writeJson(RECOVERY_LOG_FILE, recoveryEvents, { spaces: 2 });
    logger.debug('События восстановления сохранены');
  } catch (error) {
    logger.error(`Ошибка при сохранении событий восстановления: ${error.message}`);
  }
}

/**
 * Получение текущего статуса всех сервисов
 * @returns {Object} Статус всех сервисов
 */
function getCurrentStatus() {
  return {
    timestamp: new Date(),
    services: servicesStatus,
    system: getSystemStatus()
  };
}

/**
 * Получение списка недоступных сервисов
 * @returns {Array} Массив недоступных сервисов
 */
function getDownServices() {
  return services
    .filter(service => !servicesStatus[service.id].active)
    .map(service => ({
      id: service.id,
      name: service.name,
      downSince: servicesStatus[service.id].downSince
    }));
}

/**
 * Получение списка сервисов с высоким временем отклика
 * @param {number} threshold Порог времени отклика в миллисекундах
 * @returns {Array} Массив сервисов с высоким временем отклика
 */
function getSlowServices(threshold = 2000) {
  return services
    .filter(service => 
      servicesStatus[service.id].active && 
      servicesStatus[service.id].responseTime > threshold
    )
    .map(service => ({
      id: service.id,
      name: service.name,
      responseTime: servicesStatus[service.id].responseTime
    }));
}

/**
 * Получение списка событий восстановления
 * @returns {Array} События восстановления
 */
function getRecoveryEvents() {
  return recoveryEvents;
}

/**
 * Очистка списка событий восстановления
 */
async function clearRecoveryEvents() {
  recoveryEvents = [];
  await saveRecoveryEvents();
  logger.info('События восстановления очищены');
}

/**
 * Список сервисов для мониторинга
 */
function getServicesList() {
  return services;
}

module.exports = {
  initialize,
  checkAllServices,
  getCurrentStatus,
  getDownServices,
  getSlowServices,
  getRecoveryEvents,
  clearRecoveryEvents,
  getServicesList
};