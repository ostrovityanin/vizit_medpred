/**
 * Вспомогательные функции для микросервиса audio-notifier
 */

/**
 * Функция ожидания (sleep)
 * @param {number} ms - Время ожидания в миллисекундах
 * @returns {Promise<void>} - Promise, который разрешится через указанное время
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Форматирует продолжительность в секундах в читаемый формат MM:SS
 * @param {number} seconds - Продолжительность в секундах
 * @returns {string} - Отформатированная продолжительность в формате MM:SS
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(parseInt(seconds))) return '00:00';
  
  const sec = parseInt(seconds);
  const minutes = Math.floor(sec / 60);
  const remainingSeconds = sec % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Разбивает длинный текст на части, подходящие для отправки в Telegram
 * (лимит Telegram - 4096 символов в одном сообщении)
 * @param {string} text - Исходный текст
 * @param {number} maxLength - Максимальная длина каждой части (по умолчанию 3800, чтобы оставить место для доп. информации)
 * @returns {string[]} - Массив частей текста
 */
function chunkText(text, maxLength = 3800) {
  if (!text) return [''];
  if (text.length <= maxLength) return [text];
  
  const chunks = [];
  let currentChunk = '';
  
  // Разбиваем текст по абзацам
  const paragraphs = text.split('\n');
  
  for (const paragraph of paragraphs) {
    // Если абзац слишком длинный, разбиваем его на предложения
    if (paragraph.length > maxLength) {
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      
      for (const sentence of sentences) {
        // Если текущий фрагмент + новое предложение превышают ограничение,
        // сохраняем текущий фрагмент и начинаем новый
        if (currentChunk.length + sentence.length + 1 > maxLength) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          currentChunk += (currentChunk ? ' ' : '') + sentence;
        }
      }
    } else {
      // Если текущий фрагмент + новый абзац превышают ограничение,
      // сохраняем текущий фрагмент и начинаем новый
      if (currentChunk.length + paragraph.length + 1 > maxLength) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + paragraph;
      }
    }
  }
  
  // Добавляем последний фрагмент, если он не пустой
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

module.exports = {
  sleep,
  formatDuration,
  chunkText
};