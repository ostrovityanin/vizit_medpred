/**
 * Запуск микросервиса аудио-диаризации с настройкой перенаправления портов
 * 
 * Этот скрипт:
 * 1. Проверяет, что все необходимые директории существуют
 * 2. Запускает микросервис диаризации на порту 5050
 * 3. Отслеживает состояние сервиса и выводит статистику
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Конфигурация сервиса
const SERVICE_DIR = path.join(__dirname, 'services', 'audio-diarization');
const SERVICE_SCRIPT = path.join(SERVICE_DIR, 'run.py');
const LOG_FILE = path.join(__dirname, 'diarization-service.log');
const SERVICE_URL = 'http://localhost:5050';

// Начало логирования
console.log('=== Запуск микросервиса аудио-диаризации ===');
console.log(`Время: ${new Date().toISOString()}`);
console.log(`Рабочая директория: ${SERVICE_DIR}`);
console.log(`Скрипт сервиса: ${SERVICE_SCRIPT}`);
console.log(`Файл логов: ${LOG_FILE}`);

// Проверяем наличие необходимых директорий
function ensureDirectoriesExist() {
  const dirs = [
    SERVICE_DIR,
    path.join(SERVICE_DIR, 'temp'),
    path.join(SERVICE_DIR, 'uploads')
  ];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Создана директория: ${dir}`);
    }
  }
}

// Асинхронная функция для проверки доступности сервиса
async function checkServiceHealth() {
  try {
    const response = await axios.get(`${SERVICE_URL}/health`, { timeout: 5000 });
    return response.status === 200 ? response.data : null;
  } catch (error) {
    return null;
  }
}

// Функция для мониторинга сервиса
async function monitorService() {
  const healthStatus = await checkServiceHealth();
  
  if (healthStatus) {
    console.log(`\n📊 Статус сервиса диаризации (${new Date().toLocaleTimeString()}):`);
    console.log(`   - Статус: ${healthStatus.status}`);
    console.log(`   - Время работы: ${healthStatus.uptime.toFixed(2)} сек`);
    console.log(`   - Временная метка: ${healthStatus.timestamp}`);
    console.log(`   - URL: ${SERVICE_URL}\n`);
  } else {
    console.error(`\n❌ Сервис диаризации недоступен (${new Date().toLocaleTimeString()})\n`);
  }
}

// Основная функция запуска сервиса
function startService() {
  // Убеждаемся, что директории существуют
  ensureDirectoriesExist();
  
  // Открываем файл для логирования
  const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  
  // Записываем время запуска в лог
  const timestamp = new Date().toISOString();
  logStream.write(`\n\n=== Запуск микросервиса аудио-диаризации ${timestamp} ===\n\n`);
  
  console.log('🚀 Запускаем процесс...');
  
  // Запускаем Python скрипт
  const python = process.platform === 'win32' ? 'python' : 'python3';
  const serviceProcess = spawn(python, [SERVICE_SCRIPT], {
    cwd: SERVICE_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1'
    }
  });
  
  console.log(`✅ Процесс запущен с PID: ${serviceProcess.pid}`);
  
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
    const exitMessage = `\n=== Процесс завершен с кодом: ${code}, время: ${new Date().toISOString()} ===\n`;
    logStream.write(exitMessage);
    console.log(exitMessage);
    logStream.end();
    
    // Перезапускаем сервис при сбое
    if (code !== 0) {
      console.log('⚠️ Перезапуск сервиса через 5 секунд...');
      setTimeout(startService, 5000);
    }
  });
  
  // Устанавливаем интервал для мониторинга
  setInterval(monitorService, 30000); // Проверка каждые 30 секунд
  
  // Первая проверка через 5 секунд после запуска
  setTimeout(monitorService, 5000);
}

// Запускаем сервис
startService();