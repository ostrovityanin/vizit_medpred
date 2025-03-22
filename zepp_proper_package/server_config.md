# Конфигурация сервера для приложения Zepp OS

## Необходимые эндпоинты API

Приложение Zepp OS ожидает наличие следующих API эндпоинтов:

### 1. Загрузка фрагмента записи

**URL**: `/api/zepp/recording-fragments`  
**Метод**: `POST`  
**Формат**: `multipart/form-data`  
**Параметры**:
- `fragmentAudio` (file): аудиофайл фрагмента
- `sessionId` (string): уникальный идентификатор сессии
- `index` (number): индекс фрагмента
- `deviceInfo` (string): информация об устройстве в формате JSON

**Ответ**:
```json
{
  "success": true,
  "message": "Fragment uploaded successfully",
  "fragmentId": 123
}
```

### 2. Завершение записи

**URL**: `/api/zepp/finalize-recording`  
**Метод**: `POST`  
**Формат**: `application/json`  
**Параметры**:
```json
{
  "sessionId": "unique-session-id",
  "fragmentCount": 3,
  "duration": 125,
  "deviceInfo": {
    "model": "gtr3-pro",
    "firmware": "3.0.25"
  }
}
```

**Ответ**:
```json
{
  "success": true,
  "recordingId": 456,
  "message": "Recording finalized successfully",
  "url": "https://yourserver.com/recordings/456"
}
```

## Обработка фрагментов

Сервер должен:
1. Сохранять полученные фрагменты
2. Объединять их в один файл при завершении записи
3. Конвертировать в нужный формат для обработки (опционально)
4. Применять транскрибацию или другую обработку (опционально)

## Требования к безопасности

- Добавьте валидацию входящих данных
- Ограничьте размер загружаемых файлов
- Проверяйте MIME-типы файлов
- Рассмотрите возможность добавления авторизации для API

## Пример реализации на Node.js

```javascript
app.post('/api/zepp/recording-fragments', upload.single('fragmentAudio'), async (req, res) => {
  try {
    const { sessionId, index } = req.body;
    const file = req.file;
    
    // Сохранение фрагмента
    await fragmentManager.saveFragment(file.buffer, sessionId, parseInt(index));
    
    res.json({
      success: true,
      message: "Fragment uploaded successfully"
    });
  } catch (error) {
    console.error('Error uploading fragment:', error);
    res.status(500).json({ success: false, message: "Error uploading fragment" });
  }
});

app.post('/api/zepp/finalize-recording', async (req, res) => {
  try {
    const { sessionId, fragmentCount, duration } = req.body;
    
    // Объединение фрагментов
    const combinedFile = await fragmentManager.combineFragments(sessionId);
    
    // Создание записи в БД
    const recording = await storage.createRecording({
      filename: `combined-${sessionId}.webm`,
      size: combinedFile.length,
      duration: duration,
      status: "completed",
      source: "zepp"
    });
    
    res.json({
      success: true,
      recordingId: recording.id,
      message: "Recording finalized successfully"
    });
  } catch (error) {
    console.error('Error finalizing recording:', error);
    res.status(500).json({ success: false, message: "Error finalizing recording" });
  }
});
```