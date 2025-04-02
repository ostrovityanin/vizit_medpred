#!/bin/bash

echo "Остановка GPT-4o Audio Preview микросервиса..."

# Проверяем наличие файла с PID
if [ -f ./gpt4o-service.pid ]; then
  PID=$(cat ./gpt4o-service.pid)
  
  # Проверяем, запущен ли процесс
  if ps -p $PID > /dev/null; then
    echo "Завершение процесса с PID: $PID"
    kill $PID
    
    # Ждем завершения процесса
    sleep 2
    
    # Проверяем, завершился ли процесс
    if ps -p $PID > /dev/null; then
      echo "Процесс не завершился. Принудительное завершение..."
      kill -9 $PID
    fi
    
    echo "GPT-4o Audio Preview микросервис остановлен."
  else
    echo "Процесс с PID $PID не найден."
  fi
  
  # Удаляем файл с PID
  rm ./gpt4o-service.pid
else
  echo "Файл PID не найден. Сервис, возможно, не запущен."
  
  # Попытаемся найти процесс по названию
  PIDS=$(ps aux | grep "[n]ode src/index.js" | awk '{print $2}')
  
  if [ ! -z "$PIDS" ]; then
    echo "Найдены процессы, похожие на GPT-4o Audio Preview микросервис. Завершаем..."
    for pid in $PIDS; do
      echo "Завершение процесса с PID: $pid"
      kill $pid
    done
    echo "Процессы завершены."
  fi
fi