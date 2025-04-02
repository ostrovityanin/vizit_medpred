/**
 * Оптимизированный скрипт для работы с GPT-4o Audio Preview
 * 
 * Этот скрипт демонстрирует корректную работу с GPT-4o Audio Preview
 * путем конвертирования аудиофайла в формат MP3, поддерживаемый API.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { FormData } from 'formdata-node';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const ffmpegPath = ffmpegInstaller.path;

// Загрузка переменных окружения
dotenv.config();

// Настройка ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

// Путь к тестовому аудиофайлу
const testAudioFile = './server/uploads/01b48ffc-9e05-4bb6-9d02-9efb4cdde96a.wav';
// Директория для временных файлов
const tempDir = './test_audio/temp';

/**
 * Конвертирует аудиофайл в MP3 формат
 * @param {string} inputPath Путь к исходному файлу
 * @returns {Promise<string>} Путь к конвертированному файлу
 */
function convertToMp3(inputPath) {
  return new Promise((resolve, reject) => {
    // Создаем директорию для временных файлов, если она не существует
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const outputFile = path.join(tempDir, path.basename(inputPath, path.extname(inputPath)) + '.mp3');
    
    console.log(`Конвертация ${inputPath} в MP3 формат...`);
    
    ffmpeg(inputPath)
      .noVideo()
      .audioChannels(1)            // Моно
      .audioFrequency(16000)       // 16kHz
      .audioBitrate('32k')         // 32kbps
      .format('mp3')
      .on('end', () => {
        console.log(`Файл успешно конвертирован: ${outputFile}`);
        resolve(outputFile);
      })
      .on('error', (err) => {
        console.error(`Ошибка при конвертации файла: ${err.message}`);
        reject(err);
      })
      .save(outputFile);
  });
}

/**
 * Кодирование аудиофайла в Base64
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {string|null} Закодированные данные или null в случае ошибки
 */
function encodeAudioToBase64(audioFilePath) {
  try {
    console.log(`Кодирование файла ${audioFilePath} в Base64`);
    const audioBuffer = fs.readFileSync(audioFilePath);
    return audioBuffer.toString('base64');
  } catch (error) {
    console.error(`Ошибка при чтении файла ${audioFilePath}: ${error.message}`);
    return null;
  }
}

/**
 * Определение формата аудиофайла по расширению
 * @param {string} filePath Путь к файлу
 * @returns {string} Формат аудио ('mp3', 'wav', etc.)
 */
function getAudioFormat(filePath) {
  const fileExt = path.extname(filePath).substring(1).toLowerCase();
  return fileExt;
}

/**
 * Транскрипция аудио с использованием GPT-4o через chat/completions API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {Promise<string>} Результат транскрипции
 */
async function transcribeWithGPT4o(audioFilePath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('API ключ OpenAI не установлен в переменной окружения OPENAI_API_KEY');
    return 'Ошибка: API ключ не найден';
  }

  try {
    console.log(`Транскрипция через GPT-4o (chat/completions): ${audioFilePath}`);
    
    // Определяем формат файла
    const format = getAudioFormat(audioFilePath);
    
    // Кодируем аудиофайл в base64
    const audio_b64 = encodeAudioToBase64(audioFilePath);
    if (!audio_b64) {
      return 'Ошибка: не удалось закодировать аудиофайл';
    }

    // Создаем структуру сообщения для отправки
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: "Пожалуйста, точно транскрибируй содержание данного аудиофайла. Это аудиозапись с человеческой речью, которую нужно преобразовать в текст. Выдай только текст содержания без дополнительных комментариев." },
          { type: "input_audio", input_audio: { data: audio_b64, format } }
        ]
      }
    ];

    console.log(`Отправка запроса на транскрипцию с форматом: ${format}`);
    console.time('gpt4o-transcription');
    
    // Отправляем запрос к OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-audio-preview',
        messages,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Ошибка API: ${JSON.stringify(errorData)}`);
      return `Ошибка API: ${JSON.stringify(errorData)}`;
    }

    const data = await response.json();
    console.timeEnd('gpt4o-transcription');
    
    console.log('Информация об использовании токенов:', data.usage);
    
    return data.choices[0]?.message?.content || 'Не удалось получить текст транскрипции';
  } catch (error) {
    console.error(`Ошибка при вызове API: ${error.message}`);
    return `Ошибка при вызове API: ${error.message}`;
  }
}

/**
 * Основная функция для запуска тестов
 */
async function runTests() {
  console.log('=== Тестирование транскрипции аудио с GPT-4o Audio Preview ===');
  
  // Проверяем наличие API ключа
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('API ключ OpenAI не установлен в переменной окружения OPENAI_API_KEY');
    return;
  }
  
  // Проверяем наличие тестового файла
  if (!fs.existsSync(testAudioFile)) {
    console.error(`Тестовый файл не найден: ${testAudioFile}`);
    return;
  }
  
  try {
    // Конвертируем файл в MP3 формат
    const mp3File = await convertToMp3(testAudioFile);
    
    console.log('Тестирование транскрипции через GPT-4o Audio Preview (chat/completions API)');
    const gpt4oResult = await transcribeWithGPT4o(mp3File);
    
    console.log('\n=== Результат транскрипции GPT-4o Audio Preview ===');
    console.log(gpt4oResult);
    console.log('===============================================\n');
    
    console.log('Тестирование завершено!');
    
    // Очистка временных файлов
    if (fs.existsSync(mp3File)) {
      fs.unlinkSync(mp3File);
      console.log(`Удален временный файл: ${mp3File}`);
    }
  } catch (error) {
    console.error(`Ошибка при выполнении тестов: ${error.message}`);
  }
}

// Запуск тестов
runTests();