"""
Микросервис для диаризации аудио.

Предоставляет API для определения говорящих в аудиофайлах.
"""

import os
import sys
import time
import json
import uuid
import logging
from pathlib import Path
import flask
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename

# Добавляем пути в sys.path для импорта наших модулей
current_dir = Path(__file__).parent
parent_dir = current_dir.parent
sys.path.append(str(parent_dir))
sys.path.append(str(parent_dir / 'utils'))

# Импортируем модуль для диаризации и утилиты
from src.diarization import process_diarization
from utils.audio_utils import convert_to_wav, get_audio_duration
from utils.logger import setup_logger

# Настраиваем логгер
log = setup_logger('diarization_service', parent_dir / 'logs' / 'service.log')

# Создаем директорию для временных файлов
TEMP_DIR = parent_dir / 'temp'
TEMP_DIR.mkdir(exist_ok=True)

# Создаем Flask приложение
app = Flask(__name__)

# Настройка приложения
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100 MB
app.config['UPLOAD_FOLDER'] = TEMP_DIR
app.config['ALLOWED_EXTENSIONS'] = {'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'}

# Версия сервиса
VERSION = '1.0.0'

def allowed_file(filename):
    """Проверка допустимого расширения файла"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

@app.route('/health', methods=['GET'])
def health_check():
    """Проверка работоспособности сервиса"""
    return jsonify({
        'status': 'ok',
        'service': 'audio-diarization',
        'version': VERSION
    })

@app.route('/diarize', methods=['POST'])
def diarize_audio():
    """
    Диаризация (определение говорящих) в аудиофайле
    
    Параметры:
        - file: аудиофайл
        - min_speakers: минимальное количество говорящих (по умолчанию 1)
        - max_speakers: максимальное количество говорящих (по умолчанию 10)
        - return_segments: возвращать ли файлы сегментов (по умолчанию False)
    
    Возвращает:
        - speakers: список идентификаторов говорящих
        - segments: список сегментов с говорящими (start, end, speaker)
        - processing_time: время обработки в секундах
    """
    start_time = time.time()
    
    # Проверка наличия файла в запросе
    if 'file' not in request.files:
        return jsonify({'error': 'Файл не найден в запросе'}), 400
    
    file = request.files['file']
    
    # Проверка выбран ли файл
    if file.filename == '':
        return jsonify({'error': 'Файл не выбран'}), 400
    
    # Проверка допустимого расширения
    if not allowed_file(file.filename):
        return jsonify({'error': 'Недопустимый формат файла'}), 400
    
    try:
        # Получаем параметры из запроса
        min_speakers = int(request.form.get('min_speakers', 1))
        max_speakers = int(request.form.get('max_speakers', 10))
        return_segments = request.form.get('return_segments', 'false').lower() == 'true'
        
        # Ограничиваем количество говорящих разумными пределами
        min_speakers = max(1, min(min_speakers, 20))
        max_speakers = max(min_speakers, min(max_speakers, 20))
        
        # Создаем уникальный идентификатор для файлов
        file_id = str(uuid.uuid4())
        
        # Сохраняем загруженный файл
        filename = secure_filename(file.filename)
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{file_id}_{filename}")
        file.save(input_path)
        
        # Конвертируем в WAV, если это не WAV
        if not filename.lower().endswith('.wav'):
            wav_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{file_id}.wav")
            convert_to_wav(input_path, wav_path)
            os.remove(input_path)  # Удаляем оригинальный файл
            input_path = wav_path
        
        # Получаем длительность аудио
        duration = get_audio_duration(input_path)
        log.info(f"Начало диаризации файла {filename}, длительность: {duration:.2f} сек")
        
        # Выполняем диаризацию
        result = process_diarization(
            input_path, 
            min_speakers=min_speakers, 
            max_speakers=max_speakers,
            return_segments=return_segments
        )
        
        # Добавляем время обработки
        result['processing_time'] = time.time() - start_time
        
        # Удаляем временные файлы
        if os.path.exists(input_path):
            os.remove(input_path)
        
        # Логируем результат
        log.info(f"Диаризация завершена. Найдено {len(result['speakers'])} говорящих, {len(result['segments'])} сегментов")
        
        return jsonify(result)
        
    except Exception as e:
        log.error(f"Ошибка при диаризации: {str(e)}", exc_info=True)
        return jsonify({'error': f"Ошибка обработки: {str(e)}"}), 500

if __name__ == '__main__':
    # Запускаем сервер
    port = int(os.environ.get('DIARIZATION_PORT', 5001))
    host = os.environ.get('DIARIZATION_HOST', '0.0.0.0')
    debug = os.environ.get('DIARIZATION_DEBUG', 'false').lower() == 'true'
    
    log.info(f"Запуск сервиса на {host}:{port} (debug={debug})")
    app.run(host=host, port=port, debug=debug)