#!/bin/bash

# Скрипт запуска микросервиса audio-notifier
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# Создаем необходимые директории
mkdir -p temp data logs

# Проверяем, запущен ли уже сервис
PID_FILE="audio-notifier.pid"
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo "Микросервис audio-notifier уже запущен (PID: $PID)"
        exit 0
    else
        # Удаляем старый PID файл, так как процесс уже не существует
        rm "$PID_FILE"
    fi
fi

# Запускаем сервис в фоновом режиме
echo "Запуск микросервиса audio-notifier..."
node src/index.js > logs/audio-notifier.log 2>&1 &
PID=$!
echo $PID > "$PID_FILE"
echo "Микросервис audio-notifier запущен (PID: $PID)"
echo "Логи доступны в файле logs/audio-notifier.log"