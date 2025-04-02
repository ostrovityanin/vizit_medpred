/**
 * Скрипт для запуска микросервиса GPT-4o Audio
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Путь к директории микросервиса
const serviceDir = './services/gpt4o-audio-service';
// PID файл для отслеживания процесса
const pidFile = path.join(serviceDir, 'service.pid');

// Функция для проверки, запущен ли уже сервис
function isServiceRunning() {
  if (fs.existsSync(pidFile)) {
    try {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
      // Проверяем, существует ли процесс с таким PID
      process.kill(pid, 0);
      return true;
    } catch (e) {
      // Если процесс не существует, удаляем PID файл
      fs.unlinkSync(pidFile);
      return false;
    }
  }
  return false;
}

// Функция для создания необходимых директорий
function ensureDirectoriesExist() {
  const dirs = [
    path.join(serviceDir, 'logs'),
    path.join(serviceDir, 'uploads'),
    path.join(serviceDir, 'uploads/temp')
  ];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      console.log(`Создание директории: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// Функция для запуска сервиса
function startService() {
  if (isServiceRunning()) {
    console.log('Сервис GPT-4o Audio уже запущен');
    return;
  }

  // Создаем необходимые директории
  ensureDirectoriesExist();

  console.log('Запуск сервиса GPT-4o Audio...');

  // Получаем переменные окружения из основного процесса
  const env = { 
    ...process.env,
    PORT: 3100  // Устанавливаем порт 3100 для микросервиса
  };
  
  // Запускаем микросервис
  const service = spawn('node', ['src/index.js'], {
    cwd: serviceDir,
    stdio: 'inherit',
    detached: true,
    env: env
  });

  // Записываем PID процесса в файл
  fs.writeFileSync(pidFile, service.pid.toString());

  console.log(`Сервис GPT-4o Audio запущен (PID: ${service.pid}) на порту 3100`);
  
  // Отключаем родительский процесс от дочернего
  service.unref();
}

// Запуск сервиса
startService();