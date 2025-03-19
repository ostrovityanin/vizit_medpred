export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private enhancedStream: MediaStream | null = null;

  // Параметры усиления звука
  private gainValue: number = 2.5; // Коэффициент усиления (регулируемый)

  async requestPermission(): Promise<boolean> {
    try {
      // Запрашиваем доступ к микрофону с улучшенными параметрами
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1, // Моно запись для лучшего качества речи
          sampleRate: 48000 // Высокое качество сэмплирования
        } 
      });
      
      // Применяем обработку звука для улучшения качества
      await this.enhanceAudioStream(stream);
      
      return true;
    } catch (error) {
      console.error('Failed to get user media', error);
      return false;
    }
  }
  
  // Метод для усиления громкости и улучшения качества звука
  private async enhanceAudioStream(originalStream: MediaStream): Promise<void> {
    try {
      // Сохраняем оригинальный поток для очистки ресурсов
      this.stream = originalStream;
      
      // Создаем аудио контекст
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Создаем источник из потока микрофона
      this.sourceNode = this.audioContext.createMediaStreamSource(originalStream);
      
      // Создаем узел усиления
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.gainValue; // Усиливаем звук
      
      // Создаем узел назначения (для создания нового потока)
      this.destinationNode = this.audioContext.createMediaStreamDestination();
      
      // Соединяем узлы в цепочку: источник -> усиление -> назначение
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.destinationNode);
      
      // Получаем обработанный поток
      this.enhancedStream = this.destinationNode.stream;
      
      console.log('Audio processing chain setup successfully');
    } catch (error) {
      console.error('Error setting up audio processing:', error);
      // В случае ошибки используем оригинальный поток
      this.enhancedStream = originalStream;
    }
  }

  startRecording(): boolean {
    // Проверяем, доступен ли усиленный поток
    const streamToRecord = this.enhancedStream || this.stream;
    
    if (!streamToRecord) {
      console.error('No stream available for recording');
      return false;
    }

    try {
      this.audioChunks = [];
      
      // Пробуем создать медиа рекордер с улучшенными опциями
      try {
        // Так как мы проверили streamToRecord на null выше, можем использовать type assertion
        this.mediaRecorder = new MediaRecorder(streamToRecord as MediaStream, {
          mimeType: 'audio/webm',
          audioBitsPerSecond: 128000 // 128 kbps для лучшего качества
        });
      } catch (err) {
        // Если не поддерживается, используем настройки по умолчанию
        console.warn('Advanced recording options not supported, using defaults');
        this.mediaRecorder = new MediaRecorder(streamToRecord as MediaStream);
      }
      
      // Настраиваем сбор аудио-данных
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Начинаем запись с частотой сбора данных 1 секунда
      this.mediaRecorder.start(1000);
      console.log('Recording started with enhanced audio settings');
      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      return false;
    }
  }

  stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        // Создаем blob с максимальным качеством
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  cleanup() {
    // Останавливаем все медиа треки
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    // Очищаем аудио контекст и его узлы
    if (this.audioContext) {
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }
      
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      
      this.destinationNode = null;
      
      // Закрываем аудио контекст, если это возможно
      if (this.audioContext.state !== 'closed') {
        this.audioContext.close().catch(err => console.error('Error closing audio context:', err));
      }
      this.audioContext = null;
    }
    
    this.enhancedStream = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

// Singleton instance
export const audioRecorder = new AudioRecorder();