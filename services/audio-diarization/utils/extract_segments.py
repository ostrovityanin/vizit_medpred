"""
Скрипт для извлечения сегментов аудио

Этот скрипт принимает аудиофайл и временные метки, 
и извлекает указанный сегмент в отдельный файл.
"""

import os
import sys
import argparse
from pathlib import Path

# Добавляем директорию utils в путь импорта
utils_dir = Path(__file__).parent
sys.path.append(str(utils_dir))

# Импортируем функцию для извлечения сегмента
import audio_utils

def main():
    """Основная функция"""
    parser = argparse.ArgumentParser(description='Извлечение сегмента аудио')
    parser.add_argument('--audio_path', required=True, help='Путь к исходному аудиофайлу')
    parser.add_argument('--output_path', required=True, help='Путь для сохранения сегмента')
    parser.add_argument('--start_time', type=float, required=True, help='Время начала сегмента в секундах')
    parser.add_argument('--end_time', type=float, required=True, help='Время конца сегмента в секундах')
    
    args = parser.parse_args()
    
    # Создаем директорию, если не существует
    output_dir = os.path.dirname(args.output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    
    # Извлекаем сегмент
    audio_utils.extract_audio_segment(
        args.audio_path, 
        args.output_path, 
        args.start_time, 
        args.end_time
    )
    
    print(f"Сегмент извлечен: {args.output_path}")

if __name__ == "__main__":
    main()