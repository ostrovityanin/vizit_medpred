/**
 * Тестовый скрипт для GPT-4o Audio Preview микросервиса
 * 
 * Запускается отдельно от основного сервиса для проверки работоспособности.
 * Использование: node test.js <путь_к_аудиофайлу>
 */

// Загружаем переменные окружения
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { log } = require('./logger');
const GPT4oClient = require('./gpt4o-client');

// Проверяем аргументы командной строки
if (process.argv.length < 3) {
  log.error('Не указан путь к аудиофайлу');
  log.info('Использование: node test.js <путь_к_аудиофайлу>');
  process.exit(1);
}

const audioFilePath = process.argv[2];

// Проверяем существование файла
if (!fs.existsSync(audioFilePath)) {
  log.error(`Файл не существует: ${audioFilePath}`);
  process.exit(1);
}

// Получаем информацию о файле
const stats = fs.statSync(audioFilePath);
log.info(`Тестирование транскрипции файла: ${audioFilePath} (${(stats.size / (1024 * 1024)).toFixed(2)} МБ)`);

// Создаем экземпляр клиента
const client = new GPT4oClient();

// Функция для тестирования транскрипции
async function testTranscription() {
  try {
    log.info('Начинаем тестирование транскрипции...');
    
    // Замеряем время выполнения
    const startTime = Date.now();
    
    // Выполняем транскрипцию
    const result = await client.transcribeAudio(audioFilePath);
    
    // Вычисляем затраченное время
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;
    
    log.info(`Транскрипция успешно завершена за ${processingTime.toFixed(2)} секунд`);
    log.info(`Стоимость: $${result.cost}, Токенов обработано: ${result.tokensProcessed}`);
    log.info(`Результат транскрипции (первые 500 символов):`);
    log.info('-----------------------------------------------------------');
    log.info(result.text.substring(0, 500) + (result.text.length > 500 ? '...' : ''));
    log.info('-----------------------------------------------------------');
    
    // Сохраняем результат в файл
    const outputFilePath = path.join(
      path.dirname(audioFilePath),
      `${path.basename(audioFilePath, path.extname(audioFilePath))}_gpt4o_transcription.txt`
    );
    
    fs.writeFileSync(outputFilePath, result.text);
    log.info(`Полный текст транскрипции сохранен в файл: ${outputFilePath}`);
    
    return true;
  } catch (error) {
    log.error(`Ошибка при тестировании транскрипции: ${error.message}`);
    if (error.stack) {
      log.debug(error.stack);
    }
    return false;
  }
}

// Запускаем тест
testTranscription()
  .then(success => {
    if (success) {
      log.info('Тестирование успешно завершено');
    } else {
      log.error('Тестирование завершилось с ошибками');
      process.exit(1);
    }
  })
  .catch(error => {
    log.error(`Необработанная ошибка: ${error.message}`);
    process.exit(1);
  });