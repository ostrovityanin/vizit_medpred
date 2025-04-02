import TelegramBot from 'node-telegram-bot-api';
import { createLogger } from './logger.js';
import dotenv from 'dotenv';

// Инициализируем именованный логгер для модуля telegram
const logger = createLogger('telegram');

dotenv.config();

// Инициализируем бота с токеном из переменной окружения
let bot = null;
let chatId = null;

// Очередь сообщений для отправки (на случай, если соединение временно недоступно)
const messageQueue = [];

/**
 * Инициализирует Telegram бота
 */
export const initBot = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token) {
    logger.warn('TELEGRAM_BOT_TOKEN не установлен. Отправка уведомлений не будет работать.');
    return false;
  }

  if (!chatId) {
    logger.warn('TELEGRAM_CHAT_ID не установлен. Отправка уведомлений не будет работать.');
    return false;
  }

  try {
    bot = new TelegramBot(token, { polling: false });
    logger.info('Telegram бот успешно инициализирован');
    
    // Отправляем сообщение о запуске сервиса
    sendMessage('🟢 Сервис мониторинга запущен');
    
    // Отправляем накопившиеся сообщения
    processMessageQueue();
    
    return true;
  } catch (error) {
    logger.error(`Ошибка инициализации Telegram бота: ${error.message}`);
    return false;
  }
};

/**
 * Отправляет сообщение в чат
 * @param {string} message - текст сообщения для отправки
 */
export const sendMessage = async (message) => {
  if (!bot || !chatId) {
    // Если бот не инициализирован, добавляем сообщение в очередь
    messageQueue.push(message);
    return;
  }

  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    logger.info(`Сообщение отправлено в Telegram: ${message.substring(0, 50)}...`);
  } catch (error) {
    logger.error(`Ошибка отправки сообщения в Telegram: ${error.message}`);
    // Если не удалось отправить сообщение, добавляем в очередь
    messageQueue.push(message);
  }
};

/**
 * Отправляет отчет о состоянии микросервисов в Telegram
 * @param {Object} report - отчет о состоянии микросервисов
 */
export const sendStatusReport = async (report) => {
  const { serviceStatuses, systemStatus } = report;
  
  let message = `<b>📊 Отчет о состоянии системы</b>\n`;
  message += `<b>Время:</b> ${new Date().toLocaleString()}\n\n`;
  
  // Добавляем информацию о системе
  message += `<b>Система:</b>\n`;
  message += `- Uptime: ${systemStatus.uptime}\n`;
  message += `- Память: ${systemStatus.memory}\n`;
  message += `- Загрузка CPU: ${systemStatus.cpuLoad}%\n`;
  if (systemStatus.nodeVersion) {
    message += `- Node.js: ${systemStatus.nodeVersion}\n`;
  }
  message += `\n`;
  
  // Добавляем информацию о микросервисах
  message += `<b>Статус микросервисов:</b>\n`;
  
  for (const [service, status] of Object.entries(serviceStatuses)) {
    const emoji = status.isActive ? '🟢' : '🔴';
    message += `${emoji} <b>${service}:</b> ${status.isActive ? 'Активен' : 'Недоступен'}`;
    
    // Добавляем информацию о времени ответа
    if (status.responseTime) {
      message += ` (${status.responseTime}ms)`;
    }
    message += `\n`;
    
    // Если сервис активен и есть информация о его восстановлении
    if (status.isActive && status.recoveryMessage) {
      message += `   ↑ ${status.recoveryMessage}\n`;
    }
    
    // Если сервис активен и есть информация о времени работы после восстановления
    if (status.isActive && status.uptimeSinceRecoveryMessage) {
      message += `   ⏱ ${status.uptimeSinceRecoveryMessage}\n`;
    }
    
    // Если сервис неактивен и есть информация о его недоступности
    if (!status.isActive && status.downtimeMessage) {
      message += `   ⚠️ ${status.downtimeMessage}\n`;
    }
  }

  await sendMessage(message);
};

/**
 * Обрабатывает накопившиеся сообщения в очереди
 */
const processMessageQueue = async () => {
  if (messageQueue.length > 0 && bot && chatId) {
    logger.info(`Отправка ${messageQueue.length} накопившихся сообщений в Telegram`);
    
    // Копируем очередь и очищаем оригинал
    const messagesToSend = [...messageQueue];
    messageQueue.length = 0;
    
    for (const message of messagesToSend) {
      await sendMessage(message);
      // Делаем небольшую паузу между сообщениями, чтобы не превысить лимиты API Telegram
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
};

export default { initBot, sendMessage, sendStatusReport };