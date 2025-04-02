#!/bin/bash

# Скрипт для просмотра логов мониторинга
if [ -f services/monitoring.log ]; then
    echo "===== Последние записи лога мониторинга ====="
    tail -n 50 services/monitoring.log
    
    echo ""
    echo "Для просмотра полного лога используйте: cat services/monitoring.log"
    echo "Для отслеживания лога в реальном времени: tail -f services/monitoring.log"
else
    echo "Файл лога мониторинга не найден"
    echo "Возможно, мониторинг ещё не запускался или был перемещён"
fi