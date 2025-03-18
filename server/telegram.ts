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
export async function resolveTelegramUsername(username: string): Promise<number | null> {
  if (!BOT_TOKEN) {
    log('No Telegram Bot Token provided', 'telegram');
    return null;
  }

  try {
    // Remove @ symbol if present
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
    
    // Call the Telegram API to get chat information
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
  chatId: number, 
  caption: string = 'Запись с таймера визита'
): Promise<boolean> {
  if (!BOT_TOKEN) {
    log('No Telegram Bot Token provided', 'telegram');
    return false;
  }

  try {
    // Prepare form data with the audio file
    const form = new FormData();
    form.append('chat_id', chatId.toString());
    form.append('caption', caption);
    form.append('audio', fs.createReadStream(filePath));

    // Send the request to the Telegram API
    const response = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendAudio`,
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
      }
    );

    if (response.status === 200 && response.data.ok) {
      log(`Successfully sent audio to chat ID ${chatId}`, 'telegram');
      return true;
    } else {
      log(`Failed to send audio: ${JSON.stringify(response.data)}`, 'telegram');
      return false;
    }
  } catch (error) {
    log(`Error sending audio: ${error}`, 'telegram');
    return false;
  }
}