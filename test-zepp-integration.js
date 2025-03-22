/**
 * Скрипт для тестирования интеграции Zepp OS с нашим сервером
 * Эмулирует отправку аудио фрагментов и финализацию записи
 */

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Настройки тестирования
const API_URL = 'http://localhost:5000';
const FRAGMENTS_DIR = path.join(__dirname, 'server', 'fragments');
const SESSION_ID = `test-zepp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const DEVICE_ID = 'TestDevice-Amazfit';
const TOTAL_FRAGMENTS = 3;

// Создаем временный каталог для тестирования, если он не существует
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR);
}

// Функция для отправки фрагмента на сервер
async function sendFragment(index) {
  try {
    console.log(`\n[Fragment ${index}] Отправка фрагмента #${index} на сервер...`);
    
    // Получаем список существующих фрагментов для тестирования
    const fragmentFiles = fs.readdirSync(FRAGMENTS_DIR)
      .filter(file => file.startsWith('fragment-session'))
      .sort();
    
    if (fragmentFiles.length === 0) {
      console.error('Не найдены тестовые фрагменты в директории', FRAGMENTS_DIR);
      return false;
    }
    
    // Выбираем файл для тестирования (по индексу или случайно)
    const fileIndex = index % fragmentFiles.length;
    const fragmentFile = fragmentFiles[fileIndex];
    const fragmentPath = path.join(FRAGMENTS_DIR, fragmentFile);
    
    console.log(`Используем файл для тестирования: ${fragmentFile}`);
    
    // Создаем FormData для отправки
    const formData = new FormData();
    // Явно указываем MIME тип аудио для WebM файла
    formData.append('fragmentAudio', fs.createReadStream(fragmentPath), {
      filename: path.basename(fragmentPath),
      contentType: 'audio/webm'
    });
    formData.append('sessionId', SESSION_ID);
    formData.append('index', index.toString());
    formData.append('deviceId', DEVICE_ID);
    
    // Отправляем запрос
    const response = await axios.post(`${API_URL}/api/zepp/recording-fragments`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });
    
    console.log(`[Fragment ${index}] Ответ сервера:`, response.data);
    return true;
  } catch (error) {
    console.error(`[Fragment ${index}] Ошибка при отправке фрагмента:`, 
                  error.response ? error.response.data : error.message);
    return false;
  }
}

// Функция для финализации записи
async function finalizeRecording() {
  try {
    console.log('\n[Finalize] Финализация записи...');
    
    const response = await axios.post(`${API_URL}/api/zepp/finalize-recording`, {
      sessionId: SESSION_ID,
      deviceId: DEVICE_ID,
      duration: TOTAL_FRAGMENTS * 30, // 30 секунд на фрагмент
      fragments: TOTAL_FRAGMENTS
    });
    
    console.log('[Finalize] Ответ сервера:', response.data);
    
    if (response.data.recording && response.data.recording.id) {
      console.log(`\n[Success] Запись успешно создана, ID: ${response.data.recording.id}`);
      return response.data.recording.id;
    } else {
      console.log('\n[Warning] Запись создана, но ID не получен');
      return null;
    }
  } catch (error) {
    console.error('[Finalize] Ошибка при финализации записи:', 
                  error.response ? error.response.data : error.message);
    return null;
  }
}

// Главная функция для последовательного выполнения тестов
async function runTest() {
  console.log('=== Тестирование интеграции Zepp OS ===');
  console.log(`Сессия: ${SESSION_ID}`);
  console.log(`Устройство: ${DEVICE_ID}`);
  console.log(`Фрагменты: ${TOTAL_FRAGMENTS}`);
  console.log('======================================\n');
  
  // Отправляем фрагменты последовательно
  for (let i = 0; i < TOTAL_FRAGMENTS; i++) {
    const success = await sendFragment(i);
    if (!success) {
      console.error(`\n[Error] Не удалось отправить фрагмент #${i}, прерываем тест`);
      return;
    }
    
    // Небольшая задержка между отправками
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Финализируем запись
  const recordingId = await finalizeRecording();
  
  if (recordingId) {
    console.log(`\n[Completed] Тестирование успешно завершено`);
    console.log(`Сессия: ${SESSION_ID}`);
    console.log(`Запись ID: ${recordingId}`);
  } else {
    console.log(`\n[Completed with Warning] Тестирование завершено с предупреждениями`);
  }
}

// Запускаем тест
runTest().catch(error => {
  console.error('Критическая ошибка при выполнении теста:', error);
});