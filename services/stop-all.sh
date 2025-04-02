#!/bin/bash

echo "Остановка всех микросервисов..."

# Остановка GPT-4o Audio Preview микросервиса
echo "Остановка GPT-4o Audio Preview микросервиса..."
cd ./gpt4o-audio-service
./stop.sh
cd ..

# Здесь будут остановки других микросервисов по мере их добавления
# echo "Остановка мониторинг-сервиса..."
# cd ./monitoring
# ./stop.sh
# cd ..

# echo "Остановка сервиса уведомлений..."
# cd ./audio-notifier
# ./stop.sh
# cd ..

echo "Все микросервисы остановлены!"