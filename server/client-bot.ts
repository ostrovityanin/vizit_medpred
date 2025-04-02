import axios from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';
import { log } from './vite';
import { Recording } from '@shared/schema';

/**
 * Клиентский бот (@MedPredRuBot) для пользовательской части приложения
 * Отвечает за взаимодействие с пользователями, отправку им данных визитов
 */

// API ключ бота (берется из переменных окружения)
const TELEGRAM_CLIENT_BOT_TOKEN = process.env.MEDPRED_BOT_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${TELEGRAM_CLIENT_BOT_TOKEN}`;

/**
 * Получает информацию о клиентском боте
 */
export async function getClientBotInfo(): Promise<any> {
  try {
    if (!TELEGRAM_CLIENT_BOT_TOKEN) {
      log(`Client bot API key not provided`, 'client-bot');
      return null;
    }
    
    const response = await axios.get(`${BASE_URL}/getMe`);
    return response.data.result;
  } catch (error) {
    log(`Error getting client bot info: ${error}`, 'client-bot');
    return null;
  }
}

/**
 * Получает список обновлений (сообщений) для клиентского бота
 */
export async function getClientBotUpdates(): Promise<any> {
  try {
    if (!TELEGRAM_CLIENT_BOT_TOKEN) {
      log(`Client bot API key not provided`, 'client-bot');
      return null;
    }
    
    const response = await axios.get(`${BASE_URL}/getUpdates`);
    return response.data.result;
  } catch (error) {
    log(`Error getting client bot updates: ${error}`, 'client-bot');
    return null;
  }
}

/**
 * Resolves a username to a chat_id using Telegram's getChat API (для клиентского бота)
 */
export async function resolveClientUsername(username: string): Promise<number | string | null> {
  try {
    if (!TELEGRAM_CLIENT_BOT_TOKEN) {
      log(`Client bot API key not provided`, 'client-bot');
      return null;
    }
    
    // Если имя пользователя начинается с @, то удаляем @
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    
    // Пробуем получить информацию о чате по имени пользователя
    const response = await axios.get(`${BASE_URL}/getChat`, {
      params: {
        chat_id: `@${cleanUsername}`
      }
    });
    
    if (response.data.ok && response.data.result) {
      // Возвращаем идентификатор чата
      return response.data.result.id;
    }
    
    return null;
  } catch (error) {
    log(`Error resolving username (client bot) @${username}: ${error}`, 'client-bot');
    return null;
  }
}

/**
 * Отправляет текстовое сообщение пользователю через клиентский бот
 */
export async function sendClientTextMessage(
  chatId: number | string,
  message: string
): Promise<boolean> {
  try {
    if (!TELEGRAM_CLIENT_BOT_TOKEN) {
      log(`Client bot API key not provided`, 'client-bot');
      return false;
    }
    
    // Отправляем сообщение
    const response = await axios.post(`${BASE_URL}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
    
    if (response.data.ok) {
      log(`Text message sent to ${chatId} via client bot`, 'client-bot');
      return true;
    } else {
      log(`Failed to send text message to ${chatId} via client bot: ${response.data}`, 'client-bot');
      return false;
    }
  } catch (error) {
    log(`Error sending text message via client bot: ${error}`, 'client-bot');
    return false;
  }
}

/**
 * Отправляет аудио визита пользователю через клиентский бот
 */
export async function sendClientAudio(
  filePath: string,
  chatId: number | string,
  caption: string = "",
  transcription: string = ""
): Promise<boolean> {
  try {
    if (!TELEGRAM_CLIENT_BOT_TOKEN) {
      log(`Client bot API key not provided`, 'client-bot');
      return false;
    }
    
    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      log(`Audio file not found: ${filePath}`, 'client-bot');
      return false;
    }
    
    // Создаем FormData для отправки файла
    const formData = new FormData();
    formData.append('chat_id', chatId);
    
    // Добавляем транскрипцию к подписи, если она указана и помещается в лимит
    const MAX_CAPTION_LENGTH = 1024;
    let finalCaption = caption;
    
    if (transcription) {
      // Проверяем, поместится ли транскрипция в подпись
      const transcriptionText = `\n\n<b>Транскрипция:</b>\n${transcription}`;
      if (caption.length + transcriptionText.length <= MAX_CAPTION_LENGTH) {
        finalCaption += transcriptionText;
      }
    }
    
    // Если подпись слишком длинная, обрезаем её
    if (finalCaption.length > MAX_CAPTION_LENGTH) {
      finalCaption = finalCaption.substring(0, MAX_CAPTION_LENGTH - 3) + '...';
    }
    
    formData.append('caption', finalCaption);
    formData.append('parse_mode', 'HTML'); // Включаем HTML-разметку в подписи
    
    // Читаем файл и добавляем его в formData
    const fileStream = fs.createReadStream(filePath);
    formData.append('audio', fileStream);
    
    // Отправляем запрос
    const response = await axios.post(`${BASE_URL}/sendAudio`, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });
    
    if (response.data.ok) {
      log(`Audio sent to ${chatId} via client bot`, 'client-bot');
      
      // Если транскрипция не поместилась в подпись, отправляем её отдельным сообщением
      if (transcription && caption.length + `\n\n<b>Транскрипция:</b>\n${transcription}`.length > MAX_CAPTION_LENGTH) {
        // Отправляем полную транскрипцию отдельным сообщением
        const transcriptionMessage = `<b>Полная транскрипция аудио:</b>\n\n${transcription}`;
        await sendClientTextMessage(chatId, transcriptionMessage);
        log(`Full transcription sent as separate message to ${chatId}`, 'client-bot');
      }
      
      return true;
    } else {
      log(`Failed to send audio to ${chatId} via client bot: ${response.data}`, 'client-bot');
      return false;
    }
  } catch (error) {
    log(`Error sending audio via client bot: ${error}`, 'client-bot');
    return false;
  }
}

/**
 * Отправляет уведомление пользователю о новом визите с его участием
 */
export async function notifyUserAboutRecording(recording: Recording, userChatId: number | string): Promise<boolean> {
  try {
    // Формируем текст сообщения
    let message = `🎙️ <b>Новый аудио визит</b>\n\n`;
    message += `⏱️ <b>Продолжительность:</b> ${formatDuration(recording.duration)}\n`;
    message += `📅 <b>Дата визита:</b> ${new Date(recording.timestamp).toLocaleString('ru')}\n`;
    
    // Добавляем имя отправителя, если есть
    if (recording.senderUsername) {
      message += `👤 <b>Отправитель:</b> ${recording.senderUsername}\n`;
    }
    
    // Добавляем ID записи для возможности получения аудио через бота в будущем
    message += `📟 <b>ID записи:</b> ${recording.id}\n`;
    
    if (recording.transcription) {
      // Добавляем отрывок транскрипции (первые 200 символов)
      const previewText = recording.transcription.length > 200 
        ? recording.transcription.substring(0, 200) + '...' 
        : recording.transcription;
        
      message += `\n📝 <b>Содержание:</b>\n<i>${previewText}</i>`;
      
      // Если транскрипция длинная, добавляем сообщение о том, что полный текст доступен вместе с аудио
      if (recording.transcription.length > 200) {
        message += `\n\n<i>Полный текст транскрипции будет отправлен вместе с аудиофайлом</i>`;
      }
    }
    
    // Отправляем сообщение
    return await sendClientTextMessage(userChatId, message);
  } catch (error) {
    log(`Error notifying user about recording: ${error}`, 'client-bot');
    return false;
  }
}

/**
 * Форматирует продолжительность в секундах в читаемый формат MM:SS
 */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}