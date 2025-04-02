/**
 * Тестирование интеграции с GPT-4o Audio Preview в NodeJS
 * 
 * Этот скрипт демонстрирует прямое использование GPT-4o Audio Preview
 * через fetch API для транскрипции аудиофайлов.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Функция для кодирования аудиофайла в Base64
function encodeAudioToBase64(audioFilePath) {
  try {
    const audioData = fs.readFileSync(audioFilePath);
    return audioData.toString('base64');
  } catch (error) {
    console.error(`Ошибка при кодировании аудио: ${error.message}`);
    return null;
  }
}

// Функция для транскрипции аудио с помощью GPT-4o Audio Preview
async function transcribeWithGPT4o(audioFilePath) {
  // Проверяем наличие API ключа
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Ошибка: OPENAI_API_KEY не установлен. Установите переменную окружения OPENAI_API_KEY');
    return null;
  }

  // Проверяем существование файла
  if (!fs.existsSync(audioFilePath)) {
    console.error(`Ошибка: файл ${audioFilePath} не найден`);
    return null;
  }

  // Кодируем аудиофайл в Base64
  const audioB64 = encodeAudioToBase64(audioFilePath);
  if (!audioB64) {
    return null;
  }

  // Определяем формат аудио из расширения файла
  const audioFormat = path.extname(audioFilePath).slice(1).toLowerCase() || 'mp3';

  console.log(`Формат аудио: ${audioFormat}`);
  console.log(`Размер аудиофайла: ${fs.statSync(audioFilePath).size / 1024 / 1024} МБ`);
  console.log(`Отправляем аудиофайл ${audioFilePath} на распознавание через GPT-4o Audio Preview...`);

  try {
    // Создаем запрос
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `
            Ты русскоязычный эксперт по транскрипции речи.
            
            Выполни транскрипцию аудиозаписи и выдели разных говорящих.
            
            Правила:
            1. Расшифруй аудио максимально точно и полностью
            2. Формат ответа: "Говорящий 1: [текст]", "Говорящий 2: [текст]" или "Женщина: [текст]", "Мужчина: [текст]"
            3. Если невозможно определить разных говорящих или это монолог, используй формат "Говорящий: [текст]"
            4. Никогда не пиши комментарии к транскрипции. Не пиши вступительных или заключительных фраз.
            5. Выдай только распознанный текст, никаких пояснений или метаданных
            6. Сохраняй оригинальный стиль речи, сленг, повторы и особенности произношения
            7. Ты не должен объяснять невозможность разделить говорящих и не должен писать о проблемах с качеством аудио
            `
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Распознай эту аудиозапись с выделением говорящих. Выдай только транскрипцию, без комментариев и метаданных."
              },
              {
                type: "input_audio",
                input_audio: {
                  data: audioB64,
                  format: audioFormat
                }
              }
            ]
          }
        ],
        temperature: 0.1
      })
    });

    // Проверяем статус ответа
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ошибка API: ${response.status} ${response.statusText}`);
      console.error(`Детали: ${errorText}`);
      return null;
    }

    // Парсим JSON ответ
    const result = await response.json();
    
    // Получаем результат транскрипции
    const transcription = result?.choices?.[0]?.message?.content;
    
    if (transcription) {
      console.log('\nРезультат транскрипции:');
      console.log('-'.repeat(50));
      console.log(transcription);
      console.log('-'.repeat(50));
      
      // Сохраняем результат в файл
      const outputFile = `${path.basename(audioFilePath, path.extname(audioFilePath))}_transcription.txt`;
      fs.writeFileSync(outputFile, transcription, 'utf-8');
      console.log(`Транскрипция сохранена в файл: ${outputFile}`);
      
      return transcription;
    } else {
      console.error('Ошибка: не удалось получить транскрипцию из ответа API');
      console.error('Ответ API:', JSON.stringify(result, null, 2));
      return null;
    }
  } catch (error) {
    console.error(`Ошибка при отправке запроса: ${error.message}`);
    return null;
  }
}

// Основная функция
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Использование: node test_gpt4o_audio.js <путь_к_аудиофайлу>');
    process.exit(1);
  }

  const audioFilePath = args[0];
  try {
    await transcribeWithGPT4o(audioFilePath);
  } catch (error) {
    console.error(`Ошибка в main: ${error.message}`);
  }
}

// Запускаем скрипт
main();