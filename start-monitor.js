/**
 * Скрипт для запуска мониторинга с предварительной проверкой
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Проверяем наличие токена и chat ID
const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('⚠️ ОШИБКА: Не найдены переменные окружения TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
  console.log('Для работы мониторинга необходимо установить эти переменные');
  console.log('Проверьте наличие необходимых секретов в настройках Replit');
  process.exit(1);
}

console.log('🔄 Запуск мониторинга системы...');
console.log(`✅ Найден токен Telegram: ${TELEGRAM_BOT_TOKEN ? 'Да' : 'Нет'}`);
console.log(`✅ Найден Chat ID: ${TELEGRAM_CHAT_ID}`);

// Запускаем скрипт мониторинга
try {
  console.log('📡 Запуск сервиса мониторинга...');
  require('./services/simple-monitor');
  console.log('✅ Мониторинг успешно запущен');
  console.log('❗ Нажмите CTRL+C для остановки мониторинга');
} catch (error) {
  console.error('❌ Ошибка запуска мониторинга:', error.message);
}