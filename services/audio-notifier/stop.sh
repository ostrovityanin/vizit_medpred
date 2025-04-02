#!/bin/bash

# Скрипт остановки микросервиса audio-notifier
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# Проверяем, запущен ли сервис
PID_FILE="audio-notifier.pid"
if [ ! -f "$PID_FILE" ]; then
    echo "Микросервис audio-notifier не запущен"
    exit 0
fi

PID=$(cat "$PID_FILE")
if ! ps -p $PID > /dev/null 2>&1; then
    echo "Микросервис audio-notifier не запущен (процесс $PID не существует)"
    rm "$PID_FILE"
    exit 0
fi

# Останавливаем сервис
echo "Остановка микросервиса audio-notifier (PID: $PID)..."
kill $PID
sleep 2

# Проверяем, остановился ли процесс
if ps -p $PID > /dev/null 2>&1; then
    echo "Принудительная остановка микросервиса audio-notifier (PID: $PID)..."
    kill -9 $PID
    sleep 1
fi

# Удаляем PID файл
rm "$PID_FILE"
echo "Микросервис audio-notifier остановлен"