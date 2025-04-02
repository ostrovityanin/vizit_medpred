#!/bin/bash

# Скрипт для остановки всех микросервисов

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
echo -e "${BLUE}Остановка всех микросервисов${NC}"
echo -e "${BLUE}================================${NC}"

# Список директорий с микросервисами (в обратном порядке для корректной остановки)
services=(
  "gpt4o-audio-service"
  # Добавьте другие микросервисы по мере их создания
)

# Перебираем все сервисы и останавливаем их
for service in "${services[@]}"; do
  if [ -d "$service" ]; then
    echo -e "\n${YELLOW}Остановка $service...${NC}"
    
    # Проверяем наличие скрипта stop.sh
    if [ -f "$service/stop.sh" ]; then
      # Делаем скрипт исполняемым, если он еще не является таковым
      chmod +x "$service/stop.sh"
      
      # Останавливаем сервис
      cd "$service"
      ./stop.sh
      cd "$SCRIPT_DIR"
      
      echo -e "${GREEN}Сервис $service остановлен${NC}"
    else
      echo -e "${RED}Ошибка: скрипт stop.sh для сервиса $service не найден${NC}"
    fi
  else
    echo -e "${RED}Ошибка: директория $service не найдена${NC}"
  fi
done

echo -e "\n${GREEN}Все сервисы остановлены!${NC}"
echo -e "${BLUE}================================${NC}"