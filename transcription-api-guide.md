# Руководство по API транскрипции аудио

## Введение

API транскрипции аудио предоставляет возможность преобразования аудиозаписей в текст с использованием различных моделей OpenAI. API обладает следующими возможностями:

- Транскрипция аудиофайлов с автоматическим выбором оптимальной модели
- Сравнительная транскрипция с использованием нескольких моделей
- Поддержка различных языков для повышения точности транскрипции
- Оптимизация аудио для улучшения результатов транскрипции
- Детализированный вывод с временными метками и сегментами (опционально)

## Доступные модели

API поддерживает следующие модели транскрипции:

1. **whisper-1** - оригинальная модель Whisper от OpenAI, хорошо работает с английским языком и длинными аудио
2. **gpt-4o-transcribe** - модель на базе GPT-4o, обеспечивает высокую точность транскрипции, особенно для русского языка
3. **gpt-4o-mini-transcribe** - облегченная версия GPT-4o модели, обеспечивает быструю транскрипцию с хорошей точностью

## Эндпоинты API

### 1. Стандартная транскрипция

`POST /api/transcribe`

Этот эндпоинт транскрибирует аудиофайл с автоматическим выбором оптимальной модели в зависимости от языка и других параметров.

#### Параметры запроса (multipart/form-data)

| Параметр  | Тип   | Обязательный | Описание |
|-----------|-------|--------------|----------|
| audio     | File  | Да           | Аудиофайл для транскрипции |
| language  | String| Нет          | Код языка (ru, en, uk, zh и т.д.). По умолчанию: определяется автоматически |
| prompt    | String| Нет          | Подсказка для улучшения точности транскрипции |
| speed     | String| Нет          | Предпочтение скорости ("fast" или "accurate"). По умолчанию: сбалансированный режим |
| detailed  | String| Нет          | Если "true", возвращает детализированный вывод с временными метками |

#### Пример ответа

```json
{
  "text": "Это пример текста транскрипции...",
  "model": "gpt-4o-mini-transcribe",
  "processingTime": 1.23,
  "fileSize": 12345,
  "fileName": "audio.mp3",
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 2.5,
      "text": "Это пример"
    },
    {
      "id": 1,
      "start": 2.5,
      "end": 5.0,
      "text": "текста транскрипции"
    }
  ]
}
```

### 2. Сравнительная транскрипция

`POST /api/transcribe/compare`

Этот эндпоинт транскрибирует аудиофайл с использованием всех доступных моделей и возвращает результаты для сравнения.

#### Параметры запроса (multipart/form-data)

| Параметр  | Тип   | Обязательный | Описание |
|-----------|-------|--------------|----------|
| audio     | File  | Да           | Аудиофайл для транскрипции |
| language  | String| Нет          | Код языка (ru, en, uk, zh и т.д.). По умолчанию: определяется автоматически |
| prompt    | String| Нет          | Подсказка для улучшения точности транскрипции |

#### Пример ответа

```json
{
  "whisper-1": {
    "text": "Текст транскрипции от модели Whisper",
    "processingTime": 0.97
  },
  "gpt-4o-transcribe": {
    "text": "Текст транскрипции от модели GPT-4o Transcribe",
    "processingTime": 2.14
  },
  "gpt-4o-mini-transcribe": {
    "text": "Текст транскрипции от модели GPT-4o Mini Transcribe",
    "processingTime": 1.32
  },
  "fileSize": 12345,
  "fileName": "audio.mp3"
}
```

## Рекомендации по использованию

1. **Всегда указывайте язык** - это значительно повышает точность транскрипции
2. **Для русского языка**:
   - Короткие записи (до 30 сек): предпочтительна модель `gpt-4o-mini-transcribe`
   - Средние записи (до 5 мин): предпочтительна модель `gpt-4o-transcribe`
   - Длинные записи: предпочтительна модель `whisper-1`
3. **Для английского языка**:
   - Для большинства случаев: предпочтительна модель `whisper-1`
   - Для сложных акцентов: предпочтительна модель `gpt-4o-transcribe`
4. **Используйте подсказки** для улучшения точности при наличии специфической терминологии или контекста
5. **Оптимальная длительность аудиофайлов** - до 10 минут
6. **Качество аудио** значительно влияет на точность транскрипции:
   - Избегайте шумных аудиозаписей
   - Используйте высокое качество записи
   - Предпочтительные форматы: MP3, WAV, FLAC

## Примеры кода

### JavaScript/TypeScript (React)

```typescript
// Стандартная транскрипция
const handleTranscription = async (audioFile: File) => {
  const formData = new FormData();
  formData.append("audio", audioFile);
  formData.append("language", "ru");
  formData.append("speed", "accurate");
  
  try {
    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка: ${response.status}`);
    }
    
    const result = await response.json();
    console.log("Результат транскрипции:", result.text);
  } catch (error) {
    console.error("Ошибка при транскрипции:", error);
  }
};

// Сравнительная транскрипция
const handleComparisonTranscription = async (audioFile: File) => {
  const formData = new FormData();
  formData.append("audio", audioFile);
  formData.append("language", "ru");
  
  try {
    const response = await fetch("/api/transcribe/compare", {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка: ${response.status}`);
    }
    
    const result = await response.json();
    console.log("Результаты сравнения:", result);
  } catch (error) {
    console.error("Ошибка при сравнительной транскрипции:", error);
  }
};
```

### Node.js (backend)

```javascript
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

async function transcribeAudio(audioFilePath) {
  const formData = new FormData();
  formData.append("audio", fs.createReadStream(audioFilePath));
  formData.append("language", "ru");
  
  try {
    const response = await fetch("http://localhost:5000/api/transcribe", {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка: ${response.status}`);
    }
    
    const result = await response.json();
    console.log("Результат транскрипции:", result.text);
    return result;
  } catch (error) {
    console.error("Ошибка при транскрипции:", error);
    throw error;
  }
}

// Пример использования
transcribeAudio("./audio.mp3").catch(console.error);
```

## Интеграция с UI

Для удобного использования API транскрипции в пользовательском интерфейсе мы предоставляем демонстрационную страницу:

`/transcription-demo`

Эта страница позволяет:
- Загружать аудиофайлы для транскрипции
- Выбирать параметры транскрипции (язык, скорость и т.д.)
- Просматривать результаты транскрипции в разных форматах
- Сравнивать результаты различных моделей

## Ограничения

1. Максимальный размер аудиофайла: 25 МБ
2. Поддерживаемые форматы: MP3, WAV, FLAC, M4A, MP4, MPEG, MPGA, OGG, WEBM
3. Максимальная длительность аудио: 60 минут (рекомендуется не более 10 минут для оптимальной производительности)
4. Количество запросов: до 50 запросов в час

## Устранение неполадок

| Проблема | Возможные причины | Решение |
|----------|-------------------|---------|
| 400 Bad Request | Неподдерживаемый формат файла | Преобразуйте файл в MP3, WAV или другой поддерживаемый формат |
| 413 Payload Too Large | Файл слишком большой | Уменьшите размер файла или разделите его на части |
| 502 Bad Gateway | Проблема с сервисом OpenAI | Повторите запрос позже |
| Низкое качество транскрипции | Шумный аудиофайл | Улучшите качество аудио, используйте подсказки |
| Неправильный язык | Не указан язык | Всегда указывайте язык для повышения точности |