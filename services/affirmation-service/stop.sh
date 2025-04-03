#!/bin/bash

# Скрипт для остановки микросервиса аффирмаций

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PID_FILE="$SCRIPT_DIR/affirmation-service.pid"

# Проверяем существование PID файла
if [ ! -f "$PID_FILE" ]; then
  echo "Микросервис аффирмаций не запущен (PID файл не найден)"
  exit 0
fi

# Читаем PID из файла
PID=$(cat "$PID_FILE")

# Проверяем, существует ли процесс с таким PID
if ps -p $PID > /dev/null; then
  echo "Останавливаем микросервис аффирмаций (PID: $PID)..."
  kill $PID
  
  # Ждем завершения процесса
  WAIT_SECONDS=5
  for ((i=0; i<$WAIT_SECONDS; i++)); do
    if ! ps -p $PID > /dev/null; then
      echo "Микросервис аффирмаций успешно остановлен"
      rm "$PID_FILE"
      exit 0
    fi
    sleep 1
  done
  
  # Если процесс не завершился - используем SIGKILL
  echo "Процесс не остановился через $WAIT_SECONDS секунд, принудительная остановка..."
  kill -9 $PID
  if ! ps -p $PID > /dev/null; then
    echo "Микросервис аффирмаций принудительно остановлен"
    rm "$PID_FILE"
    exit 0
  else
    echo "Не удалось остановить микросервис аффирмаций"
    exit 1
  fi
else
  echo "Процесс не найден, но PID файл существует. Удаляем PID файл."
  rm "$PID_FILE"
  exit 0
fi