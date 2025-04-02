#!/bin/bash

# Скрипт для запуска мониторинга в фоновом режиме
echo "Запуск сервиса мониторинга..."

# Проверяем наличие необходимых зависимостей
if ! npm list | grep -q "node-telegram-bot-api"; then
  echo "Установка зависимостей..."
  npm install node-telegram-bot-api dotenv axios cron
fi

# Запускаем мониторинг и перенаправляем вывод в лог-файл
nohup node services/simple-monitor.js > monitoring.log 2>&1 &
PID=$!

echo "Мониторинг запущен с PID: $PID"
echo $PID > monitoring.pid
echo "Логи сохраняются в monitoring.log"
echo "Для остановки используйте: bash services/stop-monitoring.sh"