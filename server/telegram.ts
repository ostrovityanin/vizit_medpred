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
    
    // For our app, we'll just return the username, as we can send directly to @username
    // This bypasses the need for getChat and allows sending even if the bot hasn't
    // started a conversation with the user yet
    log(`Using direct username @${cleanUsername} instead of resolving chat_id`, 'telegram');
    return `@${cleanUsername}`;
    
    /* Use this approach if you need the actual chat_id
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getChat`, {
      params: {
        chat_id: `@${cleanUsername}`
      }
    });

    if (response.status === 200 && response.data.ok) {
      return response.data.result.id;
    } else {
      log(`Failed to resolve username ${username}: ${JSON.stringify(response.data)}`, 'telegram');
      return null;
    }
    */
  } catch (error) {
    log(`Error resolving username ${username}: ${error}`, 'telegram');
    return null;
  }
}

/**
 * Sends an audio file to a Telegram user
 */
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
    // Ensure chatId starts with @
    const formattedChatId = (typeof chatId === 'string' && !chatId.startsWith('@')) 
      ? `@${chatId}` 
      : chatId.toString();
      
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