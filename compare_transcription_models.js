/**
 * Сравнение моделей транскрипции для разных языков и аудиоформатов
 * 
 * Этот скрипт тестирует транскрипцию аудио с использованием различных
 * моделей OpenAI (whisper-1, gpt-4o, gpt-4o-mini) и производит
 * детальное сравнение результатов.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

// Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем переменные окружения
dotenv.config();

// API ключ OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Параметры тестирования
const TEST_LANGUAGES = ['ru', 'en']; // Тестируемые языки
const TEST_FILE_DURATION = 5; // Длительность тестового файла в секундах

/**
 * Генерирует тестовый аудиофайл определенной длительности
 * @param {string} outputPath Путь для сохранения файла
 * @param {string} format Формат выходного файла (mp3, wav, m4a)
 * @param {number} duration Длительность в секундах
 * @returns {Promise<string>} Путь к созданному файлу
 */
function generateTestAudio(outputPath, format = 'mp3', duration = 5) {
  return new Promise((resolve, reject) => {
    // Убедимся, что директория существует
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    console.log(`Генерация тестового аудио: ${outputPath} (${duration} сек, формат: ${format})`);
    
    // Частота тона для аудио
    const frequency = 440; // 440 Гц (нота A4)
    
    // Команда FFmpeg для генерации аудио
    // Используем тональный сигнал sine для простоты
    const ffmpeg = spawn('ffmpeg', [
      '-y', // Перезаписать файл, если существует
      '-f', 'lavfi', // Использовать виртуальное устройство lavfi
      '-i', `sine=frequency=${frequency}:duration=${duration}`, // Генерировать синусоиду
      '-ar', '44100', // Частота дискретизации 44.1 кГц
      '-ac', '1', // Моно аудио
      outputPath // Выходной файл
    ]);
    
    // Обработка ошибок
    ffmpeg.stderr.on('data', (data) => {
      // FFmpeg пишет информацию в stderr
      // console.error(`FFmpeg: ${data}`);
    });
    
    // Обработка завершения
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`Аудиофайл создан: ${outputPath}`);
        resolve(outputPath);
      } else {
        const error = `FFmpeg завершился с кодом ошибки: ${code}`;
        console.error(error);
        reject(new Error(error));
      }
    });
  });
}

/**
 * Кодирует аудиофайл в формате Base64
 * @param {string} audioFilePath Путь к аудиофайлу
 * @returns {string|null} Закодированные данные или null при ошибке
 */
function encodeAudioToBase64(audioFilePath) {
  try {
    const audioData = fs.readFileSync(audioFilePath);
    return audioData.toString('base64');
  } catch (error) {
    console.error(`Ошибка при кодировании аудиофайла: ${error.message}`);
    return null;
  }
}

/**
 * Выполняет транскрипцию аудио с использованием OpenAI Audio API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {string} model Модель для транскрипции (whisper-1)
 * @param {string} language Код языка (ru, en, etc.)
 * @returns {Promise<object>} Результат транскрипции
 */
