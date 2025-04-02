#!/usr/bin/env python3
"""
Тест транскрипции аудио с использованием Whisper API.
Этот скрипт отправляет аудиофайл в OpenAI API и получает транскрипцию.
"""

import os
import time
import requests
from dotenv import load_dotenv

# Загрузка переменных окружения
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

def transcribe_with_whisper(audio_file_path):
    """Отправляет аудиофайл в Whisper API и получает транскрипцию"""
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY не найден в переменных окружения")
    
    # Формируем заголовки запроса
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }
    
    # Формируем данные запроса
    with open(audio_file_path, 'rb') as audio_file:
        files = {
            'file': (os.path.basename(audio_file_path), audio_file, 'audio/wav')
        }
        data = {
            'model': 'whisper-1',
            'language': 'ru'  # Можно указать язык или оставить 'null' для автоопределения
        }
    
        # Отправляем запрос к OpenAI API
        print(f"Отправка запроса для транскрипции файла: {audio_file_path}")
        start_time = time.time()
        
        try:
            response = requests.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers=headers,
                files=files,
                data=data
            )
            
            # Проверяем успешность запроса
            response.raise_for_status()
            result = response.json()
            
            # Выводим информацию о затраченном времени
            elapsed_time = time.time() - start_time
            print(f"Транскрипция завершена за {elapsed_time:.2f} сек")
            
            # Возвращаем текст транскрипции
            return result.get("text")
        
        except requests.exceptions.RequestException as e:
            print(f"Ошибка API: {e}")
            if hasattr(response, 'status_code') and response.status_code != 200:
                print(f"Детали ошибки: {response.text}")
            return None

def main():
    """Основная функция"""
    print("=== Тест транскрипции аудио с Whisper API ===")
    
    # Путь к тестовому аудиофайлу
    audio_file_path = "./test_audio/sample.wav"
    
    # Проверяем существование файла
    if not os.path.exists(audio_file_path):
        print(f"Ошибка: файл {audio_file_path} не найден")
        return
    
    # Получаем транскрипцию
    transcription = transcribe_with_whisper(audio_file_path)
    
    # Выводим результат
    print("\n=== Результат транскрипции ===")
    print(transcription if transcription else "Не удалось получить транскрипцию")
    print("============================\n")

if __name__ == "__main__":
    main()