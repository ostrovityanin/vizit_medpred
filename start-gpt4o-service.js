/**
 * Скрипт для запуска микросервиса GPT-4o Audio
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Путь к директории микросервиса
const servicePath = path.join(__dirname, 'services', 'gpt4o-audio-service');
const pidFile = path.join(__dirname, 'gpt4o-service.pid');

// Проверка существования директории
if (!fs.existsSync(servicePath)) {
  console.error(`Директория микросервиса не найдена: ${servicePath}`);
  process.exit(1);
}

// Запуск микросервиса
console.log('Запуск микросервиса GPT-4o Audio...');
const child = spawn('node', ['src/index.js'], {
  cwd: servicePath,
  detached: true,
  stdio: 'inherit'
});

// Сохранение PID процесса
fs.writeFileSync(pidFile, child.pid.toString());

console.log(`Микросервис запущен с PID: ${child.pid}`);
console.log(`Для остановки выполните: node stop-gpt4o-service.js`);

// Освобождаем процесс от родительского
child.unref();