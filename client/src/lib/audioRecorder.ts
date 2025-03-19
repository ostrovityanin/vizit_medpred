export interface AudioFragment {
  blob: Blob;
  timestamp: number;
  index: number;
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private enhancedStream: MediaStream | null = null;
  
  // Данные для фрагментированной записи
  private audioFragments: AudioFragment[] = [];
  private fragmentInterval: number | null = null;
  private currentFragmentIndex: number = 0;
  private fragmentDuration: number = 60000; // 60 секунд (1 минута) на фрагмент
  private isFragmentedRecording: boolean = false;
  private onFragmentSaved: ((fragment: AudioFragment) => void) | null = null;

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

  /**
   * Запускает стандартную запись
   */
  startRecording(): boolean {
    // Отключаем фрагментированную запись
    this.isFragmentedRecording = false;
    this.audioFragments = [];
    this.currentFragmentIndex = 0;
    
    return this._initRecording();
  }
  
  /**
   * Запускает фрагментированную запись с сохранением фрагментов по таймеру
   * @param onFragmentSaved Callback, который вызывается при сохранении каждого фрагмента
   * @param fragmentDurationMs Длительность одного фрагмента в мс (по умолчанию 60000мс = 1 минута)
   */
  startFragmentedRecording(
    onFragmentSaved?: (fragment: AudioFragment) => void, 
    fragmentDurationMs: number = 60000
  ): boolean {
    // Настраиваем параметры фрагментированной записи
    this.isFragmentedRecording = true;
    this.fragmentDuration = fragmentDurationMs;
    this.audioFragments = [];
    this.currentFragmentIndex = 0;
    this.onFragmentSaved = onFragmentSaved || null;
    
    // Инициализируем запись
    const started = this._initRecording();
    
    if (started) {
      // Настраиваем таймер для сохранения фрагментов
      this._setupFragmentTimer();
    }
    
    return started;
  }
  
  /**
   * Инициализирует процесс записи (общий код для обычной и фрагментированной записи)
   * @private
   */
  private _initRecording(): boolean {
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
  
  /**
   * Настраивает таймер для периодического сохранения фрагментов
   * @private
   */
  private _setupFragmentTimer(): void {
    // Очищаем предыдущий таймер, если он существует
    if (this.fragmentInterval !== null) {
      clearInterval(this.fragmentInterval);
    }
    
    // Создаем новый таймер для сохранения фрагментов
    this.fragmentInterval = window.setInterval(() => {
      this._saveCurrentFragment();
    }, this.fragmentDuration);
  }
  
  /**
   * Сохраняет текущий фрагмент записи
   * @private
   */
  private _saveCurrentFragment(): void {
    if (!this.isFragmentedRecording || !this.mediaRecorder || this.audioChunks.length === 0) {
      return;
    }
    
    console.log(`Сохраняем фрагмент #${this.currentFragmentIndex} с ${this.audioChunks.length} чанками`);
    
    // Создаем blob из накопленных данных
    const fragmentBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    
    // Создаем объект фрагмента
    const fragment: AudioFragment = {
      blob: fragmentBlob,
      timestamp: Date.now(),
      index: this.currentFragmentIndex++
    };
    
    // Добавляем фрагмент в массив
    this.audioFragments.push(fragment);
    
    // Вызываем callback, если он задан
    if (this.onFragmentSaved) {
      this.onFragmentSaved(fragment);
    }
    
    // Отправляем фрагмент на сервер асинхронно
    this._uploadFragment(fragment).catch(error => {
      console.error(`Ошибка отправки фрагмента #${fragment.index}:`, error);
    });
    
    // Очищаем массив чанков для следующего фрагмента
    this.audioChunks = [];
  }
  
  /**
   * Отправляет фрагмент на сервер
   * @private
   */
  private async _uploadFragment(fragment: AudioFragment): Promise<void> {
    try {
      // Создаем FormData для отправки фрагмента
      const formData = new FormData();
      formData.append('fragmentAudio', fragment.blob, `fragment-${fragment.index}.webm`);
      formData.append('fragmentIndex', String(fragment.index));
      formData.append('timestamp', String(fragment.timestamp));
      
      // Добавим идентификатор сессии, если в будущем понадобится объединять фрагменты
      const sessionId = localStorage.getItem('recordingSessionId') || 
                       `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Сохраняем ID сессии, если это первый фрагмент
      if (fragment.index === 0) {
        localStorage.setItem('recordingSessionId', sessionId);
      }
      
      formData.append('sessionId', sessionId);
      
      // Отправляем фрагмент на сервер
      const response = await fetch('/api/recording-fragments', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Ошибка отправки фрагмента: ${response.status} ${response.statusText}`);
      }
      
      console.log(`Фрагмент #${fragment.index} успешно отправлен на сервер`);
    } catch (error) {
      console.error('Ошибка отправки фрагмента:', error);
      // Сохраняем фрагмент локально, если есть поддержка IndexedDB
      if ('indexedDB' in window) {
        this._saveFragmentLocally(fragment);
      }
    }
  }
  
  /**
   * Сохраняет фрагмент локально в IndexedDB, если отправка на сервер не удалась
   * @private
   */
  private _saveFragmentLocally(fragment: AudioFragment): void {
    // Это можно реализовать позже с использованием IndexedDB
    console.log(`Сохраняем фрагмент #${fragment.index} локально для последующей отправки`);
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