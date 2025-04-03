/**
 * Скрипт для запуска микросервиса аудио-диаризации
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Конфигурация микросервиса
const SERVICE_DIR = path.join(__dirname, 'services', 'audio-diarization');
const SERVICE_SCRIPT = path.join(SERVICE_DIR, 'run.py');
const LOG_FILE = path.join(__dirname, 'diarization-service.log');
const PID_FILE = path.join(__dirname, 'diarization-service.pid');

/**
 * Проверка, запущен ли сервис
 * @returns {boolean} Запущен ли сервис
 */
function isServiceRunning() {
  if (!fs.existsSync(PID_FILE)) {
    return false;
  }
  
  const pid = fs.readFileSync(PID_FILE, 'utf-8').trim();
  
  try {
    // Проверяем существует ли процесс с таким PID
    // В Unix команда kill -0 проверяет существование процесса без его остановки
    process.kill(parseInt(pid, 10), 0);
    return true;
  } catch (e) {
    // Процесс не существует
    return false;
  }
}

/**
 * Создание необходимых директорий
 */
function ensureDirectoriesExist() {
  // Проверяем наличие директории сервиса
  if (!fs.existsSync(SERVICE_DIR)) {
    fs.mkdirSync(SERVICE_DIR, { recursive: true });
  }
  
  // Создаем основные поддиректории
  const dirs = [
    path.join(SERVICE_DIR, 'src'),
    path.join(SERVICE_DIR, 'utils'),
    path.join(SERVICE_DIR, 'temp')
  ];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Запуск микросервиса
 */
function startService() {
  // Проверяем, запущен ли уже сервис
  if (isServiceRunning()) {
    console.log('Микросервис аудио-диаризации уже запущен');
    return;
  }
  
  console.log('Запуск микросервиса аудио-диаризации...');
  ensureDirectoriesExist();
  
  // Открываем файл для логирования
  const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  
  // Записываем время запуска в лог
  const timestamp = new Date().toISOString();
  logStream.write(`\n\n=== Запуск микросервиса аудио-диаризации ${timestamp} ===\n\n`);
  
  // Запускаем Python скрипт
  const python = process.platform === 'win32' ? 'python' : 'python3';
  const serviceProcess = spawn(python, [SERVICE_SCRIPT], {
    cwd: SERVICE_DIR,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1' // Отключаем буферизацию вывода Python
    }
  });
  
  // Записываем PID процесса в файл
  fs.writeFileSync(PID_FILE, serviceProcess.pid.toString());
  
  // Логируем stdout
  serviceProcess.stdout.on('data', (data) => {
    const output = data.toString();
    logStream.write(output);
    console.log(`[Диаризация] ${output.trim()}`);
  });
  
  // Логируем stderr
  serviceProcess.stderr.on('data', (data) => {
    const output = data.toString();
    logStream.write(`[ERR] ${output}`);
    console.error(`[Диаризация ERR] ${output.trim()}`);
  });
  
  // Обрабатываем завершение процесса
  serviceProcess.on('close', (code) => {
    logStream.write(`\n=== Микросервис аудио-диаризации завершился с кодом: ${code} ===\n`);
    logStream.end();
    
    // Удаляем PID файл, если процесс завершился
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
    
    console.log(`Микросервис аудио-диаризации завершил работу с кодом: ${code}`);
  });
  
  console.log(`Микросервис аудио-диаризации запущен с PID: ${serviceProcess.pid}`);
  console.log(`Логи записываются в: ${LOG_FILE}`);
}

// Запускаем микросервис
startService();