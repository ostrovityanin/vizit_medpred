import axios from 'axios';
import os from 'os';
import { createLogger } from './logger.js';

// Инициализируем именованный логгер для модуля health-check
const logger = createLogger('health-check');

/**
 * Проверяет доступность сервиса по его URL
 * @param {string} url - URL для проверки
 * @param {string} name - Имя сервиса
 * @returns {Object} Результат проверки: {isActive, responseTime, error}
 */
export const checkServiceHealth = async (url, name) => {
  const startTime = Date.now();
  
  try {
    const response = await axios.get(url, { 
      timeout: 5000,
      headers: { 'Cache-Control': 'no-cache' } 
    });
    
    const responseTime = Date.now() - startTime;
    
    return {
      isActive: response.status >= 200 && response.status < 300,
      responseTime,
      status: response.status,
      data: response.data,
      error: null
    };
  } catch (error) {
    logger.error(`Ошибка проверки сервиса ${name}: ${error.message}`);
    
    return {
      isActive: false,
      responseTime: null,
      status: error.response?.status || 0,
      data: null,
      error: error.message
    };
  }
};

/**
 * Проверяет все микросервисы и возвращает их статус
 * @returns {Object} Статус всех микросервисов
 */
export const checkAllServices = async () => {
  const services = [
    { url: process.env.DATA_STORAGE_URL || 'http://localhost:3002', name: 'Хранилище данных' },
    { url: process.env.AUDIO_PROCESSOR_URL || 'http://localhost:3003', name: 'Аудио процессор' },
    { url: process.env.DOCUMENTATION_URL || 'http://localhost:3004', name: 'Документация' },
    { url: process.env.API_CORE_URL || 'http://localhost:3001', name: 'API Core' },
    { url: process.env.TELEGRAM_APP_URL || 'http://localhost:3000', name: 'Telegram App' },
    { url: process.env.ADMIN_PANEL_URL || 'http://localhost:3005', name: 'Админ-панель' }
  ];
  
  const serviceStatuses = {};
  const now = Date.now();
  
  for (const service of services) {
    logger.info(`Проверка состояния сервиса: ${service.name}`);
    const status = await checkServiceHealth(service.url, service.name);
    
    // Проверяем статус и обновляем время восстановления/падения
    if (status.isActive) {
      // Если сервис был неактивен, а теперь активен - восстановление
      if (serviceFailureTimes[service.name]) {
        const downtime = formatDowntime(now - serviceFailureTimes[service.name]);
        serviceRecoveryTimes[service.name] = now;
        status.recoveredAt = now;
        status.downtime = downtime;
        status.recoveryMessage = `Восстановлен после ${downtime} простоя`;
        
        // Очищаем время падения
        delete serviceFailureTimes[service.name];
        
        logger.info(`Сервис ${service.name} восстановлен после ${downtime} простоя`);
      }
    } else {
      // Если сервис только что упал, фиксируем время падения
      if (!serviceFailureTimes[service.name]) {
        serviceFailureTimes[service.name] = now;
        status.failedAt = now;
        
        logger.info(`Сервис ${service.name} перестал отвечать в ${new Date(now).toLocaleString()}`);
      } else {
        // Сервис продолжает быть недоступным
        const downtime = formatDowntime(now - serviceFailureTimes[service.name]);
        status.failedAt = serviceFailureTimes[service.name];
        status.downtime = downtime;
        status.downtimeMessage = `Недоступен ${downtime}`;
        
        logger.info(`Сервис ${service.name} недоступен ${downtime}`);
      }
    }
    
    // Если есть время восстановления, добавляем его в статус
    if (serviceRecoveryTimes[service.name]) {
      const uptimeSinceRecovery = formatDowntime(now - serviceRecoveryTimes[service.name]);
      status.uptimeSinceRecovery = uptimeSinceRecovery;
      status.uptimeSinceRecoveryMessage = `Работает ${uptimeSinceRecovery} после восстановления`;
    }
    
    serviceStatuses[service.name] = status;
  }
  
  return serviceStatuses;
};

// Отслеживание времени падения и восстановления сервисов
const serviceRecoveryTimes = {};
const serviceFailureTimes = {};

/**
 * Форматирует время простоя в удобочитаемом виде
 * @param {number} ms - Время простоя в миллисекундах
 * @returns {string} Отформатированное время простоя
 */
const formatDowntime = (ms) => {
  const seconds = Math.floor(ms / 1000);
  
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const remainingSeconds = seconds % 60;
  
  let result = '';
  if (days > 0) result += `${days}д `;
  if (hours > 0 || days > 0) result += `${hours}ч `;
  if (minutes > 0 || hours > 0 || days > 0) result += `${minutes}м `;
  result += `${remainingSeconds}с`;
  
  return result;
};

/**
 * Получает информацию о состоянии системы
 * @returns {Object} Информация о системе
 */
export const getSystemStatus = () => {
  // Время работы в форматированном виде
  const uptime = formatUptime(os.uptime());
  
  // Информация о памяти
  const totalMemory = Math.round(os.totalmem() / (1024 * 1024));
  const freeMemory = Math.round(os.freemem() / (1024 * 1024));
  const usedMemory = totalMemory - freeMemory;
  const memory = `${usedMemory}MB / ${totalMemory}MB`;
  
  // Загрузка CPU
  const cpuLoad = getCPULoad();
  
  return {
    uptime,
    memory,
    cpuLoad,
    platform: os.platform(),
    hostname: os.hostname(),
    freeMemoryPercent: Math.round((freeMemory / totalMemory) * 100),
    nodeVersion: process.version
  };
};

/**
 * Форматирует время работы в удобочитаемом виде
 * @param {number} seconds - Время работы в секундах
 * @returns {string} Отформатированное время работы
 */
const formatUptime = (seconds) => {
  const days = Math.floor(seconds / (24 * 60 * 60));
  seconds %= (24 * 60 * 60);
  const hours = Math.floor(seconds / (60 * 60));
  seconds %= (60 * 60);
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;
  seconds = Math.floor(seconds);
  
  let result = '';
  if (days > 0) result += `${days}d `;
  if (hours > 0 || days > 0) result += `${hours}h `;
  if (minutes > 0 || hours > 0 || days > 0) result += `${minutes}m `;
  result += `${seconds}s`;
  
  return result;
};

/**
 * Вычисляет текущую загрузку CPU
 * @returns {number} Процент загрузки CPU
 */
const getCPULoad = () => {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }
  
  // Возвращаем примерную загрузку в процентах
  return Math.round(100 - (totalIdle / totalTick) * 100);
};

/**
 * Генерирует полный отчет о состоянии системы и сервисов
 * @returns {Object} Отчет о состоянии
 */
export const generateStatusReport = async () => {
  const serviceStatuses = await checkAllServices();
  const systemStatus = getSystemStatus();
  
  return {
    timestamp: new Date(),
    serviceStatuses,
    systemStatus,
    allServicesActive: Object.values(serviceStatuses).every(status => status.isActive)
  };
};

export default { 
  checkServiceHealth, 
  checkAllServices, 
  getSystemStatus, 
  generateStatusReport 
};