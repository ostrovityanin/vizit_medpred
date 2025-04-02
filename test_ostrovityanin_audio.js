/**
 * Тест транскрипции аудио для файлов пользователя ostrovityanin
 * с прямым использованием GPT-4o Audio Preview API
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

// ES модули не имеют доступа к __dirname, создаем аналог
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Кодирует аудиофайл в Base64
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {string|null} Закодированные данные или null в случае ошибки
 */
function encodeAudioToBase64(audioFilePath) {
  try {
    // Читаем файл как бинарные данные
    const audioBuffer = fs.readFileSync(audioFilePath);
    // Кодируем в Base64
    return audioBuffer.toString('base64');
  } catch (error) {
    console.error(`Ошибка при кодировании аудио в Base64: ${error.message}`);
    return null;
  }
}

/**
 * Получает метаданные WAV файла (формат, частота и каналы)
 * @param {Buffer} buffer Буфер с данными WAV файла
 * @returns {Object|null} Объект с метаданными или null в случае ошибки
 */
function getWavMetadata(buffer) {
  try {
    // Проверяем RIFF заголовок
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || 
        buffer.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error('Не валидный WAV формат');
    }

    // Ищем fmt чанк
    let offset = 12;
    let fmtFound = false;
    
    while (offset < buffer.length) {
      const chunkType = buffer.toString('ascii', offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      
      if (chunkType === 'fmt ') {
        fmtFound = true;
        
        const format = buffer.readUInt16LE(offset + 8); // 1 для PCM
        const channels = buffer.readUInt16LE(offset + 10);
        const sampleRate = buffer.readUInt32LE(offset + 12);
        const bitsPerSample = buffer.readUInt16LE(offset + 22);
        
        return {
          format,
          channels,
          sampleRate,
          bitsPerSample,
          formatName: format === 1 ? 'PCM' : 'Unknown'
        };
      }
      
      offset += 8 + chunkSize;
    }
    
    if (!fmtFound) {
      throw new Error('fmt чанк не найден в WAV файле');
    }
    
    return null;
  } catch (error) {
    console.error(`Ошибка при чтении метаданных WAV: ${error.message}`);
    return null;
  }
}

/**
 * Транскрипция аудио с использованием GPT-4o через chat/completions API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {Promise<Object>} Результат транскрипции с дополнительной информацией
 */
async function transcribeWithGPT4o(audioFilePath) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY не найден в переменных окружения');
    }

    console.log(`Транскрибирование файла: ${audioFilePath}`);
    
    // Получаем буфер файла для метаданных
    const fileBuffer = fs.readFileSync(audioFilePath);
    const metadata = getWavMetadata(fileBuffer);
    
    if (metadata) {
      console.log(`Метаданные WAV: Формат: ${metadata.formatName}, Каналы: ${metadata.channels}, Частота: ${metadata.sampleRate}Hz, Битность: ${metadata.bitsPerSample}bit`);
    }
    
    // Кодируем аудиофайл в Base64
    const base64Audio = encodeAudioToBase64(audioFilePath);
    if (!base64Audio) {
      throw new Error('Ошибка при кодировании аудио в Base64');
    }

    console.log(`Аудио успешно закодировано в Base64`);
    console.log(`Размер закодированных данных: ${Math.round(base64Audio.length / 1024)} КБ`);

    // Создаем объект для запроса
    const requestBody = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: 'Транскрибируй этот аудиофайл. Если в файле диалог, распредели реплики по спикерам в формате "Человек 1: ...", "Человек 2: ..." и т.д.'
        }
      ],
      input_audio: {
        format: 'wav',
        data: base64Audio
      },
      max_tokens: 4096
    };

    console.log('Отправка запроса к OpenAI API...');
    const startTime = Date.now();

    // Выполняем запрос к API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    // Проверяем успешность запроса
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка API OpenAI: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();
    const endTime = Date.now();
    const elapsedTime = (endTime - startTime) / 1000; // в секундах

    console.log(`Запрос выполнен за ${elapsedTime.toFixed(2)} секунд`);
    
    // Получаем результат из ответа
    const transcription = data.choices[0].message.content;
    const usage = data.usage;

    return {
      transcription,
      elapsedTime,
      tokensProcessed: usage.total_tokens,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens
    };
  } catch (error) {
    console.error(`Ошибка при транскрибировании аудио: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    return { transcription: null, error: error.message };
  }
}

/**
 * Основная функция для запуска тестов
 */
async function runTests() {
  console.log('=== Тестирование транскрипции аудио пользователя ostrovityanin с GPT-4o Audio Preview ===');
  
  try {
    // Файлы для тестирования (из записей пользователя ostrovityanin)
    const testFiles = [
      './server/uploads/12e774e4-0792-48e3-bc9d-d9637a1e2fc8.wav', // ID: 1
      './server/uploads/341037cc-fa57-4606-9810-e77c1720ffa0.wav'  // ID: 9
    ];
    
    for (const file of testFiles) {
      console.log(`\n--- Тестирование файла: ${path.basename(file)} ---`);
      
      // Проверяем существование файла
      if (!fs.existsSync(file)) {
        console.error(`Файл не найден: ${file}`);
        continue;
      }
      
      // Получаем информацию о файле
      const stats = fs.statSync(file);
      console.log(`Размер файла: ${Math.round(stats.size / 1024)} КБ`);
      
      // Транскрибируем аудио напрямую через GPT-4o
      const result = await transcribeWithGPT4o(file);
      
      if (result.transcription) {
        console.log('\nРезультат транскрипции:');
        console.log('-'.repeat(50));
        console.log(result.transcription);
        console.log('-'.repeat(50));
        console.log(`Время выполнения: ${result.elapsedTime.toFixed(2)} секунд`);
        console.log(`Обработано токенов: ${result.tokensProcessed}`);
        console.log(`Токены запроса: ${result.promptTokens}`);
        console.log(`Токены ответа: ${result.completionTokens}`);
      } else {
        console.error(`Транскрипция не удалась: ${result.error}`);
      }
    }
    
  } catch (error) {
    console.error(`Ошибка при выполнении тестов: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Запускаем тесты
runTests();