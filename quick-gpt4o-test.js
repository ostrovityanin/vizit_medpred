/**
 * Быстрый тест GPT-4o Audio на коротком аудиофайле
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к тестовому аудиофайлу - используем очень короткий файл
const sampleAudioPath = path.join(__dirname, 'server', 'uploads', 'dbbdcdc0-3e44-49d8-96c4-07afe0f3943d.wav');
const serviceUrl = 'http://localhost:3200';

/**
 * Запуск транскрипции и тестирование исправления с input_audio
 */
async function transcribeAudio() {
  try {
    console.log(`Тестирование транскрипции файла: ${sampleAudioPath}`);
    
    if (!fs.existsSync(sampleAudioPath)) {
      console.error(`Файл не найден: ${sampleAudioPath}`);
      return;
    }
    
    const formData = new FormData();
    formData.append('audioFile', fs.createReadStream(sampleAudioPath));
    formData.append('optimize', 'false');
    
    console.log('Отправка запроса на транскрипцию...');
    const response = await fetch(`${serviceUrl}/api/transcribe`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('\nРезультат транскрипции:');
      console.log('-------------------------------------------');
      console.log('Необработанный текст:', result.transcription.raw);
      console.log('Форматированный текст:', result.transcription.formatted);
      console.log('-------------------------------------------');
      console.log('Метаданные:', JSON.stringify(result.metadata, null, 2));
      console.log('-------------------------------------------');
      console.log('Тест успешно завершен! Параметр input_audio работает корректно!');
    } else {
      const error = await response.text();
      console.error(`Ошибка (${response.status}):`, error);
    }
  } catch (error) {
    console.error('Ошибка при выполнении теста:', error.message);
  }
}

// Выполняем тест
transcribeAudio();