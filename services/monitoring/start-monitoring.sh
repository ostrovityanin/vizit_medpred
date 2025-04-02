#!/bin/bash

# Скрипт для запуска сервиса мониторинга в фоновом режиме

# Директория, в которой находится скрипт
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Текущее время для лога
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Создаем директории для логов, если не существуют
mkdir -p logs
mkdir -p status_logs

# Проверяем, установлены ли зависимости
if [ ! -d "node_modules" ]; then
  echo "$TIMESTAMP - Установка зависимостей..."
  npm install
fi

# Проверяем, запущен ли уже сервис
PID_FILE="./monitor.pid"
if [ -f "$PID_FILE" ]; then
  PID=$(cat $PID_FILE)
  if ps -p $PID > /dev/null; then
    echo "$TIMESTAMP - Сервис мониторинга уже запущен с PID $PID"
    exit 1
  else
    echo "$TIMESTAMP - Обнаружен устаревший PID файл, удаляем..."
    rm $PID_FILE
  fi
fi

# Время начала работы сервиса
export SERVICE_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Запускаем сервис в фоновом режиме
echo "$TIMESTAMP - Запуск сервиса мониторинга..."
nohup node src/index.js > logs/monitor.log 2>&1 &

# Сохраняем PID процесса
echo $! > $PID_FILE

# Проверяем успешность запуска через 2 секунды
sleep 2
if ps -p $(cat $PID_FILE) > /dev/null; then
  echo "$TIMESTAMP - Сервис мониторинга успешно запущен с PID $(cat $PID_FILE)"
  echo "$TIMESTAMP - Лог доступен в файле: logs/monitor.log"
  echo "$TIMESTAMP - Веб-интерфейс доступен по адресу: http://localhost:3006"
else
  echo "$TIMESTAMP - Ошибка при запуске сервиса мониторинга"
  rm $PID_FILE
  exit 1
fi

# Успешное завершение
exit 0