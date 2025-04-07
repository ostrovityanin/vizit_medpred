/**
 * Запуск упрощенной версии микросервиса аудио-диаризации
 * 
 * Этот скрипт:
 * 1. Проверяет, что все необходимые директории существуют
 * 2. Запускает упрощенную версию микросервиса диаризации на порту 5050
 * 3. Сохраняет PID процесса и настраивает логирование
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем путь к текущей директории
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Конфигурация сервиса
const SERVICE_DIR = path.join(__dirname, 'services', 'audio-diarization');
const SCRIPT_PATH = path.join(SERVICE_DIR, 'run_simplified.py');
const LOG_FILE = path.join(__dirname, 'diarization-service.log');
const PID_FILE = path.join(__dirname, 'diarization-service.pid');
const PORT = 5050;

/**
 * Проверяет, что все необходимые директории существуют
 */
function ensureDirectoriesExist() {
  // Создаем директорию сервиса, если она не существует
  if (!fs.existsSync(SERVICE_DIR)) {
    console.log(`Creating service directory: ${SERVICE_DIR}`);
    fs.mkdirSync(SERVICE_DIR, { recursive: true });
  }
  
  // Создаем временную директорию для аудиофайлов
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    console.log(`Creating temp directory: ${tempDir}`);
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Создаем директорию для логов
  const logDir = path.dirname(LOG_FILE);
  if (!fs.existsSync(logDir)) {
    console.log(`Creating log directory: ${logDir}`);
    fs.mkdirSync(logDir, { recursive: true });
  }
}

/**
 * Запускает сервис диаризации
 */
function startService() {
  // Убеждаемся, что все директории существуют
  ensureDirectoriesExist();
  
  // Проверяем существование скрипта
  if (!fs.existsSync(SCRIPT_PATH)) {
    console.error(`Error: Diarization service script not found at ${SCRIPT_PATH}`);
    return;
  }
  
  console.log(`Starting simplified diarization service on port ${PORT}...`);
  console.log(`Log file: ${LOG_FILE}`);
  
  // Добавляем заголовок запуска в лог
  const startLine = `\n\n=== DIARIZATION SERVICE STARTED AT ${new Date().toISOString()} ===\n\n`;
  fs.appendFileSync(LOG_FILE, startLine);
  
  // Запускаем сервис с python
  const serviceProcess = spawn('python', [SCRIPT_PATH, '--port', PORT.toString()], {
    cwd: SERVICE_DIR,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  // Перенаправляем вывод в лог-файл
  serviceProcess.stdout.on('data', (data) => {
    fs.appendFileSync(LOG_FILE, data.toString());
  });
  
  serviceProcess.stderr.on('data', (data) => {
    fs.appendFileSync(LOG_FILE, data.toString());
  });
  
  // Сохраняем PID процесса
  fs.writeFileSync(PID_FILE, `${serviceProcess.pid}`);
  
  console.log(`Diarization service started with PID: ${serviceProcess.pid}`);
  
  // Отключаем родительский процесс от дочернего
  serviceProcess.unref();
  
  // Сообщаем об успешном запуске
  console.log('The simplified diarization service is now running in the background.');
  console.log(`Service URL: http://localhost:${PORT}`);
}

// Запускаем сервис
try {
  startService();
} catch (error) {
  console.error('Error starting diarization service:', error);
}