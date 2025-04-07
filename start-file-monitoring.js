/**
 * Скрипт для запуска мониторинга с файловым логированием
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Пути для ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Конфигурация
const CONFIG = {
  pidFile: 'monitoring-service.pid',
  logFile: 'monitoring-service.log',
  scriptPath: path.join(__dirname, 'services', 'file-monitor.cjs')
};

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
 * Запуск сервиса мониторинга в фоновом режиме
 */
function startMonitoringService() {
  console.log(`🚀 Запускаем сервис мониторинга с файловым логированием...`);
  
  // Проверяем, запущен ли уже сервис
  if (isServiceRunning()) {
    console.log(`⚠️ Сервис мониторинга уже запущен. Новый экземпляр не будет запущен.`);
    return;
  }
  
  try {
    // Записываем начальное сообщение в лог-файл
    fs.appendFileSync(CONFIG.logFile, `\n[${new Date().toISOString()}] Запуск сервиса мониторинга\n`);
    
    // Запускаем процесс мониторинга
    const monitorProcess = spawn('node', [CONFIG.scriptPath], {
      detached: true,
      stdio: 'ignore'
    });
    
    // Отсоединяем процесс от родительского, чтобы он работал в фоне
    monitorProcess.unref();
    
    // Сохраняем PID процесса
    fs.writeFileSync(CONFIG.pidFile, monitorProcess.pid.toString());
    
    console.log(`✅ Сервис мониторинга запущен успешно (PID: ${monitorProcess.pid})`);
    console.log(`📊 Логи записываются в файл: ${CONFIG.logFile}`);
    console.log(`💡 Для остановки сервиса используйте: node stop-monitoring-service.js`);
  } catch (error) {
    console.error(`❌ Ошибка при запуске сервиса мониторинга:`, error.message);
  }
}

// Запускаем сервис мониторинга
startMonitoringService();