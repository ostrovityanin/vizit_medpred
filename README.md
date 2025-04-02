# Audio Recording & Processing System

Комплексная система для записи, обработки и хранения аудиозаписей с интеграцией Telegram Mini App и Zepp OS.

## Основные возможности

- ✅ Запись аудио через веб-интерфейс
- 📱 Поддержка Telegram Mini App
- ⌚ Интеграция с устройствами Zepp OS
- 🎙️ Фрагментированная запись для обхода ограничений
- 📝 Транскрибирование аудио через OpenAI API
- 🔔 Уведомления через Telegram


## Архитектура

Проект построен на микросервисной архитектуре:

- **API Core**: Центральный API сервис
- **Audio Processor**: Обработка и транскрибирование аудио
- **Data Storage**: Управление данными
- **Monitoring**: Мониторинг состояния сервисов
- **Audio Notifier**: Отправка уведомлений в Telegram
- **Telegram App**: Клиентское приложение (Telegram Mini App)


## Технологии

- Frontend: React, Tailwind CSS, Vite
- Backend: Node.js, Express
- Storage: File System + PostgreSQL (and JSON, as mentioned in the edited version)
- API Integration: OpenAI, Telegram Bot API
- Monitoring: Node.js, Telegram Bot API (Custom Node.js solution, as mentioned in the edited version)


## Особенности реализации

- Фрагментированная запись для оптимизации памяти
- Автоматическое восстановление сервиса (this detail should be investigated further)
- Расширенное логирование состояния
- Интеграция с умными часами Zepp OS
- Веб-интерфейс администратора (Admin-service from original)


## Запуск проекта

### Предварительные требования:
- Node.js 20+
- Токен Telegram бота в переменных окружения

### Переменные окружения:
```
TELEGRAM_BOT_TOKEN=<your_bot_token>
TELEGRAM_CHAT_ID=<your_chat_id>
```

### Команды запуска:
```bash
# Установка зависимостей
npm install

# Запуск приложения
npm run dev

# Запуск мониторинга (опционально)
node services/monitoring/src/index.js
```

## Структура проекта

```
├── client/          # React frontend
├── server/          # Express backend
├── services/        # Микросервисы
│   ├── api-core/    # Основной API
│   ├── audio-notifier/ # Сервис отправки аудио в Telegram (from original)
│   │   ├── src/
│   │   ├── utils/
│   │   ├── logs/
│   │   └── start.sh, stop.sh
│   ├── monitoring/  # Мониторинг
│   │   └── start-monitoring.sh, stop-monitoring.sh (from original)
│   └── ...         # Другие сервисы
├── archived/                    # Заархивированные компоненты (from original)
│   ├── README.md                # Документация по архивным компонентам
│   └── zepp_integration.tar.gz  # Архив с интеграцией Zepp OS
└── shared/          # Общие компоненты (potentially from edited)
```

## Особенности Zepp OS интеграции

- Запись аудио на устройстве
- Фрагментированная отправка на сервер
- Управление записью через часы
- Просмотр истории записей (details from both original and edited)

## Мониторинг и логирование

- Отслеживание состояния сервисов
- Уведомления о проблемах через Telegram
- Сбор и анализ логов
- Восстановление после сбоев (details from edited)

## Безопасность

- Проверка авторизации через Telegram
- Безопасное хранение аудиозаписей
- Изолированные микросервисы
- Мониторинг доступа (details from edited)


## Дальнейшее развитие

- Оптимизация обработки аудио
- Улучшение качества транскрибации
- Расширение интеграции с Zepp OS
- Улучшение системы мониторинга (details from edited)

## Микросервисы (From Original, adapted)

### Система мониторинга
Включена система мониторинга здоровья сервиса с отчетами через Telegram:

```bash
# Запуск мониторинга
./services/monitoring/start-monitoring.sh

# Остановка мониторинга
./services/monitoring/stop-monitoring.sh

# Тестирование Telegram-уведомлений
node services/test-telegram.js
```

### Сервис отправки аудио в Telegram
Автоматический сервис для отправки новых аудиозаписей и их транскрипций в Telegram группу:

```bash
# Запуск сервиса
./services/audio-notifier/start.sh

# Остановка сервиса
./services/audio-notifier/stop.sh

# Просмотр логов сервиса
./services/audio-notifier/view-logs.sh
```

### Управление всеми сервисами
Для удобного управления всеми микросервисами одновременно:

```bash
# Запуск всех сервисов
./services/start-all.sh

# Остановка всех сервисов
./services/stop-all.sh
```

Подробная информация о системе мониторинга и других сервисах доступна в документации каждого сервиса.

## Заархивированные компоненты (from original)

Для упрощения проекта и улучшения его структуры, некоторые компоненты были заархивированы:

- **Интеграция с Zepp OS** - перенесена в архив `archived/zepp_integration.tar.gz`
  - Включала интеграцию с умными часами на Zepp OS
  - Подробная информация в `archived/README.md`

Архивные компоненты не требуются для основной работы приложения и добавлены для полноты документации.