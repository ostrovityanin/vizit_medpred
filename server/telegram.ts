import { log } from './vite';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Get the bot token from environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export interface TelegramUser {
  username: string;
  chat_id?: number;
}

/**
 * Resolves a username to a chat_id using Telegram's getChat API
 */
export async function resolveTelegramUsername(username: string): Promise<number | string | null> {
  if (!BOT_TOKEN) {
    log('No Telegram Bot Token provided', 'telegram');
    return null;
  }

  try {
    // Remove @ symbol if present
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    
    // Try to get actual chat_id first
    log(`Attempting to resolve username @${cleanUsername} to chat_id`, 'telegram');
    try {
      const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getChat`, {
        params: {
          chat_id: `@${cleanUsername}`
        }
      });

      if (response.status === 200 && response.data.ok) {
        log(`Successfully resolved @${cleanUsername} to chat_id: ${response.data.result.id}`, 'telegram');
        return response.data.result.id;
      } else {
        log(`Failed to resolve username @${cleanUsername}: ${JSON.stringify(response.data)}`, 'telegram');
      }
    } catch (error: any) {
      log(`Error resolving chat_id: ${error.message}`, 'telegram');
      if (error.response) {
        log(`Response data: ${JSON.stringify(error.response.data)}`, 'telegram');
      }
    }
    
    // Fallback to direct username if chat_id resolution fails
    log(`Falling back to direct username @${cleanUsername}`, 'telegram');
    return `@${cleanUsername}`;
  } catch (error) {
    log(`Error resolving username ${username}: ${error}`, 'telegram');
    return null;
  }
}

/**
 * Sends an audio file to a Telegram user
 */
/**
 * Отправляет аудиофайл пользователю Telegram
 * 
 * Важно: для отправки сообщений пользователь должен начать диалог с ботом,
 * отправив команду /start. Иначе бот не сможет отправить сообщение и будет ошибка
 * "Bad Request: chat not found"
 */
/**
 * Отправляет текстовое сообщение пользователю Telegram
 */
export async function sendTextToTelegram(
  chatId: number | string,
  text: string
): Promise<boolean> {
  if (!BOT_TOKEN) {
    log('No Telegram Bot Token provided', 'telegram');
    return false;
  }

  try {
    // Форматируем chatId также как и в функции отправки аудио
    let formattedChatId: string;
    
    if (typeof chatId === 'string') {
      if (isNaN(Number(chatId))) {
        formattedChatId = chatId.startsWith('@') ? chatId : `@${chatId}`;
        log(`Formatting username to: ${formattedChatId}`, 'telegram');
      } else {
        formattedChatId = chatId;
      }
    } else {
      formattedChatId = chatId.toString();
    }
    
    log(`Sending text message to chat_id: ${formattedChatId}`, 'telegram');
    log(`Using bot token: ${BOT_TOKEN.substring(0, 5)}...`, 'telegram');
    
    // Отправляем запрос к Telegram API
    const apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await axios.post(apiUrl, {
      chat_id: formattedChatId,
      text: text
    });
    
    if (response.status === 200 && response.data.ok) {
      log(`Successfully sent text message to ${formattedChatId}`, 'telegram');
      return true;
    } else {
      log(`Failed to send text message: ${JSON.stringify(response.data)}`, 'telegram');
      return false;
    }
  } catch (error: any) {
    log(`Error sending text message: ${error.message}`, 'telegram');
    if (error.response) {
      log(`Error response data: ${JSON.stringify(error.response.data)}`, 'telegram');
      log(`Error response status: ${error.response.status}`, 'telegram');
    }
    return false;
  }
}

export async function sendAudioToTelegram(
  filePath: string, 
  chatId: number | string, 
  caption: string = 'Запись с таймера визита'
): Promise<boolean> {
  if (!BOT_TOKEN) {
    log('No Telegram Bot Token provided', 'telegram');
    return false;
  }

  try {
    // For username, ensure it starts with @, but for actual chat_id number, leave as is
    let formattedChatId: string;
    
    if (typeof chatId === 'string') {
      // If it's a username (not a numeric chat_id)
      if (isNaN(Number(chatId))) {
        // Make sure the username starts with @
        formattedChatId = chatId.startsWith('@') ? chatId : `@${chatId}`;
        log(`Formatting username to: ${formattedChatId}`, 'telegram');
      } else {
        // It's a numeric chat_id as string, don't add @
        formattedChatId = chatId;
      }
    } else {
      // It's already a number
      formattedChatId = chatId.toString();
    }
      
    // Prepare form data with the audio file
    const form = new FormData();
    form.append('chat_id', formattedChatId);
    form.append('caption', caption);
    form.append('audio', fs.createReadStream(filePath));

    log(`Sending audio to chat_id: ${formattedChatId}`, 'telegram');
    log(`Using bot token: ${BOT_TOKEN.substring(0, 5)}...`, 'telegram');

    // Send the request to the Telegram API
    const apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendAudio`;
    log(`Calling Telegram API: ${apiUrl.substring(0, 30)}...`, 'telegram');
    
    const response = await axios.post(
      apiUrl,
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
      }
    );

    if (response.status === 200 && response.data.ok) {
      log(`Successfully sent audio to ${formattedChatId}`, 'telegram');
      return true;
    } else {
      log(`Failed to send audio: ${JSON.stringify(response.data)}`, 'telegram');
      return false;
    }
  } catch (error: any) {
    log(`Error sending audio: ${error.message}`, 'telegram');
    if (error.response) {
      log(`Error response data: ${JSON.stringify(error.response.data)}`, 'telegram');
      log(`Error response status: ${error.response.status}`, 'telegram');
    }
    return false;
  }
}