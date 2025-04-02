/**
 * Скрипт для тестирования отправки уведомлений в Telegram
 */
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Получаем токен и ID чата из переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

console.log(`Используем токен: ${token ? 'Да (токен установлен)' : 'Нет (токен отсутствует)'}`);
console.log(`Используем chatId: ${chatId ? chatId : 'Не установлен'}`);

// Функция для отправки тестового сообщения
async function sendTestMessage() {
  if (!token || !chatId) {
    console.error('Ошибка: Не указаны TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
    console.log('Пожалуйста, убедитесь, что эти переменные окружения установлены');
    return;
  }

  try {
    const bot = new TelegramBot(token, { polling: false });
    
    console.log('Отправка тестового сообщения...');
    const message = `
🔔 *Тестовое сообщение мониторинга*

📊 *Статус системы:* Работает
⏱ *Время:* ${new Date().toLocaleString()}
🖥 *Среда:* Replit
🟢 *Основной сервис:* Активен
    `;
    
    const result = await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    console.log('Сообщение успешно отправлено!');
    console.log('ID сообщения:', result.message_id);
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error.message);
    if (error.code === 'ETELEGRAM') {
      console.error('Telegram API ошибка:', error.response.body);
    }
  }
}

// Запускаем тест
sendTestMessage();