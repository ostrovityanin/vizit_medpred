import { createMicrophone } from '@zos/sensor';
import { mkdir, writeFile } from '@zos/fs';
import { vibrate } from '@zos/vibrator';
import { getDeviceInfo } from '@zos/device';
import { showToast } from '@zos/interaction';
import { sendAudioFragment, generateSessionId, saveSessionInfo } from './api';

// Константы для записи
const MAX_FRAGMENT_DURATION = 30; // максимальная продолжительность фрагмента в секундах
const MAX_RECORDING_DURATION = 15 * 60; // максимальная общая продолжительность (15 минут)
const RECORDING_FOLDER = '/storage/voice_recordings';

// Создание директории для хранения записей, если она не существует
try {
  mkdir(RECORDING_FOLDER);
} catch (e) {
  // Директория может уже существовать
}

/**
 * Класс для записи аудио с микрофона часов
 */
export class AudioRecorder {
  constructor() {
    this.microphone = null;
    this.isRecording = false;
    this.sessionId = null;
    this.currentFragment = 0;
    this.totalDuration = 0;
    this.fragmentTimer = null;
    this.maxDurationTimer = null;
    this.onRecordingStatusChange = null; // callback для обновления UI
    this.fragmentPaths = [];
  }

  /**
   * Начать запись аудио
   */
  startRecording() {
    if (this.isRecording) {
      console.log('Запись уже идет');
      return;
    }

    try {
      // Вибрация для индикации начала записи
      vibrate({ mode: 'short' });
      
      // Генерация идентификатора сессии
      this.sessionId = generateSessionId();
      this.isRecording = true;
      this.currentFragment = 0;
      this.totalDuration = 0;
      this.fragmentPaths = [];
      
      // Создаем объект микрофона и начинаем запись первого фрагмента
      this.startRecordingFragment();
      
      // Установка таймера для максимальной продолжительности записи
      this.maxDurationTimer = setTimeout(() => {
        this.stopRecording('max_duration_reached');
      }, MAX_RECORDING_DURATION * 1000);
      
      // Сохраняем информацию о начале записи
      saveSessionInfo(this.sessionId, {
        startTime: Date.now(),
        deviceInfo: getDeviceInfo(),
        status: 'recording'
      });
      
      // Обновляем статус в UI
      if (this.onRecordingStatusChange) {
        this.onRecordingStatusChange({
          isRecording: true,
          duration: 0,
          sessionId: this.sessionId
        });
      }
      
      console.log('Запись начата, сессия:', this.sessionId);
      return true;
    } catch (error) {
      console.error('Ошибка при начале записи:', error);
      showToast({ content: 'Ошибка: ' + error.message });
      this.isRecording = false;
      return false;
    }
  }

  /**
   * Начать запись нового фрагмента
   */
  startRecordingFragment() {
    try {
      // Закрываем предыдущий микрофон, если он открыт
      if (this.microphone) {
        this.microphone.close();
      }
      
      const fragmentName = `fragment_${this.sessionId}_${this.currentFragment}.webm`;
      const fragmentPath = `${RECORDING_FOLDER}/${fragmentName}`;
      
      // Создаем новый микрофон
      this.microphone = createMicrophone({
        format: 'webm',
        sampleRate: 16000, // 16kHz
        channels: 1, // mono
        bitRate: 32000, // 32 kbps
        filePath: fragmentPath
      });
      
      // Добавляем путь в список фрагментов
      this.fragmentPaths.push(fragmentPath);
      
      // Запускаем микрофон
      this.microphone.start();
      
      // Устанавливаем таймер для максимальной продолжительности фрагмента
      this.fragmentTimer = setTimeout(() => {
        this.finalizeFragment();
      }, MAX_FRAGMENT_DURATION * 1000);
      
      console.log(`Начат фрагмент #${this.currentFragment}`);
    } catch (error) {
      console.error('Ошибка при записи фрагмента:', error);
      showToast({ content: 'Ошибка фрагмента: ' + error.message });
      
      // При ошибке фрагмента попробуем записать новый через 1 секунду
      setTimeout(() => {
        if (this.isRecording) {
          this.currentFragment++;
          this.startRecordingFragment();
        }
      }, 1000);
    }
  }

