#!/bin/bash

# Скрипт для запуска всех микросервисов без использования Docker

# Путь к основной директории микросервисов
SERVICES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Функция для запуска сервиса
start_service() {
  local service_name=$1
  local service_dir="${SERVICES_DIR}/${service_name}"
  
  echo "Запуск сервиса: ${service_name}"
  
  # Проверка существования директории сервиса
  if [ ! -d "$service_dir" ]; then
    echo "Ошибка: Директория сервиса '$service_name' не найдена"
    return 1
  fi
  
  # Проверка наличия package.json
  if [ ! -f "${service_dir}/package.json" ]; then
    echo "Предупреждение: Файл package.json не найден в ${service_dir}"
  fi
  
  # Запуск сервиса в фоновом режиме
  cd "$service_dir" && npm start > "${service_dir}/service.log" 2>&1 &
  local pid=$!
  
  # Сохранение PID процесса
  echo $pid > "${service_dir}/service.pid"
  echo "Сервис ${service_name} запущен (PID: $pid)"
}

# Запуск всех сервисов
echo "Запуск микросервисной архитектуры..."

# Запуск сервиса мониторинга в первую очередь
if [ -d "${SERVICES_DIR}/monitoring" ]; then
  start_service "monitoring"
  # Задержка для инициализации мониторинга
  sleep 2
else
  echo "Сервис мониторинга не найден"
fi

# Запуск остальных сервисов
for service_dir in "${SERVICES_DIR}"/*; do
  if [ -d "$service_dir" ]; then
    service_name=$(basename "$service_dir")
    # Пропускаем мониторинг, так как он уже запущен
    if [ "$service_name" != "monitoring" ]; then
      start_service "$service_name"
    fi
  fi
done

echo "Все микросервисы запущены. Для остановки используйте: ./stop-all.sh"