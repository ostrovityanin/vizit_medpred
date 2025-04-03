"""
Точка входа для микросервиса аудио-диаризации.

Этот скрипт запускает Flask-приложение для диаризации аудио.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Загружаем переменные окружения из .env файла, если он существует
load_dotenv()

# Определяем пути
current_dir = Path(__file__).parent
src_dir = current_dir / 'src'
utils_dir = current_dir / 'utils'
logs_dir = current_dir / 'logs'
temp_dir = current_dir / 'temp'

# Создаем необходимые директории
logs_dir.mkdir(exist_ok=True)
temp_dir.mkdir(exist_ok=True)

# Добавляем пути в sys.path
sys.path.append(str(current_dir))
sys.path.append(str(src_dir))
sys.path.append(str(utils_dir))

# Импортируем и запускаем приложение
from src.index import app

if __name__ == '__main__':
    # Получаем порт и хост из переменных окружения
    port = int(os.environ.get('DIARIZATION_PORT', 5001))
    host = os.environ.get('DIARIZATION_HOST', '0.0.0.0')
    debug = os.environ.get('DIARIZATION_DEBUG', 'false').lower() == 'true'
    
    # Запускаем сервер
    app.run(host=host, port=port, debug=debug)