async function transcribeWithAudioAPI(audioFilePath, model = 'whisper-1', language = null) {
  try {
    console.log(`📝 Начинаем транскрипцию с моделью ${model} (язык: ${language || 'авто'})...`);
    const startTime = Date.now();
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model', model);
    
    // Добавляем язык только если он указан
    if (language) {
      formData.append('language', language);
    }
    
    formData.append('response_format', 'json');
    
    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          ...formData.getHeaders()
        }
      }
    );
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Транскрипция завершена за ${duration} сек`);
    
    return {
      model,
      language: language || 'auto',
      duration: parseFloat(duration),
      transcript: response.data.text,
      audioPath: audioFilePath
    };
  } catch (error) {
    console.error(`❌ Ошибка при транскрипции (${model}): ${error.message}`);
    
    if (error.response) {
      console.error(`Статус: ${error.response.status}`);
      console.error(`Данные: ${JSON.stringify(error.response.data)}`);
    }
    
    return {
      model,
      language: language || 'auto',
      duration: 0,
      transcript: `Ошибка: ${error.message}`,
      error: true,
      audioPath: audioFilePath
    };
  }
}

/**
 * Выполняет транскрипцию аудио с использованием GPT-4o Chat API
 * @param {string} audioFilePath Путь к аудиофайлу
 * @param {string} modelName Название модели (gpt-4o, gpt-4o-mini)
 * @param {string} language Код языка (ru, en, etc.)
 * @returns {Promise<object>} Результат транскрипции
 */
async function transcribeWithGPT4oChat(audioFilePath, modelName = 'gpt-4o', language = null) {
  try {
    console.log(`📝 Начинаем транскрипцию с моделью ${modelName} через Chat API (язык: ${language || 'авто'})...`);
    const startTime = Date.now();
    
    // Кодируем аудиофайл в Base64
    const audioBase64 = encodeAudioToBase64(audioFilePath);
    if (!audioBase64) {
      throw new Error('Не удалось закодировать аудиофайл');
    }
    
    // Получаем расширение файла для определения MIME-типа
    const fileExtension = path.extname(audioFilePath).toLowerCase();
    let mimeType;
    
    switch (fileExtension) {
      case '.mp3':
        mimeType = 'audio/mp3';
        break;
      case '.mp4':
      case '.m4a':
        mimeType = 'audio/mp4';
        break;
      case '.mpeg':
        mimeType = 'audio/mpeg';
        break;
      case '.mpga':
        mimeType = 'audio/mpeg';
        break;
      case '.wav':
        mimeType = 'audio/wav';
        break;
      case '.webm':
        mimeType = 'audio/webm';
        break;
      default:
        mimeType = 'audio/mp3'; // Значение по умолчанию
    }
    
    // Формируем запрос с учетом языка
    let promptText = "Пожалуйста, расшифруйте аудио и предоставьте полную транскрипцию. Только текст из аудио, без комментариев.";
    
    if (language === 'ru') {
      promptText = "Пожалуйста, расшифруйте аудио и предоставьте полную транскрипцию на русском языке. Только текст из аудио, без комментариев.";
    } else if (language === 'en') {
      promptText = "Please transcribe this audio and provide a complete transcription in English. Only the text from the audio, without comments.";
    }
    
    const payload = {
      model: modelName,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: promptText
            },
            {
              type: "input_audio",
              input_audio: `data:${mimeType};base64,${audioBase64}`
            }
          ]
        }
      ]
    };
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Транскрипция через Chat API завершена за ${duration} сек`);
    
    return {
      model: modelName,
      language: language || 'auto',
      duration: parseFloat(duration),
      transcript: response.data.choices[0].message.content,
      audioPath: audioFilePath
    };
  } catch (error) {
    console.error(`❌ Ошибка при транскрипции через Chat API (${modelName}): ${error.message}`);
    
    if (error.response) {
      console.error(`Статус: ${error.response.status}`);
      console.error(`Данные: ${JSON.stringify(error.response.data)}`);
    }
    
    return {
      model: modelName,
      language: language || 'auto',
      duration: 0,
      transcript: `Ошибка: ${error.message}`,
      error: true,
      audioPath: audioFilePath
    };
  }
}

/**
 * Функция для запуска сравнительного тестирования моделей транскрипции
 */
