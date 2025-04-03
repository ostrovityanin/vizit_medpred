"""
Модуль для настройки логирования.

Предоставляет функции для создания и настройки логгеров.
"""

import os
import logging
import sys
from pathlib import Path

def setup_logger(name, log_file=None, level=logging.INFO):
    """
    Настройка логгера с форматированием.
    
    Args:
        name: имя логгера
        log_file: путь к файлу логов (если None, логи выводятся только в консоль)
        level: уровень логирования
        
    Returns:
        logger: настроенный объект логгера
    """
    # Создаем логгер
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Если логгер уже настроен, возвращаем его
    if logger.handlers:
        return logger
    
    # Создаем форматтер
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Добавляем обработчик для вывода в консоль
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # Если указан файл, добавляем обработчик для записи в файл
    if log_file:
        # Создаем директорию для логов, если не существует
        log_dir = Path(log_file).parent
        if not log_dir.exists():
            log_dir.mkdir(parents=True, exist_ok=True)
        
        # Создаем обработчик для файла
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    # Устанавливаем, чтобы логи не передавались родительским логгерам
    logger.propagate = False
    
    return logger