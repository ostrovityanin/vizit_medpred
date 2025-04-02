#!/bin/bash

echo "Запуск всех микросервисов..."

# Запуск GPT-4o Audio Preview микросервиса
echo "Запуск GPT-4o Audio Preview микросервиса..."
cd ./gpt4o-audio-service
./start.sh
cd ..

# Здесь будут запуски других микросервисов по мере их добавления
# echo "Запуск мониторинг-сервиса..."
# cd ./monitoring
# ./start.sh
# cd ..

# echo "Запуск сервиса уведомлений..."
# cd ./audio-notifier
# ./start.sh
# cd ..

echo "Все микросервисы запущены!"