"""
Микросервис аудио-диаризации

Этот сервис предоставляет API для выполнения аудио-диаризации (определения говорящих)
с использованием библиотеки pyannote.audio.

API использует FastAPI и предоставляет следующие эндпоинты:
- GET /health - проверка работоспособности сервиса
- POST /diarize - выполнение диаризации аудиофайла
"""

import os
import sys
import json
import uuid
import time
import logging
import tempfile
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Union, Any

import numpy as np
import librosa
import soundfile as sf
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Body, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Устанавливаем базовое логирование
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("diarization-service")

# Создаем приложение FastAPI
app = FastAPI(
    title="Сервис аудио-диаризации",
    description="API для выполнения диаризации аудиофайлов",
    version="1.0.0"
)

# Настраиваем CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Создаем временную директорию для хранения загруженных файлов
TEMP_DIR = Path("./temp")
TEMP_DIR.mkdir(exist_ok=True)

# Переменная для хранения времени запуска сервиса
START_TIME = time.time()


def get_uptime() -> float:
    """Возвращает время работы сервиса в секундах"""
    return time.time() - START_TIME


@app.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Проверка работоспособности сервиса
    """
    return {
        "status": "ok",
        "service": "audio-diarization",
        "uptime": get_uptime(),
        "timestamp": datetime.now().isoformat()
    }


def save_upload_file(upload_file: UploadFile) -> Path:
    """
    Сохраняет загруженный файл во временную директорию и возвращает путь к нему
    """
    # Генерируем уникальное имя для файла
    file_ext = os.path.splitext(upload_file.filename)[1] if upload_file.filename else ".wav"
    temp_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = TEMP_DIR / temp_filename
    
    # Сохраняем файл
    with open(file_path, "wb") as f:
        f.write(upload_file.file.read())
    
    return file_path


def perform_diarization(audio_path: Path, min_speakers: int = 1, max_speakers: int = 10) -> Dict[str, Any]:
    """
    Выполняет диаризацию аудиофайла
    
    В текущей простой версии:
    1. Загружаем аудио с помощью librosa
    2. Выполняем простое разделение на сегменты по тишине
    3. Присваиваем каждому сегменту случайного говорящего (для демонстрации)
    
    В реальном приложении здесь будет использоваться pyannote.audio или другая 
    специализированная библиотека для выполнения настоящей диаризации
    """
    logger.info(f"Выполнение диаризации файла: {audio_path}")
    
    try:
        # Загружаем аудиофайл
        y, sr = librosa.load(audio_path, sr=None)
        duration = librosa.get_duration(y=y, sr=sr)
        
        logger.info(f"Файл загружен: длительность {duration:.2f} с, частота дискретизации {sr} Гц")
        
        # Для простой демонстрации разделяем на сегменты по тишине
        # В реальном приложении здесь будет использоваться настоящая диаризация
        intervals = librosa.effects.split(
            y, top_db=30, frame_length=2048, hop_length=512
        )
        
        # Преобразуем интервалы из семплов в секунды
        intervals_sec = intervals / sr
        
        # Ограничиваем количество говорящих
        num_speakers = min(max(min_speakers, 2), max_speakers)
        
        # Создаем сегменты
        segments = []
        for i, (start, end) in enumerate(intervals_sec):
            # Назначаем говорящего (для демонстрации используем простое чередование)
            speaker = f"SPEAKER_{(i % num_speakers) + 1}"
            
            segments.append({
                "start": float(start),
                "end": float(end),
                "speaker": speaker
            })
        
        # Объединяем последовательные сегменты от одного говорящего
        merged_segments = []
        current_segment = None
        
        for segment in segments:
            if current_segment is None:
                current_segment = segment.copy()
            elif current_segment["speaker"] == segment["speaker"] and \
                 segment["start"] - current_segment["end"] < 0.5:  # Порог для объединения
                current_segment["end"] = segment["end"]
            else:
                merged_segments.append(current_segment)
                current_segment = segment.copy()
        
        if current_segment is not None:
            merged_segments.append(current_segment)
        
        # Добавляем индексы
        for i, segment in enumerate(merged_segments):
            segment["index"] = i
        
        logger.info(f"Диаризация завершена: найдено {len(merged_segments)} сегментов с {num_speakers} говорящими")
        
        return {
            "status": "success",
            "num_speakers": num_speakers,
            "duration": float(duration),
            "segments": merged_segments
        }
        
    except Exception as e:
        logger.error(f"Ошибка при выполнении диаризации: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }


@app.post("/diarize")
async def diarize_audio(
    background_tasks: BackgroundTasks,
    audio_file: UploadFile = File(...),
    min_speakers: int = Form(1),
    max_speakers: int = Form(10)
) -> Dict[str, Any]:
    """
    Выполняет диаризацию загруженного аудиофайла
    
    Args:
        audio_file: Загружаемый аудиофайл
        min_speakers: Минимальное количество говорящих (по умолчанию 1)
        max_speakers: Максимальное количество говорящих (по умолчанию 10)
    
    Returns:
        Результаты диаризации в формате JSON
    """
    try:
        logger.info(f"Получен запрос на диаризацию файла: {audio_file.filename}")
        
        # Сохраняем загруженный файл
        file_path = save_upload_file(audio_file)
        logger.info(f"Файл сохранен: {file_path}")
        
        # Выполняем диаризацию
        result = perform_diarization(
            file_path, 
            min_speakers=min_speakers,
            max_speakers=max_speakers
        )
        
        # Добавляем задачу для удаления временного файла
        background_tasks.add_task(lambda p: p.unlink(missing_ok=True), file_path)
        
        return result
    
    except Exception as e:
        logger.error(f"Ошибка при обработке запроса: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при обработке запроса: {str(e)}")


@app.post("/diarize/path")
async def diarize_audio_by_path(
    data: Dict[str, Any] = Body(...)
) -> Dict[str, Any]:
    """
    Выполняет диаризацию аудиофайла по указанному пути
    
    Args:
        data: Словарь с параметрами:
            - audio_path: Путь к аудиофайлу
            - min_speakers: Минимальное количество говорящих (по умолчанию 1)
            - max_speakers: Максимальное количество говорящих (по умолчанию 10)
    
    Returns:
        Результаты диаризации в формате JSON
    """
    try:
        audio_path = data.get("audio_path")
        min_speakers = data.get("min_speakers", 1)
        max_speakers = data.get("max_speakers", 10)
        
        if not audio_path:
            raise HTTPException(status_code=400, detail="Не указан путь к аудиофайлу")
        
        audio_path = Path(audio_path)
        if not audio_path.exists():
            raise HTTPException(status_code=404, detail=f"Файл не найден: {audio_path}")
        
        logger.info(f"Получен запрос на диаризацию по пути: {audio_path}")
        
        # Выполняем диаризацию
        result = perform_diarization(
            audio_path, 
            min_speakers=min_speakers,
            max_speakers=max_speakers
        )
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при обработке запроса: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при обработке запроса: {str(e)}")


def main():
    """Основная функция для запуска сервиса"""
    logger.info("Запуск сервиса аудио-диаризации...")
    
    # Запускаем сервер с фиксированным портом
    port = int(os.environ.get("DIARIZATION_PORT", 5050))
    
    # Изменяем метод запуска для работы внутри исполняемого файла
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        reload=False
    )


if __name__ == "__main__":
    main()