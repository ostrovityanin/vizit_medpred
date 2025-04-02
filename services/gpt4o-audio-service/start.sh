#!/bin/bash

echo "Запуск GPT-4o Audio Preview микросервиса..."

# Создаем директории, если они не существуют
mkdir -p uploads results logs

# Проверяем наличие .env
if [ ! -f .env ]; then
  echo "Файл .env не найден. Копирование из примера..."
  cp .env.example .env
  echo "ВНИМАНИЕ: Не забудьте установить ваш OPENAI_API_KEY в файле .env"
fi

# Проверяем, установлены ли зависимости
if [ ! -d "node_modules" ]; then
  echo "Установка зависимостей..."
  npm install
fi

# Запускаем сервис
echo "Запуск сервиса..."
node src/index.js > ./logs/gpt4o-service.log 2>&1 &

# Сохраняем PID процесса
echo $! > ./gpt4o-service.pid
echo "GPT-4o Audio Preview микросервис запущен (PID: $!)."
echo "Логи доступны в ./logs/gpt4o-service.log"