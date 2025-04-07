/**
 * Скрипт для запуска мониторинга сервера в фоновом режиме
 * Версия 2.0 - С расширенными проверками и исправлением проблем запуска
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import axios from 'axios';

// Пути для ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Конфигурация
const CONFIG = {
  pidFile: 'monitoring-service.pid',
  logFile: 'monitoring-service.log',
  scriptPath: './services/simple-monitor.mjs',
  serverHealthEndpoint: 'http://localhost:5000/health',
  maxStartAttempts: 3
};

// Проверяем наличие токена и chat ID для Telegram
const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

/**
 * Проверка доступности сервера
 */
async function checkServerHealth() {
  try {
    const response = await axios.get(CONFIG.serverHealthEndpoint, { timeout: 3000 });
    return {
      healthy: response.data.status === 'ok',
      uptime: response.data.uptime,
      memory: response.data.memory
    };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}

/**
 * Проверка, запущен ли сервис мониторинга
 * @returns {boolean} Запущен ли сервис
 */
function isServiceRunning() {
  try {
    if (fs.existsSync(CONFIG.pidFile)) {
      const pid = parseInt(fs.readFileSync(CONFIG.pidFile, 'utf8').trim());
      
      // Проверяем, существует ли процесс
      try {
        process.kill(pid, 0);
        console.log(`✅ Сервис мониторинга уже запущен (PID: ${pid})`);
        return true;
      } catch (e) {
        console.log(`⚠️ Найден PID файл, но процесс не существует. Удаляем старый PID файл.`);
        fs.unlinkSync(CONFIG.pidFile);
      }
    }
    return false;
  } catch (error) {
    console.error(`❌ Ошибка при проверке статуса мониторинга:`, error.message);
    return false;
  }
}

/**
 * Проверка конфигурации для Telegram
 */
function checkTelegramConfig() {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log(`⚠️ Отсутствуют переменные окружения для Telegram:`);
    console.log(`   TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN ? 'Установлен' : 'Отсутствует'}`);
    console.log(`   TELEGRAM_CHAT_ID: ${TELEGRAM_CHAT_ID ? 'Установлен' : 'Отсутствует'}`);
    console.log(`   Мониторинг будет работать без отправки уведомлений в Telegram`);
    return false;
  }
  
  console.log(`✅ Конфигурация Telegram проверена`);
  return true;
}

/**
 * Запуск сервиса мониторинга в фоновом режиме
 */
async function startMonitoringService() {
  console.log(`🚀 Запускаем сервис мониторинга в фоновом режиме...`);
  
  // Проверяем, запущен ли уже сервис
  if (isServiceRunning()) {
    console.log(`⚠️ Сервис мониторинга уже запущен. Новый экземпляр не будет запущен.`);
    return;
  }
  
  // Проверяем конфигурацию Telegram
  checkTelegramConfig();
  
  // Проверяем доступность сервера перед запуском мониторинга
  console.log(`🔍 Проверка доступности основного сервера...`);
  const serverStatus = await checkServerHealth();
  
  if (serverStatus.healthy) {
    console.log(`✅ Сервер доступен`);
    console.log(`   - Аптайм: ${serverStatus.uptime} сек`);
    if (serverStatus.memory) {
      console.log(`   - Использование памяти: ${serverStatus.memory.heapUsed}/${serverStatus.memory.heapTotal}`);
    }
  } else {
    console.log(`⚠️ Сервер недоступен (${serverStatus.error || 'неизвестная ошибка'})`);
    console.log(`   Мониторинг все равно будет запущен для отслеживания восстановления`);
  }
  
  try {
    // Записываем начальное сообщение в лог-файл
    fs.appendFileSync(CONFIG.logFile, `\n[${new Date().toISOString()}] Запуск сервиса мониторинга (v2.0)\n`);
    fs.appendFileSync(CONFIG.logFile, `[${new Date().toISOString()}] Telegram config: token=${!!TELEGRAM_BOT_TOKEN}, chatId=${!!TELEGRAM_CHAT_ID}\n`);
    
    // Создаем комманду для запуска сервиса напрямую
    const monitorProcess = spawn('node', [CONFIG.scriptPath], {
      detached: true,
      env: process.env,
      stdio: [
        'ignore',
        fs.openSync(CONFIG.logFile, 'a'),
        fs.openSync(CONFIG.logFile, 'a')
      ]
    });
    
    // Ждем немного и проверяем, запустился ли процесс
    monitorProcess.on('error', (err) => {
      console.error(`❌ Ошибка при запуске процесса мониторинга:`, err.message);
      fs.appendFileSync(CONFIG.logFile, `[${new Date().toISOString()}] Ошибка запуска: ${err.message}\n`);
    });
    
    // Отсоединяем процесс от родительского, чтобы он работал в фоне
    monitorProcess.unref();
    
    // Сохраняем PID процесса
    fs.writeFileSync(CONFIG.pidFile, monitorProcess.pid.toString());
    
    console.log(`✅ Сервис мониторинга запущен успешно (PID: ${monitorProcess.pid})`);
    console.log(`📊 Логи записываются в файл: ${CONFIG.logFile}`);
    console.log(`📤 Отчеты отправляются в Telegram: ${TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID ? 'Да' : 'Нет'}`);
    console.log(`💡 Для остановки сервиса используйте: node stop-monitoring-service.js`);
    
    // Проверяем через 1 секунду, запущен ли процесс
    setTimeout(() => {
      try {
        process.kill(monitorProcess.pid, 0);
        fs.appendFileSync(CONFIG.logFile, `[${new Date().toISOString()}] Процесс мониторинга успешно запущен (PID: ${monitorProcess.pid})\n`);
      } catch (e) {
        console.error(`❌ Процесс мониторинга не запустился или был прерван`);
        fs.appendFileSync(CONFIG.logFile, `[${new Date().toISOString()}] Процесс не запустился: ${e.message}\n`);
      }
    }, 1000);
    
  } catch (error) {
    console.error(`❌ Ошибка при запуске сервиса мониторинга:`, error.message);
    fs.appendFileSync(CONFIG.logFile, `[${new Date().toISOString()}] Критическая ошибка: ${error.message}\n`);
  }
}

// Запускаем сервис мониторинга
startMonitoringService();