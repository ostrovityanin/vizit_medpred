/**
 * Скрипт для остановки микросервиса GPT-4o Audio
 */

import fs from 'fs';
import path from 'path';

// Путь к директории микросервиса
const serviceDir = './services/gpt4o-audio-service';
// PID файл для отслеживания процесса
const pidFile = path.join(serviceDir, 'service.pid');

// Функция для остановки сервиса
function stopService() {
  if (!fs.existsSync(pidFile)) {
    console.log('Сервис GPT-4o Audio не запущен');
    return;
  }

  try {
    // Читаем PID из файла
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
    
    // Отправляем сигнал SIGTERM процессу
    process.kill(pid, 'SIGTERM');
    console.log(`Отправлен сигнал SIGTERM процессу с PID: ${pid}`);
    
    // Удаляем PID файл
    fs.unlinkSync(pidFile);
    console.log('Сервис GPT-4o Audio остановлен');
  } catch (error) {
    console.error(`Ошибка при остановке сервиса: ${error.message}`);
    
    // Удаляем PID файл в любом случае
    try {
      fs.unlinkSync(pidFile);
    } catch (e) {
      // Игнорируем ошибку при удалении файла
    }
  }
}

// Остановка сервиса
stopService();