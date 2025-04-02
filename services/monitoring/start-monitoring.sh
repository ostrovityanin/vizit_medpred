#!/bin/bash

# Скрипт для запуска сервиса мониторинга в среде Replit

# Путь к директории мониторинга
MONITORING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Проверка наличия .env файла
if [ ! -f "${MONITORING_DIR}/.env" ]; then
  echo "Ошибка: .env файл не найден. Проверьте наличие файла ${MONITORING_DIR}/.env"
  exit 1
fi

# Получаем переменные окружения из Replit
# Если переменные не заданы в Replit, используем значения из .env файла для совместимости
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  export TELEGRAM_BOT_TOKEN=$(grep "TELEGRAM_BOT_TOKEN" "${MONITORING_DIR}/.env" | cut -d '=' -f2)
fi

if [ -z "$TELEGRAM_CHAT_ID" ]; then
  export TELEGRAM_CHAT_ID=$(grep "TELEGRAM_CHAT_ID" "${MONITORING_DIR}/.env" | cut -d '=' -f2)
fi

# Создание директории для логов, если она не существует
mkdir -p "${MONITORING_DIR}/logs"

# Проверка запущенного процесса
if [ -f "${MONITORING_DIR}/monitoring.pid" ]; then
  OLD_PID=$(cat "${MONITORING_DIR}/monitoring.pid")
  if ps -p $OLD_PID > /dev/null 2>&1; then
    echo "Сервис мониторинга уже запущен (PID: $OLD_PID)"
    echo "Для перезапуска сначала остановите сервис: ./stop-monitoring.sh"
    exit 0
  else
    echo "Найден PID-файл устаревшего процесса, он будет перезаписан"
  fi
fi

# Проверка настроек Telegram
if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
  echo "Предупреждение: Настройки Telegram бота не найдены в .env файле"
  echo "Уведомления через Telegram будут недоступны"
fi

# Запуск сервиса мониторинга
echo "Запуск сервиса мониторинга..."
cd "$MONITORING_DIR" && node src/index.js > "${MONITORING_DIR}/logs/monitoring.log" 2>&1 &
PID=$!

# Короткая пауза для запуска процесса
sleep 2

# Проверка, что процесс запустился
if ! ps -p $PID > /dev/null 2>&1; then
  echo "Ошибка: не удалось запустить сервис мониторинга"
  echo "Проверьте логи: ${MONITORING_DIR}/logs/monitoring.log"
  exit 1
fi

# Сохранение PID процесса
echo $PID > "${MONITORING_DIR}/monitoring.pid"
echo "Сервис мониторинга запущен (PID: $PID)"
echo "Логи доступны в файле: ${MONITORING_DIR}/logs/monitoring.log"
echo "Для просмотра логов используйте: ./view-logs.sh"
echo "Для остановки сервиса используйте: ./stop-monitoring.sh"