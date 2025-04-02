# GPT-4o Audio Preview Микросервис

Микросервис для транскрибирования аудиофайлов с использованием GPT-4o Audio Preview API от OpenAI.

## Возможности

- Транскрибирование аудиофайлов на русском языке
- Выделение разных говорящих в диалогах
- Оптимизация аудиофайлов для лучшего качества транскрипции
- Расчет стоимости использования API
- Простой REST API для интеграции с другими сервисами
- Клиентская библиотека для легкой интеграции в Node.js проекты

## Требования

- Node.js 16+ 
- API ключ OpenAI с доступом к GPT-4o
- ffmpeg (устанавливается автоматически через npm)

## Установка

1. Клонировать репозиторий
2. Скопировать `.env.example` в `.env` и настроить переменные окружения
3. Установить зависимости: `npm install`
4. Запустить сервис: `./start.sh`

## Конфигурация

Настройте параметры в файле `.env`:

```
# Ключ API для сервиса OpenAI
OPENAI_API_KEY=your_openai_api_key

# Порт для запуска сервиса 
PORT=3400

# Уровень логирования (debug, info, warn, error)
LOG_LEVEL=info

# Максимальный размер загружаемого файла в MB
MAX_FILE_SIZE=25

# Настройки аудио транскрипции
TRANSCRIPTION_MODEL=gpt-4o
TRANSCRIPTION_LANGUAGE=ru
TRANSCRIPTION_TEMPERATURE=0.2
```

## Запуск и остановка

### Запуск сервиса
```
./start.sh
```

### Остановка сервиса
```
./stop.sh
```

### Тестирование
```
node src/test.js path/to/audio-file.mp3
```

## API Endpoints

### GET /health
Проверка работоспособности сервиса

### GET /info
Информация о сервисе и его конфигурации

### POST /transcribe
Транскрибирование загруженного аудиофайла.
- Content-Type: multipart/form-data
- Поле: audio (файл)

### POST /transcribe/path
Транскрибирование файла по указанному пути.
- Content-Type: application/json
- Параметры: `{ "filePath": "/absolute/path/to/file.mp3" }`

## Интеграция с основным приложением

### Через REST API

```javascript
const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function transcribeAudio(filePath) {
  const form = new FormData();
  form.append('audio', fs.createReadStream(filePath));
  
  const response = await fetch('http://localhost:3400/transcribe', {
    method: 'POST',
    body: form
  });
  
  const result = await response.json();
  return result.text;
}
```

### Через клиентскую библиотеку

```javascript
const { transcribeAudio } = require('./src/client-lib');

async function main() {
  try {
    const result = await transcribeAudio('/path/to/audio.mp3');
    console.log(result.text);
  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

main();
```