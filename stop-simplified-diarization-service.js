/**
 * Скрипт для остановки упрощенной версии микросервиса аудио-диаризации
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем путь к текущей директории
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Конфигурация сервиса
const PID_FILE = path.join(__dirname, 'diarization-service.pid');
const LOG_FILE = path.join(__dirname, 'diarization-service.log');

/**
 * Остановка сервиса диаризации
 */
function stopService() {
  try {
    // Проверяем существование PID-файла
    if (!fs.existsSync(PID_FILE)) {
      console.log('Diarization service is not running (PID file not found).');
      return false;
    }
    
    // Читаем PID из файла
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
    
    if (isNaN(pid)) {
      console.error('Invalid PID in file:', PID_FILE);
      // Удаляем некорректный PID-файл
      fs.unlinkSync(PID_FILE);
      return false;
    }
    
    console.log(`Stopping diarization service with PID: ${pid}`);
    
    // Пытаемся остановить процесс
    try {
      process.kill(pid);
      console.log(`Process ${pid} terminated successfully.`);
      
      // Добавляем запись в лог-файл
      if (fs.existsSync(LOG_FILE)) {
        const stopLine = `\n\n=== DIARIZATION SERVICE STOPPED AT ${new Date().toISOString()} ===\n\n`;
        fs.appendFileSync(LOG_FILE, stopLine);
      }
      
      // Удаляем PID-файл
      fs.unlinkSync(PID_FILE);
      return true;
    } catch (killError) {
      if (killError.code === 'ESRCH') {
        console.log(`Process ${pid} not found. It may have already terminated.`);
        // Удаляем PID-файл
        fs.unlinkSync(PID_FILE);
        return true;
      } else {
        console.error(`Error stopping process ${pid}:`, killError.message);
        return false;
      }
    }
  } catch (error) {
    console.error('Error stopping diarization service:', error.message);
    return false;
  }
}

// Запускаем остановку сервиса
const result = stopService();
console.log(result ? 'Service stopped successfully.' : 'Failed to stop service.');

// Возвращаем код завершения
process.exit(result ? 0 : 1);