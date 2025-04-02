#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Тестирование GPT-4o Audio Preview для транскрипции аудио

Этот скрипт демонстрирует прямое использование GPT-4o Audio Preview
через API OpenAI для транскрипции аудиофайлов.
"""

import os
import sys
import base64
import json
import time
from pathlib import Path
import requests
from dotenv import load_dotenv

# Загрузка переменных окружения из .env файла
load_dotenv()

def encode_audio_to_base64(audio_file_path):
    """Кодирует аудиофайл в Base64"""
    try:
        with open(audio_file_path, "rb") as audio_file:
            return base64.b64encode(audio_file.read()).decode('utf-8')
    except Exception as e:
        print(f"Ошибка при кодировании аудиофайла: {e}")
        return None

def transcribe_with_gpt4o(audio_file_path, api_key):
    """Отправляет аудиофайл в GPT-4o Audio Preview и получает транскрипцию"""
    if not api_key:
        print("Отсутствует API ключ OpenAI")
        return None

    # Кодируем аудиофайл в Base64
    print(f"Кодирование аудиофайла: {audio_file_path}")
    audio_base64 = encode_audio_to_base64(audio_file_path)
    if not audio_base64:
        return None

    # Формируем запрос к API
    print("Отправка запроса в GPT-4o Audio Preview...")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "gpt-4o",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Транскрибируй это аудио и идентифицируй говорящих. Представь результат в виде диалога."
                    },
                    {
                        "type": "input_audio",
                        "input_audio": {
                            "data": audio_base64,
                            "format": "wav"
                        }
                    }
                ]
            }
        ]
    }

    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=payload
        )

        # Проверяем ответ
        if response.status_code != 200:
            print(f"Ошибка API: {response.status_code} - {response.text}")
            return None

        data = response.json()
        print("Получен ответ от GPT-4o Audio Preview")
        
        # Возвращаем результат
        return {
            "text": data["choices"][0]["message"]["content"],
            "usage": data["usage"]
        }
    except Exception as e:
        print(f"Ошибка при выполнении запроса: {e}")
        return None

def main():
    """Основная функция"""
    print("====================================")
    print("Тестирование GPT-4o Audio Preview API")
    print("====================================")

    # Получаем ключ API из переменных окружения
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("❌ Для запуска теста необходим OPENAI_API_KEY в переменных окружения")
        return

    # Список тестовых аудиофайлов
    test_files = [
        "server/uploads/dbbdcdc0-3e44-49d8-96c4-07afe0f3943d.wav",
        "server/uploads/6e9987f5-f320-4c11-bbc3-158bbdb85455.wav",
        "server/uploads/ddff78d2-d377-4bb2-8dde-767ca808f183.wav"
    ]

    # Создаем директорию для результатов, если не существует
    os.makedirs("temp", exist_ok=True)

    # Перебираем тестовые файлы и пытаемся их транскрибировать
    successful_transcription = False
    for file_path in test_files:
        full_path = Path(file_path).resolve()
        
        if full_path.exists():
            print(f"\nТестирование с файлом: {full_path}")
            
            start_time = time.time()
            result = transcribe_with_gpt4o(str(full_path), api_key)
            elapsed_time = time.time() - start_time
            
            if result and result["text"]:
                successful_transcription = True
                print(f"✅ Транскрипция успешно завершена за {elapsed_time:.2f} сек")
                print(f"📊 Использовано токенов: {result['usage']['total_tokens']} (вход: {result['usage']['prompt_tokens']}, выход: {result['usage']['completion_tokens']})")
                
                # Сохраняем результат в файл
                output_path = f"temp/transcription_{full_path.name}.txt"
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(result["text"])
                print(f"📝 Результат сохранен в файл: {output_path}")
                
                # Выводим первые 300 символов результата
                print("\nПервые 300 символов транскрипции:")
                print("------------------------------------")
                preview = result["text"][:300]
                if len(result["text"]) > 300:
                    preview += "..."
                print(preview)
                print("------------------------------------")
                
                # Прерываем цикл после первой успешной транскрипции
                break
            else:
                print(f"❌ Не удалось транскрибировать файл: {full_path}")
        else:
            print(f"⚠️ Файл не найден: {full_path}")

    if not successful_transcription:
        print("\n❌ Не удалось выполнить транскрипцию ни одного файла")
        print("Убедитесь, что аудиофайлы существуют и доступны для чтения")

    print("\n====================================")
    print("Тестирование GPT-4o Audio Preview API завершено")
    print("====================================")

if __name__ == "__main__":
    main()