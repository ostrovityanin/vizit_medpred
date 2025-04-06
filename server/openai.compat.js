/**
 * Совместимость между различными форматами модулей
 * 
 * Этот файл обеспечивает совместимость с модулями, которые используют require()
 * для импорта OpenAI функций.
 */

// Импортируем функции из TS модуля OpenAI
const openai = require('./openai');

// Экспортируем все функции из модуля, чтобы обеспечить совместимость
module.exports = {
  transcribeWithWhisper: openai.transcribeWithWhisper,
  transcribeWithGPT4o: openai.transcribeWithGPT4o,
  transcribeWithModel: openai.transcribeWithModel
};