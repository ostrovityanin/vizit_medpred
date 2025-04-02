/**
 * Тест транскрипции аудио через GPT-4o API
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к тестовому аудиофайлу
const audioPath = path.join(__dirname, 'server', 'uploads', 'dbbdcdc0-3e44-49d8-96c4-07afe0f3943d.wav');

async function transcribeWithGPT4o() {
  try {
    console.log(`Тестирование GPT-4o с файлом: ${audioPath}`);
    
    if (!fs.existsSync(audioPath)) {
      console.error(`Файл не найден: ${audioPath}`);
      return;
    }
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('Ошибка: API ключ OpenAI не найден в переменных окружения!');
      return;
    }
    
    // Читаем и кодируем аудиофайл в Base64
    const audioBase64 = fs.readFileSync(audioPath).toString('base64');
    console.log(`Размер закодированного аудио: ${Math.round(audioBase64.length / 1024)} KB`);
    
    // Отправляем запрос к GPT-4o API
    console.log('\nОтправка запроса к GPT-4o API...');
    const startTime = Date.now();
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Транскрибируй это аудио." },
              {
                type: "audio_url",
                audio_url: {
                  url: `data:audio/wav;base64,${audioBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000
      })
    });
    
    const responseTime = (Date.now() - startTime) / 1000;
    
    if (response.ok) {
      const result = await response.json();
      console.log(`\n✅ Ответ получен за ${responseTime.toFixed(2)} секунд\n`);
      console.log('Результат транскрипции:');
      console.log('-------------------------------------------');
      console.log(result.choices[0].message.content);
      console.log('-------------------------------------------');
      console.log(`\nИспользовано токенов: ${result.usage.total_tokens}`);
    } else {
      const error = await response.text();
      console.error(`\n❌ Ошибка API (${response.status}):`);
      console.error(error);
    }
  } catch (error) {
    console.error('Ошибка при выполнении теста:', error);
  }
}

// Запускаем тест
transcribeWithGPT4o();