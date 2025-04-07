#!/bin/bash

# Запуск микросервиса аудио-диаризации с FastAPI
echo "🚀 Запуск микросервиса аудио-диаризации..."

# Создаем директорию для сервиса, если она не существует
mkdir -p services/audio-diarization
mkdir -p services/audio-diarization/temp

# Запускаем сервис
cd services/audio-diarization
python3 run.py