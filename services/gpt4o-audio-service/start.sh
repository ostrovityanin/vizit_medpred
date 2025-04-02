#!/bin/bash

# Скрипт для запуска GPT-4o Audio Preview микросервиса

# Переходим в директорию микросервиса
cd "$(dirname "$0")"

# Проверяем наличие .env файла
if [ ! -f .env ]; then
  echo "Файл .env не найден, копируем из .env.example"
  cp .env.example .env
  echo "Внимание: Необходимо настроить OPENAI_API_KEY в файле .env"
fi

# Проверяем наличие необходимых директорий
mkdir -p logs
mkdir -p temp

# Устанавливаем зависимости, если их нет
if [ ! -d "node_modules" ]; then
  echo "Устанавливаем зависимости..."
  npm install dotenv express multer cors winston @ffmpeg-installer/ffmpeg fluent-ffmpeg form-data node-fetch openai
fi

# Запускаем микросервис
echo "Запускаем GPT-4o Audio Preview микросервис..."
nohup node src/index.js > logs/service.log 2>&1 &

# Сохраняем PID процесса
echo $! > .pid
echo "Микросервис запущен с PID: $!"
echo "Логи доступны в файле: logs/service.log"
echo "Для остановки сервиса выполните: ./stop.sh"