async function runComparisonTests() {
  if (!OPENAI_API_KEY) {
    console.error('❌ Отсутствует OPENAI_API_KEY в переменных окружения');
    console.log('Для работы скрипта необходимо установить переменную окружения OPENAI_API_KEY.');
    return;
  }
  
  console.log('📊 Запуск сравнительного тестирования моделей транскрипции\n');
  
  // Создаем директорию для тестовых аудиофайлов
  const testAudioDir = path.join(__dirname, 'test_audio');
  if (!fs.existsSync(testAudioDir)) {
    fs.mkdirSync(testAudioDir, { recursive: true });
  }
  
  // Форматы для тестирования
  const formats = ['mp3', 'wav', 'm4a'];
  const testFiles = [];
  
  // Генерируем тестовые файлы для каждого формата
  try {
    for (const format of formats) {
      const filePath = path.join(testAudioDir, `test_tone.${format}`);
      await generateTestAudio(filePath, format, TEST_FILE_DURATION);
      testFiles.push(filePath);
    }
  } catch (error) {
    console.error(`❌ Ошибка при генерации тестовых файлов: ${error.message}`);
    return;
  }
  
  // Модели для тестирования
  const models = [
    { method: transcribeWithAudioAPI, args: [null, 'whisper-1', null], name: 'Whisper API' },
    { method: transcribeWithGPT4oChat, args: [null, 'gpt-4o', null], name: 'GPT-4o' },
    { method: transcribeWithGPT4oChat, args: [null, 'gpt-4o-mini', null], name: 'GPT-4o-mini' }
  ];
  
  const allResults = [];
  
  // Запускаем тесты для каждого формата и языка
  for (const audioFile of testFiles) {
    for (const language of TEST_LANGUAGES) {
      for (const model of models) {
        // Клонируем аргументы и заменяем null значения
        const args = [...model.args];
        args[0] = audioFile; // Путь к аудиофайлу
        args[2] = language; // Язык
        
        console.log(`\n🔄 Тестирование ${model.name} для языка ${language}, файл: ${path.basename(audioFile)}...`);
        
        try {
          const result = await model.method(...args);
          allResults.push(result);
          
          // Выводим краткий результат
          console.log(`   📄 Результат: ${result.transcript.substring(0, 50)}${result.transcript.length > 50 ? '...' : ''}`);
          console.log(`   ⏱️ Время обработки: ${result.duration} сек`);
        } catch (error) {
          console.error(`❌ Ошибка при выполнении теста: ${error.message}`);
        }
      }
    }
  }
  
  // Сохраняем результаты в файл
  const resultsPath = path.join(__dirname, 'transcription-models-comparison.json');
  fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2));
  
  console.log(`\n💾 Полные результаты сохранены в файл: ${resultsPath}`);
  
  // Формируем итоговый отчет
  console.log('\n📋 Сводный отчет по результатам тестирования:');
  
  // Группируем результаты по моделям и языкам
  const modelStats = {};
  
  for (const result of allResults) {
    const modelKey = `${result.model}-${result.language}`;
    
    if (!modelStats[modelKey]) {
      modelStats[modelKey] = {
        model: result.model,
        language: result.language,
        count: 0,
        totalDuration: 0,
        errors: 0,
        avgDuration: 0
      };
    }
    
    modelStats[modelKey].count++;
    
    if (result.error) {
      modelStats[modelKey].errors++;
    } else {
      modelStats[modelKey].totalDuration += result.duration;
    }
  }
  
  // Вычисляем средние значения и сортируем результаты
  Object.values(modelStats).forEach(stat => {
    const successfulTests = stat.count - stat.errors;
    stat.avgDuration = successfulTests > 0 ? (stat.totalDuration / successfulTests) : 0;
  });
  
  // Сортируем по модели и языку
  const sortedStats = Object.values(modelStats).sort((a, b) => {
    if (a.model !== b.model) return a.model.localeCompare(b.model);
    return a.language.localeCompare(b.language);
  });
  
  // Выводим таблицу статистики
  console.log('┌─────────────────┬─────────┬───────┬─────────┬────────────────┐');
  console.log('│ Модель          │ Язык    │ Тесты │ Ошибки  │ Среднее время  │');
  console.log('├─────────────────┼─────────┼───────┼─────────┼────────────────┤');
  
  for (const stat of sortedStats) {
    console.log(
      `│ ${stat.model.padEnd(15)} │ ${stat.language.padEnd(7)} │ ${stat.count.toString().padEnd(5)} │ ${stat.errors.toString().padEnd(7)} │ ${stat.avgDuration.toFixed(2).padEnd(14)} │`
    );
  }
  
  console.log('└─────────────────┴─────────┴───────┴─────────┴────────────────┘');
  
  // Сохраняем статистику в отдельный файл
  const statsPath = path.join(__dirname, 'transcription-models-stats.json');
  fs.writeFileSync(statsPath, JSON.stringify(sortedStats, null, 2));
  
  console.log(`\n📊 Статистика по моделям сохранена в файл: ${statsPath}`);
  
  // Формируем текстовый отчет в markdown формате
  const reportPath = path.join(__dirname, 'transcription_models_report.md');
  
  let reportContent = `# Отчет по сравнению моделей транскрипции\n\n`;
  reportContent += `*Дата: ${new Date().toISOString().split('T')[0]}*\n\n`;
  reportContent += `## Общая информация\n\n`;
  reportContent += `- **Количество тестов:** ${allResults.length}\n`;
  reportContent += `- **Тестируемые модели:** ${[...new Set(allResults.map(r => r.model))].join(', ')}\n`;
  reportContent += `- **Языки:** ${TEST_LANGUAGES.join(', ')}\n`;
  reportContent += `- **Форматы аудио:** ${formats.join(', ')}\n\n`;
  
  reportContent += `## Результаты по моделям и языкам\n\n`;
  reportContent += `| Модель | Язык | Кол-во тестов | Ошибки | Среднее время (с) |\n`;
  reportContent += `|--------|------|---------------|--------|-------------------|\n`;
  
  for (const stat of sortedStats) {
    reportContent += `| ${stat.model} | ${stat.language} | ${stat.count} | ${stat.errors} | ${stat.avgDuration.toFixed(2)} |\n`;
  }
  
  reportContent += `\n## Примеры транскрипции\n\n`;
  
  // Добавляем примеры результатов транскрипции
  const exampleResults = allResults.filter(r => !r.error).slice(0, 6);
  
  for (const example of exampleResults) {
    reportContent += `### ${example.model} (${example.language})\n\n`;
    reportContent += `- **Файл:** \`${path.basename(example.audioPath)}\`\n`;
    reportContent += `- **Время обработки:** ${example.duration} сек\n`;
    reportContent += `- **Транскрипция:** "${example.transcript}"\n\n`;
  }
  
  reportContent += `## Заключение\n\n`;
  reportContent += `Данный отчет представляет результаты автоматического тестирования различных моделей транскрипции от OpenAI. `;
  reportContent += `Тесты проводились на синтетических аудиофайлах длительностью ${TEST_FILE_DURATION} секунд в различных форматах.`;
  
  fs.writeFileSync(reportPath, reportContent);
  
  console.log(`📝 Подробный отчет сохранен в файл: ${reportPath}`);
}

// Запускаем тестирование
runComparisonTests();