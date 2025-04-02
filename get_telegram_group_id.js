// Скрипт для получения ID группы Telegram
import https from 'https';

// Используем существующий токен бота из переменных окружения
const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  console.error('Ошибка: Токен бота не найден в переменных окружения. Пожалуйста, установите TELEGRAM_BOT_TOKEN.');
  process.exit(1);
}

// Функция для выполнения запроса к API Telegram
function makeRequest(method) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/${method}`,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (e) {
          reject(new Error(`Ошибка при разборе ответа: ${e.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

// Получаем информацию о боте
async function getBotInfo() {
  try {
    const response = await makeRequest('getMe');
    console.log('Информация о боте:');
    console.log(JSON.stringify(response, null, 2));
    return response.ok;
  } catch (error) {
    console.error('Ошибка при получении информации о боте:', error);
    return false;
  }
}

// Получаем последние обновления (сообщения) для бота
async function getUpdates() {
  try {
    const response = await makeRequest('getUpdates');
    
    console.log('\nПоследние обновления:');
    console.log(JSON.stringify(response, null, 2));
    
    if (response.ok && response.result.length > 0) {
      console.log('\nНайденные ID чатов:');
      
      // Извлекаем уникальные ID чатов из обновлений
      const chatIds = new Set();
      
      response.result.forEach(update => {
        if (update.message && update.message.chat) {
          const chat = update.message.chat;
          chatIds.add(chat.id);
          console.log(`- Чат "${chat.title || chat.username || chat.first_name || 'Без названия'}": ${chat.id} (тип: ${chat.type})`);
        }
      });
      
      if (chatIds.size === 0) {
        console.log('Не найдено ни одного ID чата. Пожалуйста, отправьте сообщение боту или добавьте его в группу.');
      } else {
        console.log('\nИнструкция:');
        console.log('1. Найдите в списке выше вашу группу или чат');
        console.log('2. Используйте соответствующий ID как значение для TELEGRAM_CHAT_ID');
        console.log('3. Если ваша группа не найдена, отправьте сообщение в группу и запустите скрипт снова');
      }
    } else {
      console.log('Нет доступных обновлений. Пожалуйста, отправьте сообщение боту или добавьте его в группу.');
    }
  } catch (error) {
    console.error('Ошибка при получении обновлений:', error);
  }
}

// Запускаем выполнение
async function main() {
  console.log('Проверка подключения к API Telegram...\n');
  
  const botValid = await getBotInfo();
  if (botValid) {
    await getUpdates();
  }
}

main();