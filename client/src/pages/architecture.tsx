import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Architecture() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Архитектура Telegram Mini App для записи аудио</h1>
      
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Общая структура</TabsTrigger>
          <TabsTrigger value="backend">Бэкенд</TabsTrigger>
          <TabsTrigger value="frontend">Фронтенд</TabsTrigger>
          <TabsTrigger value="audio">Аудио процессинг</TabsTrigger>
        </TabsList>
        
        {/* ОБЩАЯ СТРУКТУРА */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Общая архитектура системы</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 border rounded-lg bg-stone-50 dark:bg-stone-900 text-sm">
                <div className="font-mono mb-4">
                  {`
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                     АРХИТЕКТУРА TELEGRAM MINI APP                         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                                     │
            ┌─────────────────────────────────────────────┐
            │                                             │
            ▼                                             ▼
┌───────────────────────────┐              ┌───────────────────────────┐
│       КЛИЕНТСКАЯ ЧАСТЬ    │              │       СЕРВЕРНАЯ ЧАСТЬ     │
│                           │              │                           │
│  - React/TypeScript UI    │────API─────▶│  - Express сервер         │
│  - Telegram SDK           │◀───JSON────│  - Обработка данных        │
│  - Web Audio API          │              │  - Хранение в файлах      │
│  - Фрагментация аудио     │              │  - OpenAI интеграция      │
└───────────────────────────┘              └───────────────────────────┘
            │                                             │
            ▼                                             ▼
┌───────────────────────────┐              ┌───────────────────────────┐
│  ИНТЕРФЕЙС ПОЛЬЗОВАТЕЛЯ   │              │   ОБРАБОТКА МЕДИАФАЙЛОВ   │
│                           │              │                           │
│  - Запись аудио           │              │  - Объединение фрагментов │
│  - Просмотр записей       │              │  - Транскрипция (OpenAI)  │
│  - Отправка через Telegram│              │  - Оптимизация аудио      │
└───────────────────────────┘              └───────────────────────────┘
                                                         │
                                                         ▼
                                      ┌───────────────────────────┐
                                      │ TELEGRAM ИНТЕГРАЦИЯ       │
                                      │                           │
                                      │  - Клиентский бот         │
                                      │  - Админский бот          │
                                      │  - Отправка сообщений     │
                                      └───────────────────────────┘
                  `}
                </div>
                
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-2">Основные компоненты системы:</h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      <strong>Клиентская часть:</strong> React-приложение, встроенное в Telegram Mini App, отвечает за запись аудио через браузер
                    </li>
                    <li>
                      <strong>Серверная часть:</strong> Express-сервер для обработки API-запросов, хранения и обработки аудиофайлов
                    </li>
                    <li>
                      <strong>Хранилище данных:</strong> Файловое хранилище для записей и JSON-файлов с метаданными
                    </li>
                    <li>
                      <strong>Telegram интеграция:</strong> Клиентский и админский боты для доставки сообщений и файлов пользователям
                    </li>
                    <li>
                      <strong>OpenAI интеграция:</strong> Использование сервисов Whisper и GPT-4 для транскрипции и форматирования аудиозаписей
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* БЭКЕНД */}
        <TabsContent value="backend">
          <Card>
            <CardHeader>
              <CardTitle>Архитектура серверной части</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 border rounded-lg bg-stone-50 dark:bg-stone-900 text-sm">
                <div className="font-mono mb-4">
                  {`
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                     АРХИТЕКТУРА БЭКЕНДА                                   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                                     │
                 ┌──────────────────────────────────────┐
                 │                                      │
                 ▼                                      ▼
┌─────────────────────────────┐        ┌─────────────────────────────┐
│       EXPRESS СЕРВЕР        │        │      МОДУЛИ ОБРАБОТКИ       │
│ (server/index.ts)           │        │                             │
│                             │        │ - routes.ts (API маршруты)  │
│ - Точка входа               │────────▶ - storage.ts (Хранилище)    │
│ - Конфигурация              │        │ - fragments.ts (Фрагменты)  │
│ - Логирование               │        │ - openai.ts (API OpenAI)    │
└─────────────────────────────┘        └─────────────────────────────┘
          │                                           │
          ▼                                           ▼
┌─────────────────────────────┐        ┌─────────────────────────────┐
│     TELEGRAM ИНТЕГРАЦИЯ     │        │    ОБРАБОТКА МЕДИАФАЙЛОВ    │
│                             │        │                             │
│ - telegram.ts (Админ-бот)   │        │ - FFmpeg конвертация        │
│ - client-bot.ts (Клиент-бот)│        │ - Объединение фрагментов    │
│ - Отправка сообщений        │        │ - Оптимизация аудио         │
└─────────────────────────────┘        └─────────────────────────────┘
          │                                           │
          └───────────────────┬───────────────────────┘
                              │
                              ▼
                 ┌─────────────────────────────┐
                 │       ХРАНЕНИЕ ДАННЫХ       │
                 │                             │
                 │ - JSON файлы для метаданных │
                 │ - WebM файлы для аудио      │
                 │ - Папка uploads для WAV     │
                 └─────────────────────────────┘
                  `}
                </div>
                
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-2">Ключевые модули бэкенда:</h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      <strong>server/index.ts:</strong> Точка входа серверной части, настройка Express и маршрутизация
                    </li>
                    <li>
                      <strong>server/routes.ts:</strong> Описание всех API-маршрутов и обработчиков HTTP-запросов
                    </li>
                    <li>
                      <strong>server/storage.ts:</strong> Интерфейс хранилища данных, реализация MemStorage для файлового хранения
                    </li>
                    <li>
                      <strong>server/fragments.ts:</strong> Управление фрагментами аудиозаписей, их обработка и объединение
                    </li>
                    <li>
                      <strong>server/openai.ts:</strong> Интеграция с OpenAI API для транскрипции и обработки текста
                    </li>
                    <li>
                      <strong>server/telegram.ts:</strong> Интеграция с Telegram Bot API для отправки сообщений и файлов
                    </li>
                    <li>
                      <strong>server/client-bot.ts:</strong> Клиентский бот для взаимодействия с пользователями
                    </li>
                  </ul>
                  
                  <h3 className="text-lg font-semibold mt-6 mb-2">Процесс обработки аудиозаписи:</h3>
                  <ol className="list-decimal pl-6 space-y-2">
                    <li>Получение фрагментов от клиента через API</li>
                    <li>Хранение фрагментов во временных файлах</li>
                    <li>Объединение фрагментов в один файл</li>
                    <li>Оптимизация аудио для транскрипции (понижение битрейта, каналов, частоты)</li>
                    <li>Отправка в OpenAI Whisper для базовой транскрипции</li>
                    <li>Обработка текста с помощью GPT-4 для выделения говорящих</li>
                    <li>Сохранение результатов в хранилище</li>
                    <li>Доставка результатов пользователям через API или Telegram</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* ФРОНТЕНД */}
        <TabsContent value="frontend">
          <Card>
            <CardHeader>
              <CardTitle>Архитектура клиентской части</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 border rounded-lg bg-stone-50 dark:bg-stone-900 text-sm">
                <div className="font-mono mb-4">
                  {`
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                     АРХИТЕКТУРА ФРОНТЕНДА                                 │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                                     │
                 ┌──────────────────────────────────────┐
                 │                                      │
                 ▼                                      ▼
┌─────────────────────────────┐        ┌─────────────────────────────┐
│       REACT ПРИЛОЖЕНИЕ      │        │      TELEGRAM ИНТЕГРАЦИЯ    │
│ (client/src/App.tsx)        │        │                             │
│                             │        │ - Telegram Mini App SDK     │
│ - Роутинг (wouter)          │────────▶ - WebApp API                │
│ - Страницы и компоненты     │        │ - Проверка авторизации      │
└─────────────────────────────┘        └─────────────────────────────┘
          │                                           │
          ▼                                           ▼
┌─────────────────────────────┐        ┌─────────────────────────────┐
│     АУДИО ОБРАБОТКА         │        │     API ВЗАИМОДЕЙСТВИЕ      │
│                             │        │                             │
│ - Web Audio API             │        │ - React Query               │
│ - MediaRecorder             │        │ - Axios для запросов        │
│ - Фрагментация записи       │        │ - Типизированные интерфейсы │
└─────────────────────────────┘        └─────────────────────────────┘
          │                                           │
          └───────────────────┬───────────────────────┘
                              │
                              ▼
                 ┌─────────────────────────────┐
                 │       СТРАНИЦЫ ПРИЛОЖЕНИЯ   │
                 │                             │
                 │ - Домашняя страница         │
                 │ - Список записей            │
                 │ - Админ-панель              │
                 │ - Проигрыватель записей     │
                 └─────────────────────────────┘
                  `}
                </div>
                
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-2">Ключевые модули фронтенда:</h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      <strong>client/src/main.tsx:</strong> Точка входа приложения, интеграция с Telegram Mini App
                    </li>
                    <li>
                      <strong>client/src/App.tsx:</strong> Основной компонент приложения с маршрутизацией
                    </li>
                    <li>
                      <strong>client/src/pages/:</strong> Страницы приложения (домашняя, записи, админка)
                    </li>
                    <li>
                      <strong>client/src/lib/audioRecorder.ts:</strong> Класс для управления записью аудио с фрагментацией
                    </li>
                    <li>
                      <strong>client/src/lib/telegram.ts:</strong> Функции для взаимодействия с Telegram API
                    </li>
                    <li>
                      <strong>client/src/components/:</strong> Переиспользуемые компоненты интерфейса
                    </li>
                  </ul>
                  
                  <h3 className="text-lg font-semibold mt-6 mb-2">Процесс записи аудио:</h3>
                  <ol className="list-decimal pl-6 space-y-2">
                    <li>Запрос разрешения на доступ к микрофону</li>
                    <li>Создание потока аудио через Web Audio API</li>
                    <li>Улучшение качества звука (усиление, шумоподавление)</li>
                    <li>Разделение записи на фрагменты по 30 секунд</li>
                    <li>Параллельная отправка фрагментов на сервер</li>
                    <li>Отображение прогресса записи пользователю</li>
                    <li>Сохранение фрагментов в IndexedDB при проблемах с сетью</li>
                    <li>Запрос объединения фрагментов при завершении записи</li>
                  </ol>
                  
                  <h3 className="text-lg font-semibold mt-6 mb-2">Основные страницы:</h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Home:</strong> Запись нового аудио</li>
                    <li><strong>Recordings:</strong> Список записей пользователя</li>
                    <li><strong>AdminPanel:</strong> Панель управления админа</li>
                    <li><strong>AudioBrowser:</strong> Просмотр списка аудиозаписей</li>
                    <li><strong>UserRecordings:</strong> Записи конкретного пользователя</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* АУДИО ПРОЦЕССИНГ */}
        <TabsContent value="audio">
          <Card>
            <CardHeader>
              <CardTitle>Архитектура обработки аудио</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 border rounded-lg bg-stone-50 dark:bg-stone-900 text-sm">
                <div className="font-mono mb-4">
                  {`
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                     АРХИТЕКТУРА АУДИО ПРОЦЕССИНГА                         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                                     │
            ┌─────────────────────────────────────────────┐
            │                                             │
            ▼                                             ▼
┌───────────────────────────┐              ┌───────────────────────────┐
│   ЗАПИСЬ НА КЛИЕНТЕ       │              │   ОБРАБОТКА НА СЕРВЕРЕ    │
│ (audioRecorder.ts)        │              │ (fragments.ts)            │
│                           │              │                           │
│ - Web Audio API           │─────────────▶│ - Хранение фрагментов     │
│ - MediaRecorder           │  Фрагменты   │ - Объединение WebM        │
│ - AudioContext            │  (30 сек)    │ - Конвертация в WAV       │
└───────────────────────────┘              └───────────────────────────┘
                                                         │
                                                         ▼
                                      ┌───────────────────────────┐
                                      │   ОБРАБОТКА В OPENAI      │
                                      │ (openai.ts)               │
                                      │                           │
                                      │ - Whisper транскрипция    │
                                      │ - GPT-4 разметка диалога  │
                                      │ - Оптимизация токенов     │
                                      └───────────────────────────┘
                                                   │
                              ┌───────────────────┴───────────────────┐
                              │                                       │
                              ▼                                       ▼
               ┌───────────────────────────┐         ┌───────────────────────────┐
               │ ОПТИМИЗАЦИЯ АУДИО         │         │ ДОСТАВКА РЕЗУЛЬТАТОВ      │
               │                           │         │                           │
               │ - Понижение битрейта      │         │ - Отправка в Telegram     │
               │ - Моно канал (1)          │         │ - Загрузка транскрипции   │
               │ - 16 кГц частота          │         │ - Загрузка аудио          │
               │ - Разделение больших файлов│         │ - Уведомление пользователя│
               └───────────────────────────┘         └───────────────────────────┘
                  `}
                </div>
                
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-2">Алгоритм обработки аудио:</h3>
                  
                  <p className="mb-4">На стороне клиента (browser):</p>
                  <ol className="list-decimal pl-6 space-y-2 mb-6">
                    <li>Получение потока аудио через <code>navigator.mediaDevices.getUserMedia()</code></li>
                    <li>Создание <code>AudioContext</code> для обработки звука (увеличение громкости)</li>
                    <li>Настройка <code>MediaRecorder</code> для WebM формата</li>
                    <li>Фрагментация аудио на части по 30 секунд для надежности передачи</li>
                    <li>Параллельная отправка фрагментов на сервер по мере их создания</li>
                    <li>Автоматическое завершение записи после 15 минут или по команде пользователя</li>
                    <li>Отправка запроса на объединение всех фрагментов записи</li>
                  </ol>
                  
                  <p className="mb-4">На стороне сервера:</p>
                  <ol className="list-decimal pl-6 space-y-2 mb-6">
                    <li>Прием и хранение аудио-фрагментов</li>
                    <li>Объединение фрагментов в один WebM-файл с помощью FFmpeg</li>
                    <li>Оптимизация аудио для передачи в OpenAI:
                      <ul className="list-disc pl-6 mt-2">
                        <li>Преобразование в моно (1 канал)</li>
                        <li>Уменьшение частоты до 16 кГц</li>
                        <li>Снижение битрейта до 32 кбит/с</li>
                        <li>Конвертация в MP3 формат</li>
                      </ul>
                    </li>
                    <li>Отправка оптимизированного аудио в OpenAI Whisper API</li>
                    <li>Получение базовой транскрипции</li>
                    <li>Отправка транскрипции в GPT-4 для разметки диалога</li>
                    <li>Сохранение транскрипции и аудиофайла</li>
                    <li>Удаление временных фрагментов</li>
                  </ol>
                  
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <h3 className="text-lg font-semibold mb-2">Оптимизации процесса:</h3>
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong>Разделение больших файлов:</strong> Файлы размером свыше 25 МБ разделяются на части для обработки через OpenAI API</li>
                      <li><strong>Однопроходная обработка:</strong> Транскрипция через Whisper и разметка говорящих через GPT-4 выполняются за один проход</li>
                      <li><strong>Оптимизация инструкций:</strong> Специальные инструкции для GPT-4 запрещают добавление технических надписей и субтитров</li>
                      <li><strong>Автоматическое завершение:</strong> Запись автоматически завершается после достижения лимита в 15 минут</li>
                      <li><strong>Обработка ошибок:</strong> Система обнаруживает и обрабатывает некорректные аудиофайлы или проблемы с транскрипцией</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}