/**
 * Модуль для работы с OpenAI API
 * 
 * Этот модуль предоставляет функции для транскрипции аудио с использованием разных моделей OpenAI:
 * - whisper-1 (через Audio API)
 * - gpt-4o (через Chat API с поддержкой аудио)
 * - gpt-4o-mini (через Chat API с поддержкой аудио)
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const { v4: uuidv4 } = require('uuid');

// Пути для временных файлов
const TEMP_DIR = path.join(process.cwd(), 'temp');

// Создаем временную директорию, если она не существует
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Конвертирует аудиофайл в MP3 формат
 * @param {string} inputPath Путь к исходному файлу
 * @returns {Promise<string>} Путь к конвертированному файлу
 */
async function convertToMp3(inputPath) {
  const outputPath = path.join(TEMP_DIR, `converted-${uuidv4()}.mp3`);
  
  try {
    console.log(`[openai] Конвертация файла ${inputPath} в MP3 формат`);
    
    const command = `ffmpeg -i "${inputPath}" -c:a libmp3lame -q:a 4 "${outputPath}" -y`;
    await exec(command);
    
    if (fs.existsSync(outputPath)) {
      console.log(`[openai] Файл успешно конвертирован: ${outputPath}`);
      return outputPath;
    } else {
      throw new Error('Не удалось конвертировать файл');
    }
  } catch (error) {
    console.error(`[openai] Ошибка при конвертации файла: ${error.message}`);
    throw error;
  }
}

/**
 * Транскрибирует аудиофайл с использованием Whisper API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {Object} options Дополнительные опции
 * @returns {Promise<string>} Результат транскрипции
 */
async function transcribeWithWhisper(audioFilePath, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Отсутствует ключ API OpenAI');
  }
  
  let mp3Path = audioFilePath;
  let needsCleanup = false;
  
  try {
    // Проверяем формат файла и конвертируем, если необходимо
    const fileExt = path.extname(audioFilePath).toLowerCase();
    if (fileExt !== '.mp3') {
      mp3Path = await convertToMp3(audioFilePath);
      needsCleanup = true;
    }
    
    console.log(`[openai] Транскрипция файла ${mp3Path} с использованием Whisper API`);
    
    // Создаем FormData для отправки файла
    const formData = new FormData();
    formData.append('file', fs.createReadStream(mp3Path));
    formData.append('model', 'whisper-1');
    formData.append('language', options.language || 'ru');
    formData.append('response_format', options.responseFormat || 'text');
    
    // Делаем запрос к API
    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    
    // Проверяем формат ответа в зависимости от responseFormat
    if (options.responseFormat === 'json' || options.responseFormat === 'verbose_json') {
      return response.data;
    }
    
    return response.data;
  } catch (error) {
    console.error(`[openai] Ошибка при транскрипции с Whisper API: ${error.message}`);
    if (error.response) {
      console.error('Детали ошибки API:', error.response.data);
    }
    throw error;
  } finally {
    // Удаляем временные файлы
    if (needsCleanup && mp3Path !== audioFilePath) {
      try {
        if (fs.existsSync(mp3Path)) {
          fs.unlinkSync(mp3Path);
          console.log(`[openai] Удален временный файл: ${mp3Path}`);
        }
      } catch (err) {
        console.error(`[openai] Ошибка при удалении файла ${mp3Path}: ${err.message}`);
      }
    }
  }
}

/**
 * Кодирует аудиофайл в формат Base64
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {string} Закодированный аудиофайл
 */
function encodeAudioToBase64(audioFilePath) {
  try {
    const audioData = fs.readFileSync(audioFilePath);
    return audioData.toString('base64');
  } catch (error) {
    console.error(`[openai] Ошибка при кодировании аудио в Base64: ${error.message}`);
    throw error;
  }
}

/**
 * Транскрибирует аудиофайл с использованием GPT-4o Audio API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {string} model Модель для транскрипции ('gpt-4o-mini' или 'gpt-4o')
 * @param {Object} options Дополнительные опции
 * @returns {Promise<string>} Результат транскрипции
 */
async function transcribeWithGPT4o(audioFilePath, model = 'gpt-4o', options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Отсутствует ключ API OpenAI');
  }
  
  let mp3Path = audioFilePath;
  let needsCleanup = false;
  
  try {
    // Проверяем формат файла и конвертируем, если необходимо
    const fileExt = path.extname(audioFilePath).toLowerCase();
    if (fileExt !== '.mp3') {
      mp3Path = await convertToMp3(audioFilePath);
      needsCleanup = true;
    }
    
    // Определяем модель для API
    const apiModel = model === 'gpt-4o-mini' ? 'gpt-4o-mini' : 'gpt-4o';
    
    console.log(`[openai] Транскрипция файла ${mp3Path} с использованием ${apiModel}`);
    
    // Чтение аудиофайла в base64
    const base64Audio = encodeAudioToBase64(mp3Path);
    
    // Определяем язык для подсказки
    const language = options.language || 'ru';
    const languagePrompt = language === 'ru' ? 'Это русская речь.' : 
                           language === 'en' ? 'This is English speech.' : 
                           '';
    
    // Запрос к OpenAI API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: apiModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: `Пожалуйста, сделайте транскрипцию этого аудио. ${languagePrompt}` },
              {
                type: 'audio',
                audio_data: `data:audio/mp3;base64,${base64Audio}`
              }
            ]
          }
        ],
        temperature: options.temperature || 0,
        max_tokens: options.maxTokens || 4096
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    
    // Получаем текст из ответа
    const transcription = response.data.choices[0].message.content;
    
    return transcription;
  } catch (error) {
    console.error(`[openai] Ошибка при транскрипции с ${model}: ${error.message}`);
    if (error.response) {
      console.error('Детали ошибки API:', error.response.data);
    }
    throw error;
  } finally {
    // Удаляем временные файлы
    if (needsCleanup && mp3Path !== audioFilePath) {
      try {
        if (fs.existsSync(mp3Path)) {
          fs.unlinkSync(mp3Path);
          console.log(`[openai] Удален временный файл: ${mp3Path}`);
        }
      } catch (err) {
        console.error(`[openai] Ошибка при удалении файла ${mp3Path}: ${err.message}`);
      }
    }
  }
}

/**
 * Транскрибирует аудиофайл с использованием указанной модели
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {string} model Модель для транскрипции ('whisper-1', 'gpt-4o-mini-transcribe', 'gpt-4o-transcribe')
 * @param {Object} options Дополнительные опции
 * @returns {Promise<string>} Результат транскрипции
 */
async function transcribeWithModel(audioFilePath, model, options = {}) {
  switch (model) {
    case 'whisper-1':
      return transcribeWithWhisper(audioFilePath, options);
    case 'gpt-4o-mini-transcribe':
      return transcribeWithGPT4o(audioFilePath, 'gpt-4o-mini', options);
    case 'gpt-4o-transcribe':
      return transcribeWithGPT4o(audioFilePath, 'gpt-4o', options);
    default:
      throw new Error(`Неизвестная модель транскрипции: ${model}`);
  }
}

// Экспортируем функции для использования в других модулях
// с поддержкой как CommonJS, так и ES модулей
module.exports = {
  transcribeWithWhisper,
  transcribeWithGPT4o,
  transcribeWithModel
};

// Для поддержки ES модулей
export {
  transcribeWithWhisper,
  transcribeWithGPT4o,
  transcribeWithModel
};