#!/bin/bash

# Скрипт для запуска сервиса GPT-4o Audio

# Определяем директорию, в которой находится скрипт
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Проверяем наличие .env файла
if [ ! -f .env ]; then
  echo "Ошибка: Файл .env не найден!"
  echo "Пожалуйста, создайте файл .env на основе .env.example"
  exit 1
fi

# Проверяем зависимости
if ! command -v node &> /dev/null; then
  echo "Ошибка: Node.js не установлен!"
  exit 1
fi

# Проверяем наличие OpenAI API ключа в .env
if ! grep -q "OPENAI_API_KEY" .env || grep -q "OPENAI_API_KEY=sk-your-openai-api-key" .env; then
  echo "Предупреждение: OpenAI API ключ не настроен или имеет значение по умолчанию в файле .env"
  echo "Функциональность транскрипции может быть недоступна"
fi

# Проверка существования директорий
mkdir -p logs temp uploads

# Запускаем сервис в фоновом режиме
echo "Запуск сервиса GPT-4o Audio..."
node src/index.js > logs/service.log 2>&1 &
PID=$!

# Запоминаем PID процесса
echo $PID > .service.pid

echo "Сервис запущен с PID: $PID"
echo "Логи доступны в: $SCRIPT_DIR/logs/service.log"

# Отображаем последние логи (опционально)
echo ""
echo "Последние логи:"
tail -n 10 logs/service.log

# Проверяем, запущен ли сервис
sleep 2
if ps -p $PID > /dev/null; then
  echo ""
  echo "Сервис успешно запущен!"
  echo "Для остановки сервиса используйте: ./stop.sh"
else
  echo ""
  echo "Ошибка: Сервис не запустился!"
  echo "Проверьте логи: $SCRIPT_DIR/logs/service.log"
  exit 1
fi