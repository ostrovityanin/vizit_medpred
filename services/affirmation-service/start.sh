#!/bin/bash

# Скрипт для запуска микросервиса аффирмаций

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PID_FILE="$SCRIPT_DIR/affirmation-service.pid"
LOG_DIR="$SCRIPT_DIR/logs"

# Создаем директорию логов, если она не существует
mkdir -p "$LOG_DIR"

# Проверяем, запущен ли уже сервис
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if ps -p $PID > /dev/null; then
    echo "Микросервис аффирмаций уже запущен с PID: $PID"
    exit 1
  else
    echo "PID файл существует, но процесс не найден. Удаляем устаревший PID файл."
    rm "$PID_FILE"
  fi
fi

# Устанавливаем зависимости, если они еще не установлены
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo "Устанавливаем зависимости..."
  cd "$SCRIPT_DIR" && npm install
fi

# Запускаем микросервис
echo "Запуск микросервиса аффирмаций..."
cd "$SCRIPT_DIR" && node src/index.js > "$LOG_DIR/affirmation-service-console.log" 2>&1 &

# Сохраняем PID запущенного процесса
echo $! > "$PID_FILE"
echo "Микросервис аффирмаций запущен с PID: $(cat "$PID_FILE")"
echo "Логи доступны в директории: $LOG_DIR"