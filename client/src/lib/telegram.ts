export async function sendAudioToTelegram(blob: Blob, targetUsername: string): Promise<boolean> {
  try {
    console.log(`Sending audio to Telegram user: @${targetUsername}`);
    
    const formData = new FormData();
    formData.append('audio', blob, 'recording.wav');
    formData.append('duration', String(Math.floor(Date.now() / 1000)));
    formData.append('timestamp', new Date().toISOString());
    formData.append('targetUsername', targetUsername);

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
    if (window.Telegram?.WebApp) {
      // You would normally send a command to the bot to deliver the audio
      window.Telegram.WebApp.sendData(JSON.stringify({
        action: 'send_recording',
        recordingId: recording.id,
        targetUsername
      }));
    }

    // For this implementation, we're also calling our API to mark as sent
    const sendResponse = await fetch(`/api/recordings/${recording.id}/send`, {
      method: 'POST',
    });
    
    if (!sendResponse.ok) {
      console.error('Error sending to Telegram:', await sendResponse.text());
      throw new Error(`Failed to send recording: ${sendResponse.statusText}`);
    }
    
    const sendData = await sendResponse.json();
    console.log('Telegram send response:', sendData);

    return true;
  } catch (error) {
    console.error('Error sending audio to Telegram:', error);
    return false;
  }
}

export function isTelegramWebApp(): boolean {
  return !!window.Telegram?.WebApp;
}
