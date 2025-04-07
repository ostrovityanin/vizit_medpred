"""
Упрощенная версия сервиса диаризации аудио для Replit

Эта версия использует упрощенную обработку для 
минимизации времени выполнения и нагрузки на CPU.
"""

import os
import uuid
import time
import logging
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

# Настройка логирования
logging.basicConfig(level=logging.INFO,
                   format='%(asctime)s [%(levelname)s] %(message)s',
                   datefmt='%Y-%m-%d %H:%M:%S,%f')
logger = logging.getLogger(__name__)

try:
    import numpy as np
    from fastapi import FastAPI, File, Form, UploadFile, BackgroundTasks
    from fastapi.responses import JSONResponse
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn
except ImportError as e:
    logger.error(f"Ошибка импорта: {str(e)}")
    logger.error("Пожалуйста, установите необходимые зависимости: pip install fastapi uvicorn python-multipart")
    exit(1)

# Создаем экземпляр FastAPI
app = FastAPI(title="Simplified Audio Diarization Service",
              description="Упрощенный сервис для диаризации аудио (определение говорящих)",
              version="0.1.0")

# Добавляем поддержку CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Директория для временных файлов
TEMP_DIR = Path("temp")
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
        "service": "audio-diarization-simplified",
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
    temp_filepath = TEMP_DIR / temp_filename
    
    # Открываем файл для записи
    with open(temp_filepath, "wb") as f:
        f.write(upload_file.file.read())
    
    return temp_filepath


def perform_simplified_diarization(audio_path: Path, min_speakers: int = 1, max_speakers: int = 10) -> Dict[str, Any]:
    """
    Выполняет упрощенную диаризацию аудиофайла
    
    В этой версии:
    1. Не выполняем реальный анализ аудио (экономим CPU и время)
    2. Генерируем фиктивные данные о сегментах
    3. Возвращаем структурированный результат
    """
    logger.info(f"Выполнение упрощенной диаризации файла: {audio_path}")
    
    try:
        # Генерируем фиктивную длительность файла (2-5 секунд)
        duration = np.random.uniform(2.0, 5.0)
        logger.info(f"Имитация обработки аудиофайла длительностью {duration:.2f} с")
        
        # Небольшая искусственная задержка для имитации обработки
        time.sleep(0.5)
        
        # Определяем количество говорящих (от min до max, не более 3 в простом примере)
        num_speakers = min(max(min_speakers, 1), min(max_speakers, 3))
        
        # Создаем фиктивные сегменты
        segments = []
        current_start = 0.0
        
        for i in range(5):  # Создаем 5 сегментов
            segment_duration = duration / 5
            speaker_id = f"SPEAKER_{np.random.randint(0, num_speakers)}"
            
            segments.append({
                "start": current_start,
                "end": current_start + segment_duration,
                "speaker": speaker_id,
                "text": f"Текст сегмента {i+1}"
            })
            
            current_start += segment_duration
        
        # Добавляем индексы сегментов
        for i, segment in enumerate(segments):
            segment["index"] = i
        
        logger.info(f"Диаризация завершена: создано {len(segments)} сегментов с {num_speakers} говорящими")
        
        return {
            "status": "success",
            "num_speakers": num_speakers,
            "duration": float(duration),
            "segments": segments
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
    Эндпоинт для диаризации аудиофайла
    
    - **audio_file**: Аудиофайл для диаризации
    - **min_speakers**: Минимальное количество говорящих (по умолчанию 1)
    - **max_speakers**: Максимальное количество говорящих (по умолчанию 10)
    
    Возвращает результат диаризации с сегментами и информацией о говорящих
    """
    try:
        filename = audio_file.filename if audio_file.filename else "unknown.wav"
        logger.info(f"Получен запрос на диаризацию файла: {filename}")
        
        # Сохраняем загруженный файл
        temp_filepath = save_upload_file(audio_file)
        logger.info(f"Файл сохранен: {temp_filepath}")
        
        # Выполняем диаризацию
        logger.info(f"Выполнение диаризации файла: {temp_filepath}")
        result = perform_simplified_diarization(
            audio_path=temp_filepath,
            min_speakers=min_speakers,
            max_speakers=max_speakers
        )
        
        # Удаляем временный файл асинхронно после обработки запроса
        background_tasks.add_task(lambda: os.unlink(temp_filepath) if os.path.exists(temp_filepath) else None)
        
        return result
    
    except Exception as e:
        logger.error(f"Ошибка при обработке запроса: {str(e)}")
        return JSONResponse(
            content={"status": "error", "error": str(e)},
            status_code=500
        )


if __name__ == "__main__":
    logger.info("Запуск сервиса аудио-диаризации...")
    uvicorn.run(app, host="0.0.0.0", port=5050)