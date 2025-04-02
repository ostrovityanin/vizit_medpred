# GPT-4o Audio Preview Микросервис

Микросервис для транскрипции аудио с использованием GPT-4o Audio Preview API.

## Особенности

- Транскрипция аудио с выделением говорящих
- Использование нового GPT-4o Audio Preview API
- Расчет стоимости и использования токенов
- Обработка аудиофайлов до 25 МБ
- REST API для интеграции с другими сервисами

## Требования

- Node.js 16+
- OpenAI API ключ с доступом к GPT-4o

## Установка

1. Установите зависимости:

```
npm install
```

2. Создайте файл .env на основе .env.example:

```
cp .env.example .env
```

3. Отредактируйте .env файл, установив свой OpenAI API ключ:

```
OPENAI_API_KEY=ваш-ключ-api
```

## Использование

### Запуск сервиса

```
npm start
```

Для разработки с автоматической перезагрузкой:

```
npm run dev
```

### Тестирование

Для проверки работы с конкретным аудиофайлом:

```
npm test -- путь/к/аудиофайлу.mp3
```

## API Endpoints

### Проверка статуса
```
GET /health
```

### Транскрипция аудио
```
POST /transcribe
Content-Type: multipart/form-data

Параметры:
- audio: Аудиофайл (формат wav, mp3, webm, m4a)
- prompt (опционально): Инструкция для GPT-4o о том, как обрабатывать аудио
```

Пример ответа:
```json
{
  "success": true,
  "transcription": "Говорящий 1: Привет, как дела?\nГоворящий 2: Хорошо, спасибо!",
  "tokens": {
    "input": 1000,
    "output": 200,
    "total": 1200
  },
  "cost": {
    "input": 0.015,
    "output": 0.015,
    "total": 0.03
  }
}
```

### Получение списка доступных моделей
```
GET /models
```

## Интеграция

Для использования сервиса из других приложений, отправьте POST запрос с аудиофайлом:

```javascript
const formData = new FormData();
formData.append('audio', audioFile);
formData.append('prompt', 'Транскрибируй аудио и выдели говорящих');

fetch('http://localhost:3003/transcribe', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => {
  console.log(data.transcription);
});
```

## Дополнительная информация

- GPT-4o Audio Preview обрабатывает аудиофайлы до 25 МБ
- Стоимость использования GPT-4o Audio: $15 за 1M токенов ввода и $75 за 1M токенов вывода