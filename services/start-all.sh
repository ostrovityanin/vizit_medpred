#!/bin/bash

# Скрипт для запуска всех микросервисов проекта

echo "Запуск всех микросервисов..."

# Определяем базовую директорию
BASE_DIR="$(dirname "$0")"
cd "$BASE_DIR"

# Запускаем GPT-4o Audio Preview микросервис, если он существует
if [ -d "gpt4o-audio-service" ]; then
  echo "Запускаем GPT-4o Audio микросервис..."
  cd gpt4o-audio-service
  ./start.sh
  cd ..
  echo "GPT-4o Audio микросервис запущен"
fi

# Здесь можно добавить запуск других микросервисов

echo "Все микросервисы запущены"