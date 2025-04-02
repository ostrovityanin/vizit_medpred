/**
 * Скрипт для остановки микросервиса GPT-4o Audio
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем путь к текущему файлу и директории
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pidFile = path.join(__dirname, 'gpt4o-service.pid');

// Проверка существования PID файла
if (!fs.existsSync(pidFile)) {
  console.error('Файл PID не найден. Возможно, сервис не запущен.');
  process.exit(1);
}

// Чтение PID из файла
const pid = fs.readFileSync(pidFile, 'utf-8').trim();

try {
  // Отправка сигнала завершения процессу
  process.kill(parseInt(pid), 'SIGTERM');
  console.log(`Отправлен сигнал завершения процессу с PID: ${pid}`);
  
  // Удаление PID файла
  fs.unlinkSync(pidFile);
  console.log('Микросервис GPT-4o Audio успешно остановлен.');
} catch (err) {
  console.error(`Ошибка при остановке микросервиса: ${err.message}`);
  
  // Если процесс не существует, удаляем PID файл
  if (err.code === 'ESRCH') {
    fs.unlinkSync(pidFile);
    console.log('PID файл удален.');
  }
}