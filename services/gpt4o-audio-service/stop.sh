#!/bin/bash

# Скрипт для остановки сервиса GPT-4o Audio

# Определяем директорию, в которой находится скрипт
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Проверяем наличие файла с PID
if [ ! -f .service.pid ]; then
  echo "Сервис не запущен или файл с PID не найден"
  exit 0
fi

# Получаем PID процесса
PID=$(cat .service.pid)

# Проверяем, запущен ли процесс
if ! ps -p $PID > /dev/null; then
  echo "Процесс с PID $PID не найден"
  rm -f .service.pid
  exit 0
fi

# Останавливаем процесс
echo "Останавливаем сервис GPT-4o Audio (PID: $PID)..."
kill $PID

# Ждем завершения процесса
MAX_WAIT=10
WAITED=0
while ps -p $PID > /dev/null && [ $WAITED -lt $MAX_WAIT ]; do
  sleep 1
  WAITED=$((WAITED + 1))
  echo "Ожидание завершения процесса... ($WAITED/$MAX_WAIT)"
done

# Проверяем, завершился ли процесс
if ps -p $PID > /dev/null; then
  echo "Процесс не завершился корректно, принудительно завершаем..."
  kill -9 $PID
  sleep 1
fi

# Удаляем файл с PID
rm -f .service.pid

echo "Сервис GPT-4o Audio остановлен"