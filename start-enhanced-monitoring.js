/**
 * Запуск улучшенной версии мониторинга с проверкой доступности окружения
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Инициализация для ESM
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Конфигурация
const CONFIG = {
  pidFile: 'enhanced-monitoring.pid',
  logFile: 'enhanced-monitoring.log',
  scriptPath: './services/enhanced-monitor.mjs'
};

/**
 * Проверка, запущен ли сервис мониторинга
 * @returns {boolean} Запущен ли сервис
 */
function isServiceRunning() {
  try {
    if (!fs.existsSync(CONFIG.pidFile)) {
      return false;
    }
    
    const pid = parseInt(fs.readFileSync(CONFIG.pidFile, 'utf8').trim());
    
    // Проверяем, существует ли процесс
    try {
      process.kill(pid, 0);
      console.log(`✅ Обнаружен запущенный процесс мониторинга (PID: ${pid})`);
      return true;
    } catch (e) {
      console.log(`⚠️ PID-файл существует, но процесс недоступен. Удаляем старый PID-файл...`);
      fs.unlinkSync(CONFIG.pidFile);
      return false;
    }
  } catch (error) {
    console.error(`❌ Ошибка при проверке состояния сервиса:`, error.message);
    return false;
  }
}

/**
 * Проверка конфигурации для Telegram
 */
function checkTelegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!token) {
    console.warn(`⚠️ ПРЕДУПРЕЖДЕНИЕ: Не настроен токен TELEGRAM_BOT_TOKEN`);
  }
  
  if (!chatId) {
    console.warn(`⚠️ ПРЕДУПРЕЖДЕНИЕ: Не настроен ID чата TELEGRAM_CHAT_ID`);
  }
  
  if (!token || !chatId) {
    console.warn(`⚠️ Уведомления в Telegram не будут отправляться!`);
    return false;
  }
  
  return true;
}

/**
 * Запуск сервиса мониторинга в фоновом режиме
 */
async function startMonitoringService() {
  // Проверяем, запущен ли уже сервис
  if (isServiceRunning()) {
    console.log(`❌ Мониторинг уже запущен. Для перезапуска сначала остановите текущий процесс.`);
    process.exit(1);
  }
  
  // Проверяем конфигурацию Telegram
  checkTelegramConfig();
  
  // Проверяем наличие скрипта мониторинга
  const scriptPath = path.resolve(CONFIG.scriptPath);
  try {
    if (!fs.existsSync(scriptPath)) {
      console.error(`❌ Скрипт мониторинга не найден: ${scriptPath}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Ошибка при проверке скрипта:`, error.message);
    process.exit(1);
  }
  
  console.log(`🚀 Запуск улучшенного мониторинга...`);
  console.log(`📄 Скрипт: ${scriptPath}`);
  
  try {
    // Запускаем процесс мониторинга
    const monitorProcess = spawn('node', [scriptPath], {
      detached: true,
      stdio: ['ignore', 
              fs.openSync(CONFIG.logFile, 'a'), 
              fs.openSync(CONFIG.logFile, 'a')]
    });
    
    // Сохраняем PID процесса в файл
    fs.writeFileSync(CONFIG.pidFile, `${monitorProcess.pid}`);
    
    console.log(`✅ Мониторинг запущен в фоновом режиме (PID: ${monitorProcess.pid})`);
    console.log(`📝 Логи будут записываться в ${CONFIG.logFile}`);
    
    // Отсоединяем процесс
    monitorProcess.unref();
    
    console.log('✅ Успешно запущено. Статус будет регулярно выводиться в лог-файл.');
    process.exit(0);
  } catch (error) {
    console.error(`❌ Ошибка при запуске мониторинга:`, error.message);
    process.exit(1);
  }
}

// Запуск сервиса
startMonitoringService();