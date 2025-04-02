#!/bin/bash

# Скрипт для остановки всех микросервисов

# Путь к основной директории микросервисов
SERVICES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Функция для остановки сервиса
stop_service() {
  local service_name=$1
  local service_dir="${SERVICES_DIR}/${service_name}"
  local pid_file="${service_dir}/service.pid"
  
  echo "Остановка сервиса: ${service_name}"
  
  # Проверка существования pid файла
  if [ ! -f "$pid_file" ]; then
    echo "Предупреждение: PID файл не найден для сервиса ${service_name}"
    return 1
  fi
  
  # Чтение PID из файла
  local pid=$(cat "$pid_file")
  
  # Проверка существования процесса
  if ! ps -p $pid > /dev/null; then
    echo "Процесс (PID: $pid) для сервиса ${service_name} не найден"
    rm -f "$pid_file"
    return 1
  fi
  
  # Останавливаем процесс
  kill $pid
  echo "Отправлена команда завершения сервису ${service_name} (PID: $pid)"
  
  # Ожидаем завершения процесса
  for i in {1..5}; do
    if ! ps -p $pid > /dev/null; then
      echo "Сервис ${service_name} успешно остановлен"
      rm -f "$pid_file"
      return 0
    fi
    sleep 1
  done
  
  # Если процесс не остановился, принудительно завершаем
  echo "Сервис ${service_name} не остановился, принудительное завершение"
  kill -9 $pid
  rm -f "$pid_file"
}

# Остановка всех сервисов
echo "Остановка микросервисной архитектуры..."

# Сначала останавливаем все сервисы кроме мониторинга
for service_dir in "${SERVICES_DIR}"/*; do
  if [ -d "$service_dir" ]; then
    service_name=$(basename "$service_dir")
    if [ "$service_name" != "monitoring" ]; then
      stop_service "$service_name"
    fi
  fi
done

# В последнюю очередь останавливаем мониторинг
if [ -d "${SERVICES_DIR}/monitoring" ]; then
  stop_service "monitoring"
else
  echo "Сервис мониторинга не найден"
fi

echo "Все микросервисы остановлены."