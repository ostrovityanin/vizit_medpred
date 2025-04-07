/**
 * Скрипт для запуска улучшенного мониторинга с предварительной проверкой
 * 
 * Версия 2.0 - Добавлены функции автоматического восстановления и расширенные уведомления
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Пути для ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Переменные для запуска сервера мониторинга
const CONFIG = {
  monitorLogFile: path.join(process.cwd(), 'monitor.log'),
  serverHealthEndpoint: 'http://localhost:5000/health',
  monitorTimeout: 120000, // 2 минуты - максимальное время ожидания запуска мониторинга
};

// Проверяем наличие токена и chat ID
const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

// Функция проверки наличия необходимых переменных окружения
function checkEnvironment() {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('⚠️ ОШИБКА: Не найдены переменные окружения TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
    console.log('Для работы мониторинга необходимо установить эти переменные');
    console.log('Проверьте наличие необходимых секретов в настройках Replit');
    
    return false;
  }
  return true;
}

// Функция проверки основного сервера
async function checkMainServer() {
  try {
    console.log('🔍 Проверка основного сервиса...');
    const response = await axios.get(CONFIG.serverHealthEndpoint, { timeout: 5000 });
    console.log(`✅ Сервис доступен! Статус: ${response.data.status}`);
    
    return {
      healthy: response.data.status === 'ok',
      uptime: response.data.uptime,
      memory: response.data.memory
    };
  } catch (error) {
    console.log(`❌ Сервис недоступен: ${error.message}`);
    return { healthy: false, error: error.message };
  }
}

// Основная функция запуска мониторинга
async function startMonitoring() {
  console.log('\n🚀 Запуск мониторинга системы...');
  
  // Проверяем переменные окружения
  if (!checkEnvironment()) {
    process.exit(1);
  }
  
  console.log(`✅ Найден токен Telegram: ${TELEGRAM_BOT_TOKEN ? 'Да' : 'Нет'}`);
  console.log(`✅ Найден Chat ID: ${TELEGRAM_CHAT_ID}`);
  
  // Проверяем доступность основного сервиса перед запуском мониторинга
  const serverStatus = await checkMainServer();
  if (serverStatus.healthy) {
    console.log(`📊 Информация о сервере:`);
    console.log(`   - Аптайм: ${serverStatus.uptime} сек`);
    if (serverStatus.memory) {
      console.log(`   - Использование памяти: ${serverStatus.memory.heapUsed} из ${serverStatus.memory.heapTotal}`);
    }
  } else {
    console.log('⚠️ Основной сервис недоступен, но мониторинг все равно будет запущен');
    console.log('   Мониторинг попытается автоматически перезапустить сервис');
  }
  
  // Запускаем скрипт мониторинга
  try {
    console.log('\n📡 Запуск сервиса мониторинга...');
    
    // Динамический импорт для ESM
    const monitorModule = await import('./services/simple-monitor.mjs');
    
    console.log('✅ Мониторинг успешно запущен');
    console.log('📝 Все события будут записаны в консоль и отправлены в Telegram');
    console.log('❗ Нажмите CTRL+C для остановки мониторинга');
  } catch (error) {
    console.error('❌ Ошибка запуска мониторинга:', error.message);
    process.exit(1);
  }
}

// Запуск мониторинга
startMonitoring().catch(error => {
  console.error('❌ Критическая ошибка запуска мониторинга:', error.message);
  process.exit(1);
});