/**
 * Скрипт для остановки сервиса мониторинга
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Пути для ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Конфигурация
const CONFIG = {
  pidFile: 'monitoring-service.pid',
  logFile: 'monitoring-service.log'
};

/**
 * Остановка сервиса мониторинга
 */
function stopMonitoringService() {
  console.log(`🔍 Поиск запущенного сервиса мониторинга...`);
  
  try {
    // Проверяем, существует ли PID файл
    if (!fs.existsSync(CONFIG.pidFile)) {
      console.log(`⚠️ Не найден PID файл мониторинга. Возможно, сервис не запущен.`);
      return;
    }
    
    // Читаем PID процесса
    const pid = parseInt(fs.readFileSync(CONFIG.pidFile, 'utf8').trim());
    console.log(`🔍 Найден PID сервиса мониторинга: ${pid}`);
    
    try {
      // Отправляем сигнал остановки процессу
      process.kill(pid, 'SIGTERM');
      console.log(`✅ Отправлен сигнал остановки процессу ${pid}`);
      
      // Удаляем PID файл
      fs.unlinkSync(CONFIG.pidFile);
      console.log(`🗑️ PID файл удален`);
      
      console.log(`✅ Сервис мониторинга успешно остановлен`);
    } catch (e) {
      console.log(`⚠️ Процесс с PID ${pid} не существует. Удаляем PID файл.`);
      fs.unlinkSync(CONFIG.pidFile);
    }
  } catch (error) {
    console.error(`❌ Ошибка при остановке сервиса мониторинга:`, error.message);
  }
}

// Останавливаем сервис мониторинга
stopMonitoringService();