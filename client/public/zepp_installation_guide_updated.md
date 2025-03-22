# Zepp OS - Руководство по установке и интеграции

## Доступные пакеты

Ниже представлены различные версии пакетов для Zepp OS:

- **basic_zepp.zab** - Базовый пакет
- **minimal_fixed_zepp.zab** - Исправленный минимальный пакет с правильным app.json
- **pure_minimal_zepp.zab** - Чистый минимальный пакет с корректным манифестом
- **fixed_zepp_app.zab** - Пакет с исправленной файловой структурой
- **pure-minimal-zepp.deb** - Debian-пакет для альтернативной установки

## Установка на устройство Zepp OS

### Установка через Zepp OS Store

1. Скачайте файл .zab
2. Откройте приложение Zepp на вашем смартфоне
3. Перейдите в раздел "Профиль" → "Мои устройства"
4. Выберите ваши смарт-часы
5. Нажмите на "Управление приложениями"
6. В верхнем правом углу нажмите "+" и выберите скачанный файл .zab
7. Следуйте инструкциям на экране для завершения установки

### Альтернативный метод установки (Debian-пакет)

1. Скачайте файл `pure-minimal-zepp.deb`
2. На устройстве с Ubuntu/Debian выполните команду:
   ```bash
   sudo dpkg -i pure-minimal-zepp.deb
   ```
3. Приложение будет установлено в директорию: `/usr/share/zepp/apps/pure-minimal-zepp`

### Настройка Zepp OS Simulator

