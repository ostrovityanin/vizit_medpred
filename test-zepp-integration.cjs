/**
 * Скрипт для тестирования интеграции Zepp OS с нашим сервером
 * Эмулирует отправку аудио фрагментов и финализацию записи
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Конфигурация
const SERVER_URL = 'http://localhost:5000'; // Адрес нашего сервера
const TEST_SESSION_ID = 'test-zepp-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
const TEST_FRAGMENTS_COUNT = 3; // Количество тестовых фрагментов для отправки

// Проверяем несколько путей с тестовыми аудиофайлами
const TEST_AUDIO_PATHS = [
  './server/fragments/fragment-session-1742402867910-584-00001.webm',
  './server/fragments/combined-session-1742402867910-584.webm',
  './server/fragments/combined-test-zepp-1742676698212-276.webm'
];

// Выбираем первый существующий файл
let TEST_AUDIO_PATH = null;
for (const filePath of TEST_AUDIO_PATHS) {
  if (fs.existsSync(filePath)) {
    TEST_AUDIO_PATH = filePath;
    break;
  }
}

if (!TEST_AUDIO_PATH) {
  TEST_AUDIO_PATH = TEST_AUDIO_PATHS[0]; // Используем первый путь, если ни один файл не найден
  console.warn(`Внимание: Не найдено тестовых аудиофайлов. Будет использован путь: ${TEST_AUDIO_PATH}`);
}

/**
 * Отправляет фрагмент на сервер
 * @param {number} index - Индекс фрагмента
 */
async function sendFragment(index) {
  try {
    // Проверяем наличие тестового аудиофайла
    if (!fs.existsSync(TEST_AUDIO_PATH)) {
      console.error(`Тестовый аудиофайл не найден: ${TEST_AUDIO_PATH}`);
      return false;
    }

    const formData = new FormData();
    formData.append('fragmentAudio', fs.createReadStream(TEST_AUDIO_PATH));
    formData.append('sessionId', TEST_SESSION_ID);
    formData.append('index', index);
    formData.append('deviceInfo', JSON.stringify({
      model: 'gtr3-pro',
      firmware: '3.0.0',
      battery: 85,
      storage: { free: 1024 * 1024 * 50, total: 1024 * 1024 * 100 }
    }));

    console.log(`Отправка фрагмента ${index + 1}/${TEST_FRAGMENTS_COUNT}...`);
    
    const response = await axios.post(`${SERVER_URL}/api/zepp/recording-fragments`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    console.log(`Фрагмент ${index + 1} отправлен. Ответ:`, response.data);
    return true;
  } catch (error) {
    console.error(`Ошибка при отправке фрагмента ${index + 1}:`, error.message);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    return false;
  }
}

/**
 * Финализирует запись, отправляя запрос на объединение фрагментов
 */
async function finalizeRecording() {
  try {
    console.log('Финализация записи...');
    
    const response = await axios.post(`${SERVER_URL}/api/zepp/finalize-recording`, {
      sessionId: TEST_SESSION_ID,
      fragmentCount: TEST_FRAGMENTS_COUNT,
      duration: 30 * TEST_FRAGMENTS_COUNT, // 30 секунд на фрагмент
      deviceInfo: {
        model: 'gtr3-pro',
        firmware: '3.0.0',
        appVersion: '1.0.0'
      }
    });

    console.log('Запись финализирована. Ответ:', response.data);
    return response.data;
  } catch (error) {
    console.error('Ошибка при финализации записи:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    return null;
  }
}

/**
 * Запускает тестирование интеграции
 */
async function runTest() {
  console.log(`Начало тестирования интеграции Zepp OS. Сессия: ${TEST_SESSION_ID}`);
  console.log(`Используется тестовый аудиофайл: ${TEST_AUDIO_PATH}`);
  
  // Отправляем фрагменты
  let allFragmentsSent = true;
  for (let i = 0; i < TEST_FRAGMENTS_COUNT; i++) {
    const success = await sendFragment(i);
    if (!success) {
      allFragmentsSent = false;
      console.error(`Не удалось отправить фрагмент ${i + 1}. Тест прерван.`);
      break;
    }
    
    // Небольшая пауза между отправками
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Если все фрагменты отправлены успешно, финализируем запись
  if (allFragmentsSent) {
    const result = await finalizeRecording();
    if (result && result.success) {
      console.log(`\n✅ Интеграция работает успешно! Создана запись с ID: ${result.recordingId}`);
    } else {
      console.error('\n❌ Тест не пройден. Не удалось финализировать запись.');
    }
  } else {
    console.error('\n❌ Тест не пройден. Не все фрагменты были отправлены успешно.');
  }
}

// Запускаем тест
runTest().catch(error => {
  console.error('Неожиданная ошибка при выполнении теста:', error);
});