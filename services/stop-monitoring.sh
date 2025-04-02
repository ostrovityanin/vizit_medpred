#!/bin/bash

# Скрипт для остановки сервиса мониторинга
echo "Остановка сервиса мониторинга..."

if [ -f services/monitoring.pid ]; then
    PID=$(cat services/monitoring.pid)
    if ps -p $PID > /dev/null; then
        echo "Останавливаем процесс с PID: $PID"
        kill $PID
        rm services/monitoring.pid
        echo "Мониторинг остановлен"
    else
        echo "Процесс мониторинга не найден"
        rm services/monitoring.pid
    fi
else
    echo "Файл PID не найден, мониторинг не запущен"
fi

# Поиск всех процессов node с simple-monitor.js и их остановка
echo "Поиск всех процессов мониторинга..."
pids=$(ps aux | grep "node.*simple-monitor.js" | grep -v grep | awk '{print $2}')

if [ -n "$pids" ]; then
    echo "Найдены дополнительные процессы мониторинга: $pids"
    kill $pids
    echo "Все процессы мониторинга остановлены"
else
    echo "Дополнительные процессы мониторинга не найдены"
fi