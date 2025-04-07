#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Упрощенная версия сервиса диаризации

Этот скрипт запускает упрощенную версию сервиса диаризации,
которая имитирует процесс диаризации и возвращает структурированные
результаты, совместимые с основным API.

Основные функции:
1. Имитация распознавания говорящих в аудиофайле
2. Генерация структурированного JSON-результата
3. Обеспечение API-интерфейса для тестирования

Преимущества упрощенной версии:
- Меньше зависимостей (не требует heavy libraries)
- Быстрая работа с предсказуемыми результатами
- Совместимые ответы с полной версией
"""

import os
import sys
import json
import time
import random
import argparse
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

# Импортируем необходимые библиотеки
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Настройки сервиса
DEFAULT_PORT = 5050
TEMP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'temp')

# Создаем временную директорию, если она не существует
os.makedirs(TEMP_DIR, exist_ok=True)

# Создаем FastAPI приложение
app = FastAPI(
    title="Simplified Audio Diarization Service",
    description="Simplified service for speaker diarization without heavy dependencies",
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

# Функции для получения информации об аудиофайле
def get_audio_info(audio_path: str) -> Dict[str, Any]:
    """
    Получает базовую информацию об аудиофайле (длительность, формат)
    
    В упрощенной версии используем фиксированную продолжительность для
    тестового режима, но в полной версии используется анализ файла
    """
    # Для простоты возвращаем случайную длительность между 5 и 20 секундами
    duration = random.uniform(5.0, 20.0)
    
    return {
        "path": audio_path,
        "duration": duration,
        "format": os.path.splitext(audio_path)[1][1:].lower()
    }

def detect_number_of_speakers(audio_path: str, min_speakers: int = 1, max_speakers: int = 10) -> int:
    """
    Определяет приблизительное количество говорящих в аудиофайле
    
    В упрощенной версии возвращает случайное число в заданном диапазоне
    """
    # Ограничиваем min_speakers и max_speakers
    min_speakers = max(1, min(min_speakers, 10))
    max_speakers = max(min_speakers, min(max_speakers, 10))
    
    # Для простоты возвращаем случайное число спикеров в заданном диапазоне
    return random.randint(min_speakers, max_speakers)

def generate_simplified_segments(
    duration: float,
    num_speakers: int
) -> List[Dict[str, Any]]:
    """
    Генерирует упрощенные сегменты диаризации
    
    Алгоритм:
    1. Делит аудио на приблизительно равные сегменты
    2. Назначает спикеров каждому сегменту
    3. Добавляет небольшое перекрытие между сегментами
    """
    segments = []
    
    # Базовые параметры для сегментации
    min_segment_duration = 0.5  # минимальная длительность сегмента
    max_segment_duration = 3.0  # максимальная длительность сегмента
    
    # Текущая позиция в аудио
    current_time = 0.0
    
    # Генерируем сегменты, пока не достигнем конца аудио
    while current_time < duration:
        # Определяем длительность сегмента
        segment_duration = random.uniform(min_segment_duration, max_segment_duration)
        
        # Обрезаем длительность, если выходим за пределы аудио
        if current_time + segment_duration > duration:
            segment_duration = duration - current_time
        
        # Если сегмент слишком короткий, пропускаем
        if segment_duration < 0.3:
            break
        
        # Определяем говорящего для этого сегмента
        speaker_id = f"SPEAKER_{random.randint(1, num_speakers)}"
        
        # Создаем сегмент
        segment = {
            "start": current_time,
            "end": current_time + segment_duration,
            "speaker": speaker_id,
            "confidence": random.uniform(0.7, 0.98)
        }
        
        segments.append(segment)
        
        # Продвигаемся вперед по времени с небольшим перекрытием
        current_time += segment_duration - random.uniform(0.0, 0.2)
        
        # Если перекрытие слишком большое и мы вернулись назад, корректируем
        if current_time <= 0:
            current_time = 0.01
    
    # Сортируем сегменты по времени начала
    segments.sort(key=lambda x: x["start"])
    
    # Корректируем любые перекрытия, чтобы сегменты не пересекались
    for i in range(1, len(segments)):
        if segments[i]["start"] < segments[i-1]["end"]:
            segments[i]["start"] = segments[i-1]["end"]
    
    return segments

def process_audio_file(
    audio_path: str,
    min_speakers: int = 1,
    max_speakers: int = 10
) -> Dict[str, Any]:
    """
    Обрабатывает аудиофайл и возвращает результаты диаризации
    
    В упрощенной версии генерирует искусственные результаты
    """
    # Получаем информацию об аудиофайле
    audio_info = get_audio_info(audio_path)
    
    # Определяем количество говорящих
    num_speakers = detect_number_of_speakers(
        audio_path, 
        min_speakers=min_speakers, 
        max_speakers=max_speakers
    )
    
    # Генерируем сегменты диаризации
    segments = generate_simplified_segments(
        audio_info["duration"],
        num_speakers
    )
    
    # Формируем результат
    result = {
        "status": "success",
        "timestamp": datetime.now().isoformat(),
        "duration": audio_info["duration"],
        "num_speakers": num_speakers,
        "segments": segments,
        "processing_info": {
            "simplified": True,
            "processing_time": random.uniform(0.5, 2.0)
        }
    }
    
    return result

# API endpoints
@app.get("/")
async def root():
    """
    Корневой эндпоинт, возвращает базовую информацию о сервисе
    """
    return {
        "name": "Simplified Audio Diarization Service",
        "status": "running",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """
    Эндпоинт для проверки состояния сервиса
    """
    return {
        "status": "ok",
        "service": "simplified-diarization",
        "version": "1.0.0",
        "uptime": time.time() - startup_time,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/diarize")
async def diarize_audio(
    audio_file: UploadFile = File(...),
    min_speakers: int = Form(1),
    max_speakers: int = Form(10)
):
    """
    Эндпоинт для диаризации аудиофайла
    
    Принимает:
    - audio_file: аудиофайл для диаризации
    - min_speakers: минимальное количество говорящих (по умолчанию 1)
    - max_speakers: максимальное количество говорящих (по умолчанию 10)
    
    Возвращает:
    - результаты диаризации в формате JSON
    """
    try:
        # Проверяем, что это аудиофайл
        file_ext = os.path.splitext(audio_file.filename)[1].lower()
        allowed_extensions = [".wav", ".mp3", ".ogg", ".m4a", ".flac", ".aac"]
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format: {file_ext}. Allowed formats: {', '.join(allowed_extensions)}"
            )
        
        # Создаем временный файл для сохранения загруженного аудио
        temp_file_path = os.path.join(TEMP_DIR, f"upload_{int(time.time())}_{random.randint(1000, 9999)}{file_ext}")
        
        # Сохраняем файл
        with open(temp_file_path, "wb") as temp_file:
            content = await audio_file.read()
            temp_file.write(content)
        
        # Выполняем диаризацию
        result = process_audio_file(
            temp_file_path,
            min_speakers=min_speakers,
            max_speakers=max_speakers
        )
        
        # Удаляем временный файл
        try:
            os.remove(temp_file_path)
        except Exception as e:
            print(f"Warning: Could not remove temporary file {temp_file_path}: {e}")
        
        return result
    
    except Exception as e:
        # Для целей отладки выводим ошибку в консоль
        print(f"Error processing audio file: {str(e)}")
        
        # Возвращаем ошибку клиенту
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "error": str(e),
                "message": "Failed to process audio file"
            }
        )

if __name__ == "__main__":
    # Парсим аргументы командной строки
    parser = argparse.ArgumentParser(description="Simplified Audio Diarization Service")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Port to run the service on (default: {DEFAULT_PORT})")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to run the service on (default: 0.0.0.0)")
    
    args = parser.parse_args()
    
    # Записываем время запуска
    startup_time = time.time()
    
    # Запускаем сервис
    print(f"Starting Simplified Audio Diarization Service on http://{args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port)