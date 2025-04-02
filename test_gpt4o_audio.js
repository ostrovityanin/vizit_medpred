/**
 * Тестирование интеграции с GPT-4o Audio Preview в NodeJS
 * 
 * Этот скрипт демонстрирует прямое использование GPT-4o Audio Preview
 * через fetch API для транскрипции аудиофайлов.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Проверяем наличие OpenAI API ключа
function hasOpenAIKey() {
  return !!process.env.OPENAI_API_KEY;
}

// Функция для кодирования аудиофайла в Base64
function encodeAudioToBase64(audioFilePath) {
  try {
    const audioBuffer = fs.readFileSync(audioFilePath);
    return audioBuffer.toString('base64');
  } catch (error) {
    console.error(`Ошибка при кодировании аудиофайла: ${error.message}`);
    return null;
  }
}

// Функция для транскрибирования аудиофайла с помощью GPT-4o
async function transcribeWithGPT4o(audioFilePath) {
  try {
    // Проверяем наличие API ключа
    if (!hasOpenAIKey()) {
      console.error('OPENAI_API_KEY не найден в переменных окружения');
      return null;
    }

    // Кодируем аудиофайл в Base64
    console.log(`Кодирование аудиофайла: ${audioFilePath}`);
    const audioBase64 = encodeAudioToBase64(audioFilePath);
    if (!audioBase64) {
      return null;
    }

    console.log('Отправка запроса в GPT-4o...');
    
    // Формируем запрос к OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Транскрибируй это аудио и идентифицируй говорящих. Представь результат в виде диалога.'
              },
              {
                type: 'audio_url',
                audio_url: {
                  url: `data:audio/mp3;base64,${audioBase64}`
                }
              }
            ]
          }
        ]
      })
    });

    // Обрабатываем ответ
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ошибка API: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    console.log('Получен ответ от GPT-4o');

    // Возвращаем транскрипцию и информацию о токенах
    return {
      text: data.choices[0].message.content,
      usage: data.usage
    };
  } catch (error) {
    console.error(`Ошибка при транскрибировании: ${error.message}`);
    return null;
  }
}

// Основная функция для запуска тестирования
async function main() {
  console.log('====================================');
  console.log('Тестирование GPT-4o Audio Preview API');
  console.log('====================================');

  // Проверяем наличие API ключа
  if (!hasOpenAIKey()) {
    console.error('❌ Для запуска теста необходим OPENAI_API_KEY в переменных окружения');
    return;
  }

  // Список тестовых аудиофайлов
  const testFiles = [
    'attached_assets/35303ed6-9bbf-4df4-910f-be0193dc2a4e.jfif',
    'temp/recording_sample.mp3',
    'temp/recording_test.wav'
  ];

  // Перебираем тестовые файлы и пытаемся их транскрибировать
  let successfulTranscription = false;
  for (const filePath of testFiles) {
    const fullPath = path.resolve(filePath);
    
    if (fs.existsSync(fullPath)) {
      console.log(`\nТестирование с файлом: ${fullPath}`);
      
      const startTime = Date.now();
      const result = await transcribeWithGPT4o(fullPath);
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      
      if (result && result.text) {
        successfulTranscription = true;
        console.log(`✅ Транскрипция успешно завершена за ${elapsedSeconds.toFixed(2)} сек`);
        console.log(`📊 Использовано токенов: ${result.usage.total_tokens} (вход: ${result.usage.prompt_tokens}, выход: ${result.usage.completion_tokens})`);
        
        // Сохраняем результат в файл
        const outputPath = `temp/transcription_${path.basename(filePath)}.txt`;
        fs.writeFileSync(outputPath, result.text);
        console.log(`📝 Результат сохранен в файл: ${outputPath}`);
        
        // Выводим первые 300 символов результата
        console.log('\nПервые 300 символов транскрипции:');
        console.log('------------------------------------');
        console.log(result.text.substring(0, 300) + (result.text.length > 300 ? '...' : ''));
        console.log('------------------------------------');
        
        // Прерываем цикл после первой успешной транскрипции
        break;
      } else {
        console.log(`❌ Не удалось транскрибировать файл: ${fullPath}`);
      }
    } else {
      console.log(`⚠️ Файл не найден: ${fullPath}`);
    }
  }

  if (!successfulTranscription) {
    console.log('\n❌ Не удалось выполнить транскрипцию ни одного файла');
    console.log('Убедитесь, что аудиофайлы существуют и доступны для чтения');
  }

  console.log('\n====================================');
  console.log('Тестирование GPT-4o Audio Preview API завершено');
  console.log('====================================');
}

// Запуск основной функции
main().catch(error => {
  console.error(`Критическая ошибка: ${error.message}`);
  console.error(error.stack);
});