  /**
   * Завершить текущий фрагмент и отправить его на сервер
   */
  async finalizeFragment() {
    if (!this.isRecording || !this.microphone) {
      return;
    }
    
    try {
      // Останавливаем запись фрагмента
      this.microphone.stop();
      
      // Получаем путь к текущему фрагменту
      const fragmentPath = this.fragmentPaths[this.currentFragment];
      
      // Отправляем фрагмент на сервер асинхронно
      this.sendFragment(fragmentPath, this.currentFragment);
      
      // Увеличиваем продолжительность и индекс
      this.totalDuration += MAX_FRAGMENT_DURATION;
      this.currentFragment++;
      
      // Обновляем статус в UI
      if (this.onRecordingStatusChange) {
        this.onRecordingStatusChange({
          isRecording: true,
          duration: this.totalDuration,
          sessionId: this.sessionId,
          fragments: this.currentFragment
        });
      }
      
      // Начинаем запись следующего фрагмента, если еще идет запись
      if (this.isRecording) {
        this.startRecordingFragment();
      }
    } catch (error) {
      console.error('Ошибка при завершении фрагмента:', error);
      
      // При ошибке попробуем записать новый фрагмент
      if (this.isRecording) {
        this.currentFragment++;
        this.startRecordingFragment();
      }
    }
  }

  /**
   * Отправить фрагмент на сервер
   */
  async sendFragment(fragmentPath, index) {
    try {
      console.log(`Отправка фрагмента #${index} на сервер`);
      const result = await sendAudioFragment(fragmentPath, this.sessionId, index);
      
      if (result.error) {
        console.error(`Ошибка отправки фрагмента #${index}:`, result.error);
      } else {
        console.log(`Фрагмент #${index} успешно отправлен`);
      }
    } catch (error) {
      console.error(`Ошибка при отправке фрагмента #${index}:`, error);
    }
  }

  /**
   * Остановить запись аудио
   */
  async stopRecording(reason = 'user_stop') {
    if (!this.isRecording) {
      return;
    }
    
    try {
      // Вибрация для индикации окончания записи
      vibrate({ mode: 'long' });
      
      // Очищаем таймеры
      if (this.fragmentTimer) {
        clearTimeout(this.fragmentTimer);
        this.fragmentTimer = null;
      }
      
      if (this.maxDurationTimer) {
        clearTimeout(this.maxDurationTimer);
        this.maxDurationTimer = null;
      }
      
      // Останавливаем текущий фрагмент
      if (this.microphone) {
        this.microphone.stop();
        this.microphone.close();
        this.microphone = null;
        
        // Отправляем последний фрагмент
        const lastFragmentPath = this.fragmentPaths[this.currentFragment];
        await this.sendFragment(lastFragmentPath, this.currentFragment);
      }
      
      this.isRecording = false;
      
      // Сохраняем информацию о завершении записи
      saveSessionInfo(this.sessionId, {
        endTime: Date.now(),
        totalDuration: this.totalDuration,
        fragments: this.currentFragment + 1,
        status: 'completed',
        stopReason: reason
      });
      
      // Обновляем статус в UI
      if (this.onRecordingStatusChange) {
        this.onRecordingStatusChange({
          isRecording: false,
          duration: this.totalDuration,
          sessionId: this.sessionId,
          fragments: this.currentFragment + 1,
          status: 'completed'
        });
      }
      
      console.log('Запись остановлена, причина:', reason);
      showToast({ content: 'Запись завершена' });
      
      return {
        sessionId: this.sessionId,
        duration: this.totalDuration,
        fragments: this.currentFragment + 1
      };
    } catch (error) {
      console.error('Ошибка при остановке записи:', error);
      showToast({ content: 'Ошибка: ' + error.message });
      this.isRecording = false;
      return null;
    }
  }

  /**
   * Получить текущий статус записи
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      duration: this.totalDuration,
      sessionId: this.sessionId,
      fragments: this.currentFragment + 1
    };
  }

  /**
   * Установить обработчик изменения статуса записи
   */
  setStatusChangeListener(callback) {
    this.onRecordingStatusChange = callback;
  }
}

// Экспортируем синглтон
export const recorder = new AudioRecorder();