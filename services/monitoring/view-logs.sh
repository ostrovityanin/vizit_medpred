#!/bin/bash

# Скрипт для просмотра логов сервиса мониторинга

# Путь к директории мониторинга
MONITORING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${MONITORING_DIR}/logs/monitoring.log"
ERROR_LOG_FILE="${MONITORING_DIR}/logs/error.log"

# Обработка аргументов
follow_mode=false
error_mode=false

while getopts ":fe" opt; do
  case ${opt} in
    f )
      follow_mode=true
      ;;
    e )
      error_mode=true
      ;;
    \? )
      echo "Некорректный аргумент: -$OPTARG"
      echo "Использование: $0 [-f] [-e]"
      echo "  -f  Режим отслеживания (follow mode)"
      echo "  -e  Только ошибки"
      exit 1
      ;;
  esac
done

# Проверка существования лог-файла
if $error_mode; then
  if [ ! -f "$ERROR_LOG_FILE" ]; then
    echo "Лог-файл с ошибками не найден: $ERROR_LOG_FILE"
    exit 1
  fi
  
  if $follow_mode; then
    echo "Отслеживание файла ошибок в реальном времени. Нажмите Ctrl+C для выхода."
    tail -f "$ERROR_LOG_FILE"
  else
    echo "=== Последние ошибки из лога ==="
    tail -n 50 "$ERROR_LOG_FILE"
  fi
else
  if [ ! -f "$LOG_FILE" ]; then
    echo "Лог-файл не найден: $LOG_FILE"
    exit 1
  fi
  
  if $follow_mode; then
    echo "Отслеживание лога в реальном времени. Нажмите Ctrl+C для выхода."
    tail -f "$LOG_FILE"
  else
    echo "=== Последние записи из лога ==="
    tail -n 50 "$LOG_FILE"
  fi
fi