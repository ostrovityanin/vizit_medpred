#!/bin/bash
# Скрипт для запуска и мониторинга микросервиса GPT-4o Audio

# Путь к директории микросервиса
SERVICE_DIR="./services/gpt4o-audio-service"
LOG_FILE="$SERVICE_DIR/logs/service.log"
PID_FILE="$SERVICE_DIR/service.pid"

# Создаем директории, если они не существуют
mkdir -p "$SERVICE_DIR/logs" "$SERVICE_DIR/uploads"

# Останавливаем предыдущий запуск, если он был
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if ps -p "$PID" > /dev/null; then
    echo "Останавливаем предыдущий процесс (PID: $PID)..."
    kill "$PID"
    sleep 2
  fi
  rm -f "$PID_FILE"
fi

# Запускаем микросервис с перенаправлением stdout и stderr в log-файл
echo "Запуск GPT-4o Audio сервиса..."
cd "$SERVICE_DIR" && node src/index.js > "$LOG_FILE" 2>&1 &

# Сохраняем PID процесса
echo $! > "$PID_FILE"
echo "Сервис запущен с PID: $(cat "$PID_FILE")"
echo "Логи доступны в файле: $LOG_FILE"

# Показываем логи в реальном времени
echo "Вывод логов в реальном времени (Ctrl+C для выхода):"
tail -f "$LOG_FILE"