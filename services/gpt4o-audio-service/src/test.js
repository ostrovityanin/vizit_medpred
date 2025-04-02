const fs = require('fs');
const path = require('path');
const gpt4oClient = require('./gpt4o-client');
const logger = require('./logger');

/**
 * Тестовый скрипт для проверки функциональности GPT-4o Audio Preview
 */
async function testGPT4oAudio() {
  logger.info('Запуск тестирования GPT-4o Audio Preview');
  
  // Проверка наличия API ключа
  if (!gpt4oClient.isOpenAIConfigured()) {
    logger.error('OpenAI API ключ не настроен. Прерывание теста.');
    return;
  }
  
  // Путь к тестовому аудиофайлу
  // Вы можете заменить на путь к своему тестовому файлу
  const testAudioPath = process.argv[2];
  
  if (!testAudioPath) {
    logger.error('Путь к тестовому аудиофайлу не указан. Использование: node test.js <путь_к_аудио>');
    return;
  }
  
  if (!fs.existsSync(testAudioPath)) {
    logger.error(`Тестовый аудиофайл не найден: ${testAudioPath}`);
    return;
  }
  
  try {
    logger.info(`Начало тестирования с файлом: ${testAudioPath}`);
    
    // Получаем информацию о файле
    const stats = fs.statSync(testAudioPath);
    logger.info(`Размер файла: ${stats.size} байт`);
    
    // Промпт для транскрипции
    const prompt = 'Расшифруй аудио и выдели говорящих. Пожалуйста, верни текст в формате диалога с указанием говорящих.';
    
    // Запускаем транскрипцию
    const startTime = Date.now();
    const result = await gpt4oClient.transcribeWithGPT4o(testAudioPath, prompt);
    const endTime = Date.now();
    
    // Вычисляем время выполнения
    const executionTime = (endTime - startTime) / 1000; // в секундах
    
    // Выводим результаты
    logger.info('====== РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ======');
    logger.info(`Время выполнения: ${executionTime.toFixed(2)} секунд`);
    logger.info(`Использовано токенов: ${result.tokens.total} (ввод: ${result.tokens.input}, вывод: ${result.tokens.output})`);
    logger.info(`Примерная стоимость: $${result.cost.total.toFixed(6)}`);
    logger.info('====== ТРАНСКРИПЦИЯ АУДИО ======');
    logger.info(result.text);
    logger.info('==================================');
    
    // Сохраняем результат в файл
    const outputDir = path.join(__dirname, '../results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, `result-${Date.now()}.txt`);
    const outputContent = `
====== РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ GPT-4o AUDIO PREVIEW ======
Файл: ${testAudioPath}
Размер: ${stats.size} байт
Время выполнения: ${executionTime.toFixed(2)} секунд
Использовано токенов: ${result.tokens.total} (ввод: ${result.tokens.input}, вывод: ${result.tokens.output})
Примерная стоимость: $${result.cost.total.toFixed(6)}

====== ТРАНСКРИПЦИЯ АУДИО ======
${result.text}
==================================
    `;
    
    fs.writeFileSync(outputFile, outputContent);
    logger.info(`Результаты сохранены в: ${outputFile}`);
    
  } catch (error) {
    logger.error(`Тест не пройден: ${error.message}`);
    if (error.response) {
      logger.error(`Детали ошибки API: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// Запуск теста
testGPT4oAudio().catch(error => {
  logger.error(`Необработанная ошибка: ${error.message}`);
  process.exit(1);
});