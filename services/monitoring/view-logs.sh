#!/bin/bash

LOG_FILE="logs/combined.log"
CONSOLE_LOG="logs/console.log"

# Проверяем доступность файлов логов
if [ -f "$LOG_FILE" ]; then
  echo "=== Последние 20 записей из лога ($LOG_FILE): ==="
  tail -n 20 "$LOG_FILE"
  echo ""
else
  echo "Файл $LOG_FILE не найден."
fi

if [ -f "$CONSOLE_LOG" ]; then
  echo "=== Последние 20 записей из консоли ($CONSOLE_LOG): ==="
  tail -n 20 "$CONSOLE_LOG"
  echo ""
else
  echo "Файл $CONSOLE_LOG не найден."
fi

# Проверяем статус сервиса
if pgrep -f "node src/index.js" > /dev/null; then
  echo "Сервис мониторинга запущен. PID: $(pgrep -f 'node src/index.js')"
  
  # Пробуем получить информацию о порте
  PORT=$(grep -o "Сервис мониторинга запущен на порту [0-9]*" "$CONSOLE_LOG" | tail -n 1 | grep -o "[0-9]*$")
  if [ -n "$PORT" ]; then
    echo "Порт: $PORT"
    echo "URL: http://localhost:$PORT"
  else
    echo "Порт не определен."
  fi
  
  # Получаем информацию о режиме отправки сообщений в Telegram
  if grep -q "Отправка отчетов в Telegram запланирована" "$CONSOLE_LOG"; then
    echo "Отправка отчетов в Telegram: Активна"
  else
    echo "Отправка отчетов в Telegram: Не настроена"
  fi
else
  echo "Сервис мониторинга не запущен."
fi

# Показываем последние записи из файла статусов
STATUS_DIR="status_logs"
if [ -d "$STATUS_DIR" ]; then
  LATEST_STATUS=$(ls -t "$STATUS_DIR"/*.json 2>/dev/null | head -n 1)
  if [ -n "$LATEST_STATUS" ]; then
    echo ""
    echo "=== Последний файл статуса: $(basename "$LATEST_STATUS") ==="
    echo "Записи: $(grep -c "timestamp" "$LATEST_STATUS")"
    echo "Последнее обновление: $(stat -c %y "$LATEST_STATUS")"
  else
    echo ""
    echo "Файлы статуса не найдены в директории $STATUS_DIR"
  fi
else
  echo ""
  echo "Директория статусов $STATUS_DIR не найдена."
fi