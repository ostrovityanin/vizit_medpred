#!/bin/bash

# Скрипт для просмотра логов микросервиса аффирмаций

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/affirmation-service.log"
ERROR_LOG_FILE="$LOG_DIR/affirmation-service-error.log"
CONSOLE_LOG_FILE="$LOG_DIR/affirmation-service-console.log"

# Проверяем существование директории логов
if [ ! -d "$LOG_DIR" ]; then
  echo "Директория логов не найдена: $LOG_DIR"
  exit 1
fi

# Функция для просмотра логов с определенным тэгом
view_logs() {
  local log_file=$1
  local lines=${2:-50}
  local title=$3
  
  if [ -f "$log_file" ]; then
    echo "=== $title (последние $lines строк) ==="
    tail -n $lines "$log_file"
    echo ""
  else
    echo "Файл логов не найден: $log_file"
  fi
}

# Отображаем все типы логов
if [ "$1" == "error" ]; then
  view_logs "$ERROR_LOG_FILE" 100 "Ошибки микросервиса аффирмаций"
elif [ "$1" == "console" ]; then
  view_logs "$CONSOLE_LOG_FILE" 100 "Вывод консоли микросервиса аффирмаций"
else
  view_logs "$LOG_FILE" 50 "Логи микросервиса аффирмаций"
  view_logs "$ERROR_LOG_FILE" 20 "Ошибки микросервиса аффирмаций"
  view_logs "$CONSOLE_LOG_FILE" 10 "Вывод консоли микросервиса аффирмаций"
fi

# Показываем статус сервиса
PID_FILE="$SCRIPT_DIR/affirmation-service.pid"
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if ps -p $PID > /dev/null; then
    echo "Микросервис аффирмаций запущен (PID: $PID)"
  else
    echo "Микросервис аффирмаций не запущен (PID файл существует, но процесс не найден)"
  fi
else
  echo "Микросервис аффирмаций не запущен (PID файл не найден)"
fi