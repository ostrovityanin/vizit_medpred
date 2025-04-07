/**
 * Скрипт для запуска микросервиса аудио-диаризации
 * в фоновом режиме
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import axios from 'axios';

// Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Конфигурация микросервиса
const SERVICE_DIR = path.join(__dirname, 'services', 'audio-diarization');
const SERVICE_SCRIPT = path.join(SERVICE_DIR, 'run.py');
const LOG_FILE = path.join(__dirname, 'diarization-service.log');
const PID_FILE = path.join(SERVICE_DIR, 'diarization-service.pid');
const SERVICE_URL = 'http://localhost:5050';

/**
 * Проверка, запущен ли сервис
 * @returns {Promise<boolean>} Запущен ли сервис
 */
async function isServiceRunning() {
  try {
    // Сначала проверяем наличие PID файла
    if (!fs.existsSync(PID_FILE)) {
      return false;
    }
    
    const pid = fs.readFileSync(PID_FILE, 'utf-8').trim();
    
    try {
      // Проверяем существование процесса с указанным PID
      process.kill(parseInt(pid, 10), 0);
      
      // Проверяем, отвечает ли сервис на запросы
      const response = await axios.get(`${SERVICE_URL}/health`, { timeout: 2000 });
      return response.status === 200;
    } catch (e) {
      return false;
    }
  } catch (error) {
    console.error(`Ошибка при проверке статуса сервиса: ${error.message}`);
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
 * Проверка доступности сервиса через HTTP
 * @returns {Promise<boolean>} Доступен ли сервис
 */
async function checkServiceHealth() {
  try {
    const response = await axios.get(`${SERVICE_URL}/health`, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Запуск микросервиса
 */
async function startService() {
  // Проверяем, запущен ли уже сервис
  const serviceRunning = await isServiceRunning();
  if (serviceRunning) {
    console.log('✅ Микросервис аудио-диаризации уже запущен и отвечает на запросы');
    return;
  }
  
  console.log('🚀 Запуск микросервиса аудио-диаризации...');
  ensureDirectoriesExist();
  
  // Открываем файл для логирования
  const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  
  // Записываем время запуска в лог
  const timestamp = new Date().toISOString();
  logStream.write(`\n\n=== Запуск микросервиса аудио-диаризации ${timestamp} ===\n\n`);
  
  // Запускаем Python скрипт с отвязкой от терминала
  const python = process.platform === 'win32' ? 'python' : 'python3';
  const serviceProcess = spawn(python, [SERVICE_SCRIPT], {
    cwd: SERVICE_DIR,
    detached: true, // Отвязываем от родительского процесса
    stdio: ['ignore', 'pipe', 'pipe'], // Перенаправляем stdout и stderr, но игнорируем stdin
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
  
  // Отсоединяем процесс от родительского
  serviceProcess.unref();
  
  console.log(`✅ Микросервис аудио-диаризации запущен с PID: ${serviceProcess.pid}`);
  console.log(`📝 Логи записываются в: ${LOG_FILE}`);
  
  // Ждем запуска сервиса и проверяем доступность
  console.log('⏳ Ожидание запуска сервиса...');
  
  let attempts = 0;
  const maxAttempts = 10;
  let serviceAvailable = false;
  
  while (attempts < maxAttempts && !serviceAvailable) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 1000)); // Ждем 1 секунду
    serviceAvailable = await checkServiceHealth();
    
    if (serviceAvailable) {
      console.log(`✅ Сервис успешно запущен и отвечает на запросы (попытка ${attempts}/${maxAttempts})`);
    } else if (attempts < maxAttempts) {
      console.log(`⏳ Сервис еще не отвечает, ожидание... (попытка ${attempts}/${maxAttempts})`);
    }
  }
  
  if (!serviceAvailable) {
    console.error('❌ Не удалось дождаться запуска сервиса');
    
    // Проверяем, существует ли процесс
    try {
      process.kill(serviceProcess.pid, 0);
      console.log('⚠️ Процесс запущен, но не отвечает на HTTP запросы');
    } catch (e) {
      console.error('❌ Процесс не запущен или был завершен');
      
      // Удаляем PID файл, если процесс не существует
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
      }
    }
  }
}

// Запускаем микросервис и тестируем его
(async () => {
  await startService();
  
  // Тестируем доступность сервиса
  try {
    const response = await axios.get(`${SERVICE_URL}/health`);
    console.log(`\n📊 Статус сервиса диаризации:`);
    console.log(`   - Статус: ${response.data.status}`);
    console.log(`   - Время работы: ${response.data.uptime.toFixed(2)} сек`);
    console.log(`   - Временная метка: ${response.data.timestamp}`);
  } catch (error) {
    console.error(`\n❌ Не удалось получить статус сервиса: ${error.message}`);
  }
})();