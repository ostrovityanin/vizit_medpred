# Альтернативные форматы пакетов Zepp OS для тестирования

## Введение

Симулятор Zepp OS и реальные устройства могут иметь разные требования к формату пакета. Мы подготовили несколько версий пакета с разными структурами для повышения шансов успешной установки.

## Доступные форматы пакетов

| Имя файла | Описание | URL для скачивания |
|-----------|----------|-------------------|
| `zepp_app_bundle.zab` | Основной пакет | http://[ваш_сервер]/zepp_app_bundle.zab |
| `third_attempt.zab` | Альтернативная версия с файлами в корне и в папке app | http://[ваш_сервер]/third_attempt.zab |
| `raw_format.zab` | Минимальный пакет с базовой структурой | http://[ваш_сервер]/raw_format.zab |

## Структуры пакетов

### 1. Основной пакет (zepp_app_bundle.zab)
```
/
├── app/
│   ├── app.json
│   ├── app-side.js
│   ├── index.js
│   ├── assets/
│   ├── images/
│   ├── page/
│   │   ├── index.js
│   │   └── recording.js
│   └── utils/
│       ├── api.js
│       ├── format.js
│       └── recorder.js
├── i18n/
├── module/
├── zepp.config.json
├── manifest.json
├── appinfo.json
├── app.js
├── icon.png
└── cover.png
```

### 2. Альтернативная версия (third_attempt.zab)
```
/
├── app/
│   ├── app.json
│   ├── app-side.js
│   ├── index.js
│   ├── assets/
│   ├── images/
│   ├── page/
│   │   ├── index.js
│   │   └── recording.js
│   └── utils/
│       ├── api.js
│       ├── format.js
│       └── recorder.js
├── page/
│   ├── index.js
│   └── recording.js
├── i18n/
├── module/
├── zepp.config.json
├── manifest.json
├── appinfo.json
├── app.js
├── icon.png
└── cover.png
```

### 3. Минимальный пакет (raw_format.zab)
```
/
├── app/
├── page/
├── manifest.json
└── app.json
```

## Рекомендации по выбору формата

1. **Сначала попробуйте основной пакет** (`zepp_app_bundle.zab`).
2. Если появляется ошибка `open manifest.json: no such file or directory`, попробуйте `third_attempt.zab`.
3. Если обе версии не работают, попробуйте минимальный пакет `raw_format.zab` для проверки, принимает ли симулятор хотя бы базовую структуру.

## Отчет об ошибках

Если ни один формат не работает, сообщите нам точный текст ошибки и:
1. Версию симулятора Zepp OS
2. Версию операционной системы
3. Скриншот ошибки (если возможно)

## Тестирование без установки пакета

Для проверки работы API без установки приложения используйте скрипт `test-zepp-integration.js`:

```bash
node test-zepp-integration.js
```

Этот скрипт эмулирует отправку аудио-фрагментов и финализацию записи без необходимости запускать симулятор.