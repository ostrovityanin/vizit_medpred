#!/bin/bash

# Скрипт для запуска всех микросервисов

# Определяем директорию, в которой находится скрипт
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Запуск всех микросервисов${NC}"
echo -e "${BLUE}================================${NC}"

# Список директорий с микросервисами
services=(
  "gpt4o-audio-service"
  # Добавьте другие микросервисы по мере их создания
)

# Перебираем все сервисы и запускаем их
for service in "${services[@]}"; do
  if [ -d "$service" ]; then
    echo -e "\n${YELLOW}Запуск $service...${NC}"
    
    # Проверяем наличие скрипта start.sh
    if [ -f "$service/start.sh" ]; then
      # Делаем скрипт исполняемым, если он еще не является таковым
      chmod +x "$service/start.sh"
      
      # Запускаем сервис
      cd "$service"
      ./start.sh
      cd "$SCRIPT_DIR"
      
      echo -e "${GREEN}Сервис $service запущен${NC}"
    else
      echo -e "${RED}Ошибка: скрипт start.sh для сервиса $service не найден${NC}"
    fi
  else
    echo -e "${RED}Ошибка: директория $service не найдена${NC}"
  fi
done

echo -e "\n${GREEN}Все сервисы запущены!${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "Для остановки всех сервисов используйте: ${YELLOW}./stop-all.sh${NC}"