1. Установите Zepp OS Simulator, следуя [официальной документации](https://docs.zepp.com/docs/guides/tools/simulator/zepp-os-simulator/)
2. Создайте новый проект или откройте существующий
3. Извлеките файлы из скачанного .zab пакета
4. Скопируйте файлы в директорию вашего проекта
5. Запустите симулятор и выберите ваш проект

## Тестирование интеграции

Для тестирования интеграции с сервером без устройства можно использовать скрипт:

```javascript
/**
 * Скрипт для тестирования интеграции Zepp OS с нашим сервером
 * Эмулирует отправку аудио фрагментов и финализацию записи
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Базовый URL сервера
const BASE_URL = 'http://localhost:5000';
// Идентификатор тестовой сессии
const sessionId = `test_${Date.now()}`;
// Количество фрагментов для отправки
const totalFragments = 3;

/**
 * Отправляет фрагмент на сервер
 * @param {number} index - Индекс фрагмента
 */
async function sendFragment(index) {
  try {
    console.log(`Отправка фрагмента ${index}...`);
    
    // Создаем FormData для отправки файла
    const formData = new FormData();
    
    // Путь к тестовому аудиофайлу (убедитесь, что файл существует)
    const filePath = path.join(__dirname, 'test_audio.mp3');
    
    // Если файл не существует, используем другой подход
    if (!fs.existsSync(filePath)) {
      console.log('Тестовый аудиофайл не найден, создаем случайные данные...');
      // Создаем временный файл со случайными данными
      const tempFilePath = path.join(__dirname, `temp_${index}.mp3`);
      const randomBuffer = Buffer.alloc(1024 * 10); // 10KB случайных данных
      randomBuffer.fill(Math.random().toString());
      fs.writeFileSync(tempFilePath, randomBuffer);
      
      formData.append('file', fs.createReadStream(tempFilePath), {
        filename: `fragment_${index}.mp3`,
        contentType: 'audio/mpeg'
      });
      
      // Добавляем sessionId и index
      formData.append('sessionId', sessionId);
      formData.append('index', index.toString());
      
      const response = await axios.post(`${BASE_URL}/api/recordings/fragments`, formData, {
        headers: formData.getHeaders()
      });
      
      console.log(`Фрагмент ${index} успешно отправлен. Ответ:`, response.data);
      
      // Удаляем временный файл
      fs.unlinkSync(tempFilePath);
      
      return response.data;
    } else {
      // Используем существующий файл
      formData.append('file', fs.createReadStream(filePath), {
        filename: `fragment_${index}.mp3`,
        contentType: 'audio/mpeg'
      });
      
      // Добавляем sessionId и index
      formData.append('sessionId', sessionId);
      formData.append('index', index.toString());
      
      const response = await axios.post(`${BASE_URL}/api/recordings/fragments`, formData, {
        headers: formData.getHeaders()
      });
      
      console.log(`Фрагмент ${index} успешно отправлен. Ответ:`, response.data);
      
      return response.data;
    }
  } catch (error) {
    console.error(`Ошибка при отправке фрагмента ${index}:`, error.message);
    if (error.response) {
      console.error('Данные ответа:', error.response.data);
    }
    throw error;
  }
}

/**
 * Финализирует запись, отправляя запрос на объединение фрагментов
 */
async function finalizeRecording() {
  try {
    console.log('Финализация записи...');
    
    const response = await axios.post(`${BASE_URL}/api/recordings/finalize`, {
      sessionId,
      duration: 30 * totalFragments, // 30 секунд на каждый фрагмент
      fragmentCount: totalFragments
    });
    
    console.log('Запись успешно финализирована. Ответ:', response.data);
    return response.data;
  } catch (error) {
    console.error('Ошибка при финализации записи:', error.message);
    if (error.response) {
      console.error('Данные ответа:', error.response.data);
    }
    throw error;
  }
}

/**
 * Запускает тестирование интеграции
 */
async function runTest() {
  try {
    console.log(`Начало тестирования интеграции Zepp OS. ID сессии: ${sessionId}`);
    
    // Отправляем все фрагменты
    for (let i = 0; i < totalFragments; i++) {
      await sendFragment(i);
      // Пауза между отправками фрагментов
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Финализируем запись
    await finalizeRecording();
    
    console.log('Тестирование интеграции успешно завершено!');
  } catch (error) {
    console.error('Ошибка при тестировании интеграции:', error.message);
  }
}

// Запускаем тест
runTest();
```

Сохраните этот код в файл `test-zepp-integration.js` и запустите с помощью Node.js:

```bash
node test-zepp-integration.js
```

## Ограничения и особенности Zepp OS

### Технические ограничения

- **Размер памяти**: Ограниченный объем оперативной памяти (около 4MB)
- **Файловая система**: Ограниченное пространство для хранения файлов
- **Время записи**: Максимальная длительность непрерывной записи аудио - около 60 секунд
- **Сетевые запросы**: Ограниченный размер сетевых пакетов, рекомендуется отправлять файлы частями
- **Энергопотребление**: Запись аудио и сетевые операции значительно увеличивают расход батареи

### Структурные особенности

- Необходимо строго соблюдать структуру директорий пакета
- Зависимость от версии API в файле app.json или manifest.json
- Различия в путях к файлам между симулятором и реальным устройством
- Отсутствие полноценной поддержки ES6+ JavaScript

### Рекомендации по разработке

- Разделять аудиозаписи на фрагменты по 30 секунд
- Использовать легковесные UI-компоненты
- Минимизировать количество сетевых запросов
- Добавлять обработку ошибок для всех операций с файлами и сетью
- Тестировать на реальном устройстве, а не только в симуляторе

### Совместимость

- **Поддерживаемые устройства**: Amazfit GTR 3, GTR 3 Pro, GTS 3, T-Rex 2, и новее
- **Версия Zepp OS**: Рекомендуется 2.0 и выше
- **Приложение Zepp**: Последняя версия для Android или iOS

## Структура пакета Zepp OS

Правильная структура пакета Zepp OS должна быть следующей:

```
app/
├── app.js             # Основной файл приложения
├── app.json           # Конфигурация приложения (или manifest.json)
├── page/              # Директория страниц
│   └── index.js       # Главная страница
└── utils/             # Утилиты
    ├── api.js         # API для взаимодействия с сервером
    ├── format.js      # Форматирование данных
    └── recorder.js    # Работа с аудиозаписью
```

## Пример app.json

```json
{
  "app": {
    "appId": 20001,
    "appName": "Audio Recorder",
    "appType": "app",
    "version": {
      "code": 1,
      "name": "1.0.0"
    },
    "icon": "icon.png",
    "vender": "zepp",
    "description": "Audio recording application"
  },
  "permissions": [
    "data:os.device.info",
    "device:os.local_storage",
    "data:user.info",
    "device:os.notification",
    "device:os.alarm",
    "data:user.height",
    "data:user.weight",
    "data:user.age",
    "data:user.gender",
    "device:os.wear_detection",
    "device:os.step",
    "data:user.step_target",
    "data:user.stand_target",
    "data:user.step",
    "device:os.heart_rate",
    "device:os.sound",
    "device:os.microphone"
  ],
  "runtime": {
    "apiVersion": {
      "compatible": "3.0.0",
      "target": "3.0.0",
      "minVersion": "3.0.0"
    }
  },
  "targets": {
    "gtr3-pro": {
      "module": {
        "page": {
          "pages": [
            "page/index"
          ]
        }
      },
      "platforms": [
        {
          "name": "gtr3-pro",
          "deviceSource": 229
        }
      ]
    }
  },
  "i18n": {
    "en-US": {
      "appName": "Audio Recorder"
    }
  },
  "defaultLanguage": "en-US"
}
```

## Base64 пакеты для скачивания

Если у вас нет прямого доступа к файлам, вы можете использовать base64-строки и декодировать их в бинарные файлы:

### Linux/Mac:
```bash
echo 'BASE64_СТРОКА' | base64 -d > имя_файла.zab
```

### Windows (PowerShell):
```powershell
[System.Convert]::FromBase64String('BASE64_СТРОКА') | Set-Content -Path имя_файла.zab -Encoding Byte
```

### Python:
```python
import base64
with open('имя_файла.zab', 'wb') as f:
    f.write(base64.b64decode('BASE64_СТРОКА'))
```

Ниже приведена base64 строка для basic_zepp.zab:

```
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
```

Остальные base64 строки доступны в локальном проекте по адресу [http://localhost:5000/zepp-os-docs](http://localhost:5000/zepp-os-docs) на вкладке "Base64 пакеты".