# Настройка серверной части для работы с Zepp OS

## 1. Настройка API эндпоинтов

Для интеграции с приложением Zepp OS, сервер должен обеспечивать следующие API эндпоинты:

### 1.1. Прием фрагментов аудиозаписи
```
POST /api/zepp/recording-fragments
```

Параметры запроса:
- `fragmentAudio` (file): файл аудиозаписи в формате WebM
- `sessionId` (string): уникальный идентификатор сессии записи
- `deviceId` (string): идентификатор устройства Zepp
- `index` (number): индекс фрагмента (для больших записей)

### 1.2. Финализация записи
```
POST /api/zepp/finalize-recording
```

Параметры запроса:
- `sessionId` (string): идентификатор сессии записи
- `deviceId` (string): идентификатор устройства
- `duration` (number): продолжительность записи в секундах
- `fragmentCount` (number): количество отправленных фрагментов

## 2. Настройка CORS

Для корректной работы с приложениями на Zepp OS, необходимо настроить CORS на сервере:

```javascript
// Пример настройки CORS в Express.js
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});
```

## 3. SSL/TLS сертификат

Zepp OS требует защищенное соединение для работы с API. Убедитесь, что ваш сервер использует действующий SSL/TLS сертификат.

## 4. Настройка доменного имени

1. Зарегистрируйте постоянное доменное имя для вашего сервера
2. Настройте DNS-записи для указания на IP-адрес вашего сервера
3. Обновите URL в приложении Zepp OS в файле `utils/api.js`

## 5. Проверка конфигурации

После настройки сервера, проверьте его работу с тестовым скриптом:

```bash
node test-zepp-integration.js
```

## 6. Важные замечания

### 6.1. Формат аудиофайлов
Приложение Zepp OS отправляет аудиофайлы в формате WebM. Убедитесь, что ваш сервер может обрабатывать этот формат и конвертировать его при необходимости.

### 6.2. Обработка фрагментов
Часы Zepp разбивают большие записи на фрагменты. Сервер должен корректно объединять эти фрагменты в один файл для дальнейшей обработки.

### 6.3. Повторные попытки отправки
Приложение Zepp OS реализует механизм повторных попыток при сбоях сети. Учитывайте это при разработке серверной логики, чтобы избежать дублирования данных.

### 6.4. Ограничения размера файла
Учитывайте ограничения Zepp OS на размер отправляемых файлов (обычно до 1 МБ на фрагмент).

## 7. Примеры обработки данных от Zepp OS

### 7.1. Пример обработки фрагмента записи:
```javascript
app.post('/api/zepp/recording-fragments', upload.single('fragmentAudio'), async (req, res) => {
  try {
    const { sessionId, deviceId, index } = req.body;
    const audioFile = req.file;
    
    // Сохранение фрагмента
    const fragment = await fragmentManager.saveFragment(
      audioFile.buffer,
      sessionId,
      parseInt(index || '0'),
      deviceId
    );
    
    res.status(201).json({
      success: true,
      message: 'Фрагмент успешно получен и сохранен',
      fragment
    });
  } catch (error) {
    console.error('[zepp] Ошибка при сохранении фрагмента:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при сохранении фрагмента',
      error: error.message
    });
  }
});
```

### 7.2. Пример обработки финализации записи:
```javascript
app.post('/api/zepp/finalize-recording', async (req, res) => {
  try {
    const { sessionId, deviceId, duration, fragmentCount } = req.body;
    
    // Объединение фрагментов
    const combinedFile = await fragmentManager.getCombinedFile(sessionId);
    if (!combinedFile) {
      throw new Error('Не удалось получить объединенный файл');
    }
    
    // Создание записи в БД
    const recording = await storage.createAdminRecording({
      filename: null, // будет заполнено позже
      duration: parseInt(duration || '0'),
      timestamp: new Date().toISOString(),
      targetUsername: 'archive',
      senderUsername: deviceId,
      status: 'completed',
      fileSize: combinedFile.length,
      sessionId
    });
    
    // Конвертация и сохранение аудиофайла
    const wavPath = await fragmentManager.convertCombinedToWav(sessionId, recording.id);
    
    // Обновление записи с правильным путем к файлу
    if (wavPath) {
      const filename = path.basename(wavPath);
      await storage.updateAdminRecording({
        ...recording,
        filename
      });
    }
    
    res.json({
      success: true,
      message: 'Запись успешно создана',
      recording
    });
    
    // Запуск транскрипции в фоновом режиме
    if (wavPath) {
      transcribeRecording(wavPath, recording.id);
    }
  } catch (error) {
    console.error('[zepp] Ошибка при финализации записи:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при финализации записи',
      error: error.message
    });
  }
});
```

## 8. Настройка хостинга

Рекомендуется использовать надежный хостинг с высокой доступностью:

- **VPS/Dedicated сервер**: обеспечивает полный контроль над окружением
- **Docker**: упрощает развертывание и масштабирование
- **PM2**: менеджер процессов для Node.js приложений, обеспечивающий автоматический перезапуск при сбоях

## 9. Мониторинг

Настройте мониторинг для отслеживания состояния серверной части:

- Логирование всех запросов от устройств Zepp
- Оповещения о критических ошибках
- Мониторинг использования ресурсов сервера (CPU, RAM, диск)