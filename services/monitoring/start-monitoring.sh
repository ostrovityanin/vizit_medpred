#!/bin/bash

# Скрипт для запуска сервиса мониторинга

# Путь к директории мониторинга
MONITORING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Проверка наличия .env файла
if [ ! -f "${MONITORING_DIR}/.env" ]; then
  echo "Ошибка: .env файл не найден. Проверьте наличие файла ${MONITORING_DIR}/.env"
  exit 1
fi

# Создание директории для логов, если она не существует
mkdir -p "${MONITORING_DIR}/logs"

# Проверка настроек Telegram
TELEGRAM_BOT_TOKEN=$(grep "TELEGRAM_BOT_TOKEN" "${MONITORING_DIR}/.env" | cut -d '=' -f2)
TELEGRAM_CHAT_ID=$(grep "TELEGRAM_CHAT_ID" "${MONITORING_DIR}/.env" | cut -d '=' -f2)

if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
  echo "Предупреждение: Настройки Telegram бота не найдены в .env файле"
  echo "Уведомления через Telegram будут недоступны"
fi

# Запуск сервиса мониторинга
echo "Запуск сервиса мониторинга..."
cd "$MONITORING_DIR" && node src/index.js > "${MONITORING_DIR}/logs/monitoring.log" 2>&1 &
PID=$!

# Сохранение PID процесса
echo $PID > "${MONITORING_DIR}/monitoring.pid"
echo "Сервис мониторинга запущен (PID: $PID)"
echo "Логи доступны в файле: ${MONITORING_DIR}/logs/monitoring.log"
echo "Для просмотра логов используйте: ./view-logs.sh"
echo "Для остановки сервиса используйте: ./stop-monitoring.sh"