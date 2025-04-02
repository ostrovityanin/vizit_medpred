#!/bin/bash

echo "Установка зависимостей для GPT-4o Audio Preview микросервиса..."
npm install

# Создаем необходимые директории
mkdir -p uploads
mkdir -p results
mkdir -p logs

echo "Установка завершена!"