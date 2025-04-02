#!/bin/bash

# Скрипт для запуска микросервиса audio-notifier
echo "Запуск микросервиса отправки аудио в Telegram..."

# Переходим в директорию микросервиса
cd "$(dirname "$0")"

# Проверяем наличие узла node.js
if ! command -v node &> /dev/null; then
    echo "Ошибка: Node.js не установлен"
    exit 1
fi

# Проверяем наличие необходимых переменных окружения
if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
    echo "Ошибка: Не установлены переменные окружения TELEGRAM_BOT_TOKEN и/или TELEGRAM_CHAT_ID"
    echo "Пожалуйста, установите их перед запуском микросервиса"
    exit 1
fi

# Проверяем наличие зависимостей
if [ ! -d "node_modules" ]; then
    echo "Установка зависимостей..."
    npm install
fi

# Создаем директории для данных и временных файлов
mkdir -p data temp logs

# Запускаем микросервис в фоновом режиме
echo "Запуск сервиса..."
node src/index.js > logs/audio-notifier-console.log 2>&1 &

# Сохраняем PID процесса
echo $! > ".pid"
echo "Микросервис запущен с PID: $!"
echo "Логи доступны в директории: logs/"