#!/bin/bash

# Скрипт для остановки сервиса мониторинга

# Директория, в которой находится скрипт
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Текущее время для лога
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Проверяем, запущен ли сервис
PID_FILE="./monitor.pid"
if [ ! -f "$PID_FILE" ]; then
  echo "$TIMESTAMP - PID файл не найден, сервис не запущен"
  exit 1
fi

# Получаем PID процесса
PID=$(cat $PID_FILE)

# Проверяем, существует ли процесс
if ! ps -p $PID > /dev/null; then
  echo "$TIMESTAMP - Процесс с PID $PID не найден, удаляем PID файл"
  rm $PID_FILE
  exit 1
fi

# Останавливаем процесс
echo "$TIMESTAMP - Остановка сервиса мониторинга с PID $PID..."
kill $PID

# Проверяем успешность остановки через 3 секунды
sleep 3
if ps -p $PID > /dev/null; then
  echo "$TIMESTAMP - Сервис не остановился корректно, принудительная остановка..."
  kill -9 $PID
  sleep 1
fi

# Проверяем, что процесс остановлен
if ps -p $PID > /dev/null; then
  echo "$TIMESTAMP - Не удалось остановить сервис мониторинга"
  exit 1
else
  echo "$TIMESTAMP - Сервис мониторинга успешно остановлен"
  rm $PID_FILE
fi

# Успешное завершение
exit 0