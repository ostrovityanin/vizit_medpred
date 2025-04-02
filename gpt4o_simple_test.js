/**
 * Простой тест GPT-4o аудио транскрипции
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к тестовому аудиофайлу
const sampleAudioPath = path.join(__dirname, 'server', 'uploads', 'dbbdcdc0-3e44-49d8-96c4-07afe0f3943d.wav');

async function transcribeAudio() {
  try {
    console.log(`Тестирование транскрипции файла: ${sampleAudioPath}`);
    
    if (!fs.existsSync(sampleAudioPath)) {
      console.error(`Файл не найден: ${sampleAudioPath}`);
      return;
    }
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(sampleAudioPath));
    formData.append('model', 'whisper-1');
    
    console.log('Отправка запроса на транскрипцию...');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('\nРезультат транскрипции:');
      console.log('-------------------------------------------');
      console.log(result.text);
      console.log('-------------------------------------------');
      console.log('✅ Тест успешно завершен!');
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