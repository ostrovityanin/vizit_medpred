#!/usr/bin/env python3
"""
Тест транскрипции аудио с использованием GPT-4o Audio Preview API.
Этот скрипт отправляет аудиофайл в OpenAI API и получает транскрипцию.
"""

import os
import time
import base64
import requests
from dotenv import load_dotenv

# Загрузка переменных окружения
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

def encode_audio_to_base64(audio_file_path):
    """Кодирует аудиофайл в Base64"""
    with open(audio_file_path, 'rb') as audio_file:
        return base64.b64encode(audio_file.read()).decode('utf-8')

def transcribe_with_gpt4o(audio_file_path):
    """Отправляет аудиофайл в GPT-4o Audio Preview и получает транскрипцию"""
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY не найден в переменных окружения")
    
    # Получаем расширение файла для определения формата
    file_format = os.path.splitext(audio_file_path)[1][1:].lower()
    
    # Кодируем аудиофайл в base64
    base64_audio = encode_audio_to_base64(audio_file_path)
    
    # Формируем запрос
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }
    
    # Используем новый формат API для GPT-4o с audio
    payload = {
        "model": "gpt-4o",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Пожалуйста, транскрибируй этот аудиофайл."},
                    {"type": "input_audio", "input_audio": {"data": base64_audio, "format": file_format}}
                ]
            }
        ]
    }
    
    # Отправляем запрос к OpenAI API
    print(f"Отправка запроса для транскрипции файла: {audio_file_path}")
    start_time = time.time()
    
    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=payload
        )
        
        # Проверяем успешность запроса
        response.raise_for_status()
        result = response.json()
        
        # Выводим информацию о затраченном времени
        elapsed_time = time.time() - start_time
        print(f"Транскрипция завершена за {elapsed_time:.2f} сек")
        
        # Если доступна, выводим информацию об использовании токенов
        if "usage" in result:
            print(f"Использование токенов: {result['usage']}")
        
        # Возвращаем текст транскрипции
        return result["choices"][0]["message"]["content"]
    
    except requests.exceptions.RequestException as e:
        print(f"Ошибка API: {e}")
        if response.status_code == 400:
            print(f"Детали ошибки: {response.json()}")
        return None

def main():
    """Основная функция"""
    print("=== Тест транскрипции аудио с GPT-4o Audio Preview ===")
    
    # Путь к тестовому аудиофайлу
    audio_file_path = "./test_audio/sample.wav"
    
    # Проверяем существование файла
    if not os.path.exists(audio_file_path):
        print(f"Ошибка: файл {audio_file_path} не найден")
        return
    
    # Получаем транскрипцию
    transcription = transcribe_with_gpt4o(audio_file_path)
    
    # Выводим результат
    print("\n=== Результат транскрипции ===")
    print(transcription if transcription else "Не удалось получить транскрипцию")
    print("============================\n")

if __name__ == "__main__":
    main()