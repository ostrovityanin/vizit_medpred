export async function sendAudioToRecipient(blob: Blob, recipient: string): Promise<boolean> {
  try {
    console.log(`Sending audio to recipient: ${recipient}`);
    
    const formData = new FormData();
    formData.append('audio', blob, 'recording.wav');
    formData.append('duration', String(Math.floor(Date.now() / 1000)));
    formData.append('timestamp', new Date().toISOString());
    formData.append('targetUsername', recipient);

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

// For backward compatibility
export async function sendAudioToTelegram(blob: Blob, targetUsername: string): Promise<boolean> {
  return sendAudioToRecipient(blob, targetUsername);
}

export function isTelegramWebApp(): boolean {
  return !!window.Telegram?.WebApp;
}
