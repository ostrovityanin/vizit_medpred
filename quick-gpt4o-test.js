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

// Тестовые аудиофайлы
const sampleFiles = [
  path.join(__dirname, 'test_audio', 'test_short.wav'),
  path.join(__dirname, 'test_audio', 'test_short.mp3'),
  path.join(__dirname, 'server', 'uploads', 'dbbdcdc0-3e44-49d8-96c4-07afe0f3943d.wav')
];

// Находим первый существующий аудиофайл из списка
const findExistingFile = () => {
  for (const file of sampleFiles) {
    if (fs.existsSync(file)) {
      return file;
    }
  }
  return null;
};

/**
 * Запуск транскрипции и тестирование исправления с input_audio
 */
async function transcribeAudio() {
  try {
    // Находим существующий файл для тестирования
    const audioFile = findExistingFile();
    
    if (!audioFile) {
      console.error('Не найден ни один тестовый аудиофайл!');
      return;
    }
    
    console.log(`\n=== Тест GPT-4o Audio Preview ===`);
    console.log(`Файл: ${audioFile}`);
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('Ошибка: API ключ OpenAI не найден в переменных окружения!');
      console.log('Создайте файл .env с OPENAI_API_KEY=your_key или установите переменную окружения');
      return;
    }
    
    // Читаем и кодируем аудиофайл в base64
    const audioBuffer = fs.readFileSync(audioFile);
    const audioBase64 = audioBuffer.toString('base64');
    
    // Определяем тип аудиофайла по расширению
    const fileExt = path.extname(audioFile).toLowerCase();
    let fileType;
    
    switch (fileExt) {
      case '.mp3':
        fileType = 'audio/mp3';
        break;
      case '.wav':
        fileType = 'audio/wav';
        break;
      case '.ogg':
        fileType = 'audio/ogg';
        break;
      case '.m4a':
        fileType = 'audio/mp4';
        break;
      case '.webm':
        fileType = 'audio/webm';
        break;
      default:
        fileType = 'audio/mpeg';
    }
    
    console.log(`Формат аудио: ${fileType}`);
    console.log(`Размер файла: ${(audioBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`\nОтправка запроса к GPT-4o Audio Preview API...`);
    
    // Новый формат API для GPT-4o Audio Preview
    const requestBody = {
      model: "whisper-1",
      file: audioBuffer,
      language: "ru",
      response_format: "json"
    };
    
    // Создаем FormData для multipart/form-data запроса
    const formData = new FormData();
    formData.append('model', 'whisper-1');
    formData.append('file', Buffer.from(audioBuffer), {
      filename: 'audio.wav',
      contentType: fileType
    });
    formData.append('language', 'ru');
    formData.append('response_format', 'json');
    
    const startTime = Date.now();
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      const result = await response.json();
      const transcription = result.text;
      
      console.log(`\n✅ Транскрипция успешно получена за ${(responseTime / 1000).toFixed(2)} сек\n`);
      console.log(`=== Результат транскрипции ===`);
      console.log(transcription);
      
      // У Whisper API нет данных об использовании токенов
      console.log(`\n=== Информация о запросе ===`);
      console.log(`- Модель: ${result.model || 'whisper-1'}`);
      console.log(`- Время обработки: ${(responseTime / 1000).toFixed(2)} сек`);
      console.log(`- Язык: ${result.language || 'автоопределение'}`);
    } else {
      const errorData = await response.text();
      console.error(`\n❌ Ошибка API (${response.status}):`);
      console.error(errorData);
    }
  } catch (error) {
    console.error('Ошибка при выполнении теста:', error);
  }
}

// Запускаем тест
transcribeAudio();