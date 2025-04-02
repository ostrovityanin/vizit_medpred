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

// Функция для запуска сервиса
function startService() {
  if (isServiceRunning()) {
    console.log('Сервис GPT-4o Audio уже запущен');
    return;
  }

  console.log('Запуск сервиса GPT-4o Audio...');

  // Запускаем микросервис
  const service = spawn('node', ['src/index.js'], {
    cwd: serviceDir,
    stdio: 'inherit',
    detached: true
  });

  // Записываем PID процесса в файл
  fs.writeFileSync(pidFile, service.pid.toString());

  console.log(`Сервис GPT-4o Audio запущен (PID: ${service.pid})`);
  
  // Отключаем родительский процесс от дочернего
  service.unref();
}

// Запуск сервиса
startService();