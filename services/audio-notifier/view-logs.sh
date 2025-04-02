#!/bin/bash

# Скрипт для просмотра логов микросервиса audio-notifier
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

LOG_FILE="logs/audio-notifier.log"

# Проверяем, существует ли файл логов
if [ ! -f "$LOG_FILE" ]; then
    echo "Файл логов не найден: $LOG_FILE"
    exit 1
fi

# Определяем, какую команду использовать для просмотра логов
if command -v tail > /dev/null 2>&1; then
    # Если доступна команда tail, используем ее с опцией -f для отслеживания новых записей
    echo "Отображение последних записей из логов (Ctrl+C для выхода):"
    tail -f "$LOG_FILE"
else
    # Иначе просто выводим содержимое файла логов
    echo "Содержимое файла логов:"
    cat "$LOG_FILE"
fi