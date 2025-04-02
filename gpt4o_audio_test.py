#!/usr/bin/env python3
"""
Тестирование GPT-4o Audio Preview для транскрипции аудио

Этот скрипт демонстрирует прямое использование GPT-4o Audio Preview
через API OpenAI для транскрипции аудиофайлов.
"""

import os
import sys
import base64
import requests
import json

# Константы
API_URL = "https://api.openai.com/v1/chat/completions"

def encode_audio_to_base64(audio_file_path):
    """Кодирует аудиофайл в Base64"""
    try:
        with open(audio_file_path, "rb") as f:
            audio_data = f.read()
        return base64.b64encode(audio_data).decode('utf-8')
    except Exception as e:
        print(f"Ошибка при кодировании аудио: {e}")
        return None

def transcribe_with_gpt4o(audio_file_path, api_key):
    """Отправляет аудиофайл в GPT-4o Audio Preview и получает транскрипцию"""
    
    # Кодируем аудиофайл в Base64
    audio_b64 = encode_audio_to_base64(audio_file_path)
    if not audio_b64:
        return None
    
    # Определяем формат аудио на основе расширения файла
    audio_format = os.path.splitext(audio_file_path)[1][1:].lower()
    if not audio_format:
        audio_format = "wav"  # по умолчанию WAV
    
    # Создаем запрос в формате как у LangChain
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    # Важно: структура сообщения с аудио
    payload = {
        "model": "gpt-4o",
        "messages": [
            {
                "role": "system",
                "content": """
                Ты русскоязычный эксперт по транскрипции речи.
                
                Выполни транскрипцию аудиозаписи и выдели разных говорящих.
                
                Правила:
                1. Расшифруй аудио максимально точно и полностью
                2. Формат ответа: "Говорящий 1: [текст]", "Говорящий 2: [текст]" или "Женщина: [текст]", "Мужчина: [текст]"
                3. Если невозможно определить разных говорящих или это монолог, используй формат "Говорящий: [текст]"
                4. Никогда не пиши комментарии к транскрипции. Не пиши вступительных или заключительных фраз.
                5. Выдай только распознанный текст, никаких пояснений или метаданных
                6. Сохраняй оригинальный стиль речи, сленг, повторы и особенности произношения
                7. Ты не должен объяснять невозможность разделить говорящих и не должен писать о проблемах с качеством аудио
                """
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Распознай эту аудиозапись с выделением говорящих. Выдай только транскрипцию, без комментариев и метаданных."
                    },
                    {
                        "type": "audio",
                        "audio_url": f"data:audio/{audio_format};base64,{audio_b64}"
                    }
                ]
            }
        ],
        "temperature": 0.1
    }
    
    try:
        print(f"Отправка аудиофайла {audio_file_path} на распознавание через GPT-4o Audio Preview...")
        response = requests.post(API_URL, headers=headers, json=payload)
        
        if response.status_code == 200:
            result = response.json()
            
            # Извлекаем результат транскрипции
            transcription = result["choices"][0]["message"]["content"]
            print("\nРезультат транскрипции:")
            print("-" * 50)
            print(transcription)
            print("-" * 50)
            
            # Сохраняем результат в файл
            output_file = f"{os.path.splitext(audio_file_path)[0]}_transcription.txt"
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(transcription)
            print(f"Транскрипция сохранена в файл: {output_file}")
            
            return transcription
        else:
            print(f"Ошибка API: {response.status_code}")
            print(f"Детали: {response.text}")
            return None
            
    except Exception as e:
        print(f"Ошибка при отправке запроса: {e}")
        return None

def main():
    """Основная функция"""
    if len(sys.argv) < 2:
        print("Использование: python gpt4o_audio_test.py <путь_к_аудиофайлу>")
        sys.exit(1)
    
    audio_file_path = sys.argv[1]
    
    # Проверяем существование аудиофайла
    if not os.path.exists(audio_file_path):
        print(f"Ошибка: файл {audio_file_path} не найден")
        sys.exit(1)
    
    # Получаем API ключ из переменной окружения
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Ошибка: API ключ не найден. Установите переменную окружения OPENAI_API_KEY")
        sys.exit(1)
    
    # Вызываем функцию транскрипции
    transcribe_with_gpt4o(audio_file_path, api_key)

if __name__ == "__main__":
    main()