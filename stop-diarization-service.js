/**
 * Скрипт для остановки микросервиса аудио-диаризации
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Файл с PID микросервиса
const PID_FILE = path.join(__dirname, 'diarization-service.pid');

/**
 * Остановка микросервиса
 */
function stopService() {
  // Проверяем существует ли PID файл
  if (!fs.existsSync(PID_FILE)) {
    console.log('Микросервис аудио-диаризации не запущен (PID файл не найден)');
    return;
  }
  
  try {
    // Читаем PID из файла
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
    
    console.log(`Остановка микросервиса аудио-диаризации с PID: ${pid}...`);
    
    // Отправляем сигнал SIGTERM процессу
    process.kill(pid, 'SIGTERM');
    
    console.log('Сигнал на остановку отправлен');
    
    // Ждем немного, чтобы процесс успел завершиться
    setTimeout(() => {
      try {
        // Проверяем, завершился ли процесс
        process.kill(pid, 0);
        console.warn('Процесс всё ещё работает. Отправляем SIGKILL...');
        
        // Если процесс всё ещё работает, отправляем SIGKILL
        try {
          process.kill(pid, 'SIGKILL');
          console.log('Отправлен сигнал SIGKILL');
        } catch (e) {
          // Игнорируем ошибки
        }
      } catch (e) {
        // Если process.kill выбрасывает ошибку, значит процесс уже завершен
        console.log('Микросервис аудио-диаризации успешно остановлен');
      }
      
      // Удаляем PID файл в любом случае
      try {
        if (fs.existsSync(PID_FILE)) {
          fs.unlinkSync(PID_FILE);
        }
      } catch (e) {
        console.error('Ошибка при удалении PID файла:', e.message);
      }
    }, 2000);
  } catch (error) {
    console.error('Ошибка при остановке микросервиса:', error.message);
    
    // Удаляем PID файл в случае ошибки
    try {
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
      }
    } catch (e) {
      // Игнорируем ошибки при удалении файла
    }
  }
}

// Останавливаем микросервис
stopService();