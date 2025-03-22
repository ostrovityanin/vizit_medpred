# Обзор кода Zepp OS приложения

В проекте реализован полный набор файлов и компонентов для приложения Zepp OS по записи аудио. Рассмотрим ключевые компоненты и их функциональность.

## Основные файлы и их назначение

### 1. Файлы конфигурации
- **manifest.json** - определяет основные параметры приложения, разрешения и поддерживаемые устройства
- **app.json** - вторичный конфигурационный файл для настройки устройства и страниц (используется в некоторых версиях Zepp OS)

### 2. Точки входа
- **app.js** - основной файл приложения, определяет глобальное состояние
- **index.js** - точка входа, импортирует app.js

### 3. Страницы приложения
- **page/index.js** - главная страница с кнопкой записи и списком последних записей
- **page/recording.js** - страница с интерфейсом записи, включая таймер и управление

### 4. Утилиты
- **utils/recorder.js** - класс для работы с микрофоном, записи и отправки фрагментов
- **utils/api.js** - функции для взаимодействия с сервером
- **utils/format.js** - функции для форматирования времени, даты, размера файлов

## Ключевая функциональность

### Запись аудио (recorder.js)

```javascript
// Начало записи
startRecording() {
  // Генерация идентификатора сессии
  this.sessionId = generateSessionId();
  this.isRecording = true;
  
  // Начинаем запись фрагмента
  this.startRecordingFragment();
  
  // Устанавливаем максимальное время записи
  this.maxDurationTimer = setTimeout(() => {
    this.stopRecording('max_duration_reached');
  }, MAX_RECORDING_DURATION * 1000);
}

// Запись фрагмента
startRecordingFragment() {
  // Создаем микрофон с оптимальными параметрами для распознавания
  this.microphone = createMicrophone({
    format: 'webm',
    sampleRate: 16000, // 16kHz
    channels: 1, // mono
    bitRate: 32000, // 32 kbps
    filePath: fragmentPath
  });
  
  // Устанавливаем таймер для максимальной продолжительности фрагмента
  this.fragmentTimer = setTimeout(() => {
    this.finalizeFragment();
  }, MAX_FRAGMENT_DURATION * 1000);
}
```

### Взаимодействие с сервером (api.js)

```javascript
// Отправка фрагмента на сервер
export const sendAudioFragment = async (filePath, sessionId, index = 0) => {
  try {
    // Подготовка данных для отправки
    const formData = new FormData();
    formData.append('fragmentAudio', hmFS.readFile(filePath));
    formData.append('sessionId', sessionId);
    formData.append('index', index);
    formData.append('deviceInfo', JSON.stringify(getDeviceInfo()));
    
    // Отправка на сервер
    const response = await fetch(`${API_BASE_URL}/api/zepp/recording-fragments`, {
      method: 'POST',
      body: formData
    });
    
    return await response.json();
  } catch (error) {
    return { error: error.message };
  }
}

// Финализация записи
export const finishRecording = async (sessionId, duration = 0, fragmentCount = 0) => {
  try {
    // Подготовка данных
    const data = {
      sessionId,
      duration,
      fragmentCount,
      deviceInfo: getDeviceInfo()
    };
    
    // Отправка запроса
    const response = await fetch(`${API_BASE_URL}/api/zepp/finalize-recording`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    return await response.json();
  } catch (error) {
    return { error: error.message };
  }
}
```

### Пользовательский интерфейс (page/recording.js)

```javascript
// Построение интерфейса страницы записи
build() {
  const mainContainer = createElement('view', {
    style: styles.mainContainer
  });
  
  // Таймер записи
  this.timerText = createElement('text', {
    style: styles.timerText,
    text: '00:00'
  });
  mainContainer.appendChild(this.timerText);
  
  // Индикатор записи
  this.recordingIndicator = createElement('view', {
    style: styles.recordingIndicator
  });
  mainContainer.appendChild(this.recordingIndicator);
  
  // Кнопка остановки записи
  const stopButton = createElement('view', {
    style: styles.stopButton,
    onclick: () => this.stopRecording()
  });
  
  stopButton.appendChild(
    createElement('text', {
      style: styles.stopButtonText,
      text: 'СТОП'
    })
  );
  
  mainContainer.appendChild(stopButton);
  
  // Запуск записи при открытии страницы
  this.startRecording();
  
  return mainContainer;
}
```

## Оптимизации и улучшения производительности

1. **Фрагментированная запись**
   - Запись разделена на фрагменты по 30 секунд для снижения нагрузки на устройство
   - Каждый фрагмент отправляется отдельно, что снижает риск потери данных

2. **Параметры аудио**
   - Использование монофонического режима (1 канал)
   - Частота дискретизации 16kHz оптимальна для распознавания речи
   - Битрейт 32kbps снижает размер файла, сохраняя качество голоса

3. **Механизм повторных попыток**
   - Реализован механизм повторной отправки фрагментов при сбоях сети
   - Автоматическая очистка временных файлов

4. **Энергоэффективность**
   - Ограничение максимальной продолжительности записи (10 минут)
   - Освобождение ресурсов микрофона после каждого фрагмента

## Полнота реализации

Приложение для Zepp OS полностью реализовано со всеми необходимыми компонентами:

✅ Запись аудио с микрофона часов  
✅ Фрагментация для эффективной отправки  
✅ Интеграция с сервером для хранения и обработки  
✅ Пользовательский интерфейс для взаимодействия  
✅ Обработка ошибок и повторные попытки  
✅ Работа с локальным хранилищем часов

Единственное ограничение - отсутствие возможности тестирования на реальном устройстве или в официальном симуляторе Zepp OS.