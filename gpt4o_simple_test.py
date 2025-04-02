#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Простой тест GPT-4o Audio Preview для транскрипции аудио
"""

import os
import requests
from pathlib import Path
from dotenv import load_dotenv

# Загрузка переменных окружения
load_dotenv()

# Получаем API ключ
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    print("❌ OPENAI_API_KEY не найден в переменных окружения")
    exit(1)

# Путь к аудиофайлу
audio_file_path = "server/uploads/dbbdcdc0-3e44-49d8-96c4-07afe0f3943d.wav"

# API URL
api_url = "https://api.openai.com/v1/audio/transcriptions"

print(f"Тестирование транскрипции файла: {audio_file_path}")

# Открываем файл и отправляем запрос
try:
    with open(audio_file_path, "rb") as audio_file:
        print("Отправка запроса на транскрипцию...")
        
        headers = {
            "Authorization": f"Bearer {api_key}"
        }
        
        files = {
            "file": audio_file
        }
        
        data = {
            "model": "whisper-1"
        }
        
        response = requests.post(
            api_url,
            headers=headers,
            files=files,
            data=data
        )
        
        if response.status_code == 200:
            result = response.json()
            print("\nРезультат транскрипции:")
            print("-------------------------------------------")
            print(result["text"])
            print("-------------------------------------------")
            print("✅ Тест успешно завершен!")
        else:
            print(f"❌ Ошибка ({response.status_code}):")
            print(response.text)
            
except Exception as e:
    print(f"❌ Ошибка при выполнении запроса: {e}")