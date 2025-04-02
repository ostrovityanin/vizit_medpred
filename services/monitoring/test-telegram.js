import { initBot, sendMessage, sendStatusReport } from './utils/telegram.js';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function testTelegramBot() {
  console.log('Проверка подключения к Telegram...');
  
  // Инициализируем бота
  const initialized = initBot();
  
  if (!initialized) {
    console.error('Не удалось инициализировать Telegram бота. Проверьте переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID.');
    return;
  }
  
  console.log('Бот инициализирован успешно!');
  
  // Отправляем тестовое сообщение
  await sendMessage('🧪 Тестовое сообщение от сервиса мониторинга');
  
  // Создаем тестовый отчет о состоянии
  const testReport = {
    serviceStatuses: {
      'API Сервис': {
        isActive: true,
        responseTime: 125,
        uptimeSinceRecoveryMessage: 'Работает стабильно 2 часа после восстановления'
      },
      'Telegram Мини-Приложение': {
        isActive: false,
        downtimeMessage: 'Недоступен 15 минут'
      },
      'Сервис Обработки Аудио': {
        isActive: true,
        responseTime: 230
      }
    },
    systemStatus: {
      uptime: '2 дня 5 часов',
      memory: '120MB / 512MB',
      cpuLoad: 25,
      nodeVersion: process.version
    }
  };
  
  // Отправляем тестовый отчет
  await sendStatusReport(testReport);
  
  console.log('Тестовые сообщения отправлены!');
}

// Запуск теста
testTelegramBot();