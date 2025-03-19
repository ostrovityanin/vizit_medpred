/**
 * Отправляет аудио визита получателю через админский бот (старый способ)
 */
export async function sendAudioToRecipient(blob: Blob, recipient: string, senderUsername: string = "Пользователь"): Promise<boolean> {
  try {
    console.log(`Sending audio to recipient: ${recipient} from ${senderUsername}`);
    
    const formData = new FormData();
    formData.append('audio', blob, 'recording.wav');
    formData.append('duration', String(Math.floor(Date.now() / 1000)));
    formData.append('timestamp', new Date().toISOString());
    formData.append('targetUsername', recipient);
    formData.append('senderUsername', senderUsername);

    const response = await fetch('/api/recordings', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.error('Error uploading recording:', await response.text());
      throw new Error('Failed to upload recording');
    }

    const recording = await response.json();
    console.log('Recording uploaded successfully:', recording);
    
    // In a real Telegram Mini App, we'd use the Telegram WebApp API to send data
    if (window.Telegram?.WebApp && !recipient.includes('@')) {
      // You would normally send a command to the bot to deliver the audio
      window.Telegram.WebApp.sendData(JSON.stringify({
        action: 'send_recording',
        recordingId: recording.id,
        recipient
      }));
    }

    // For this implementation, we're also calling our API to mark as sent
    const sendResponse = await fetch(`/api/recordings/${recording.id}/send`, {
      method: 'POST',
    });
    
    if (!sendResponse.ok) {
      console.error('Error sending recording:', await sendResponse.text());
      throw new Error(`Failed to send recording: ${sendResponse.statusText}`);
    }
    
    const sendData = await sendResponse.json();
    console.log('Send response:', sendData);

    return true;
  } catch (error) {
    console.error('Error sending audio:', error);
    return false;
  }
}

/**
 * Отправляет аудио визита получателю через клиентский бот
 */
export async function sendAudioViaClientBot(recordingId: number, recipient: string): Promise<boolean> {
  try {
    console.log(`Sending audio via client bot to: ${recipient}, recording ID: ${recordingId}`);
    
    const response = await fetch(`/api/client/send-audio/${recordingId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: recipient
      }),
    });

    if (!response.ok) {
      console.error('Error sending audio via client bot:', await response.text());
      throw new Error('Failed to send audio via client bot');
    }

    const result = await response.json();
    console.log('Client bot send result:', result);

    return result.success;
  } catch (error) {
    console.error('Error sending audio via client bot:', error);
    return false;
  }
}

/**
 * Отправляет текстовое сообщение через клиентский бот
 */
export async function sendMessageViaClientBot(recipient: string, message: string): Promise<boolean> {
  try {
    console.log(`Sending message via client bot to: ${recipient}`);
    
    const response = await fetch('/api/client/send-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: recipient,
        message: message
      }),
    });

    if (!response.ok) {
      console.error('Error sending message via client bot:', await response.text());
      throw new Error('Failed to send message via client bot');
    }

    const result = await response.json();
    console.log('Client bot message result:', result);

    return result.success;
  } catch (error) {
    console.error('Error sending message via client bot:', error);
    return false;
  }
}

/**
 * Отправляет уведомление о новой записи пользователю через клиентский бот
 */
export async function notifyUserAboutRecording(recordingId: number, recipient: string): Promise<boolean> {
  try {
    console.log(`Sending notification about recording ${recordingId} to ${recipient}`);
    
    const response = await fetch(`/api/client/notify-user/${recordingId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: recipient
      }),
    });

    if (!response.ok) {
      console.error('Error sending notification via client bot:', await response.text());
      throw new Error('Failed to send notification via client bot');
    }

    const result = await response.json();
    console.log('Client bot notification result:', result);

    return result.success;
  } catch (error) {
    console.error('Error sending notification via client bot:', error);
    return false;
  }
}

/**
 * Получает записи пользователя через клиентский бот
 */
export async function getUserRecordings(username: string): Promise<any[]> {
  try {
    console.log(`Getting recordings for user: ${username}`);
    
    const response = await fetch(`/api/client/recordings/${username}`);

    if (!response.ok) {
      console.error('Error fetching user recordings:', await response.text());
      throw new Error('Failed to fetch user recordings');
    }

    const result = await response.json();
    console.log('User recordings result:', result);

    return result.recordings || [];
  } catch (error) {
    console.error('Error fetching user recordings:', error);
    return [];
  }
}

// For backward compatibility
export async function sendAudioToTelegram(blob: Blob, targetUsername: string, senderUsername: string = "Пользователь"): Promise<boolean> {
  return sendAudioToRecipient(blob, targetUsername, senderUsername);
}

export function isTelegramWebApp(): boolean {
  return !!window.Telegram?.WebApp;
}
