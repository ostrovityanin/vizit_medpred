import { createMicrophone } from '@zos/sensor';
import { mkdir, writeFile, rmdir } from '@zos/fs';
import { vibrate } from '@zos/vibrator';
import { getDeviceInfo } from '@zos/device';
import { showToast } from '@zos/interaction';
import { sendAudioFragment, finishRecording, generateSessionId, saveSessionInfo } from './api';

// Константы для записи
const MAX_FRAGMENT_DURATION = 30; // максимальная продолжительность фрагмента в секундах
const MAX_RECORDING_DURATION = 10 * 60; // максимальная общая продолжительность (10 минут)
const RECORDING_FOLDER = '/storage/voice_recordings';
const SEND_RETRY_COUNT = 3; // количество попыток отправки файла
const SEND_RETRY_DELAY = 1000; // задержка между попытками в миллисекундах

// Создание директории для хранения записей, если она не существует
try {
  mkdir(RECORDING_FOLDER);
  console.log('Создана директория для записей:', RECORDING_FOLDER);
} catch (e) {
  console.log('Директория для записей уже существует');
}

// Очистка старых файлов при запуске
try {
  console.log('Очистка старых файлов записей...');
  // В реальном приложении здесь будет код для удаления старых файлов
} catch (e) {
  console.error('Ошибка при очистке старых файлов:', e);
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
      console.log(`Завершение фрагмента #${this.currentFragment}`);
      
      // Останавливаем запись фрагмента
      this.microphone.stop();
      
      // Получаем путь к текущему фрагменту
      const fragmentPath = this.fragmentPaths[this.currentFragment];
      
      // Обновляем статус пока идет отправка
      if (this.onRecordingStatusChange) {
        this.onRecordingStatusChange({
          isRecording: true,
          duration: this.totalDuration + MAX_FRAGMENT_DURATION,
          sessionId: this.sessionId,
          fragments: this.currentFragment + 1,
          status: 'sending'
        });
      }
      
      // Отправляем фрагмент на сервер с повторными попытками
      const sendResult = await this.sendFragment(fragmentPath, this.currentFragment);
      
      // Увеличиваем продолжительность и индекс
      this.totalDuration += MAX_FRAGMENT_DURATION;
      this.currentFragment++;
      
      // Обновляем статус в UI после отправки
      if (this.onRecordingStatusChange) {
        this.onRecordingStatusChange({
          isRecording: true,
          duration: this.totalDuration,
          sessionId: this.sessionId,
          fragments: this.currentFragment,
          status: sendResult ? 'recording' : 'error_sending'
        });
      }
      
      // Начинаем запись следующего фрагмента, если еще идет запись
      if (this.isRecording) {
        console.log(`Начинаем следующий фрагмент #${this.currentFragment}`);
        this.startRecordingFragment();
      }
    } catch (error) {
      console.error('Ошибка при завершении фрагмента:', error);
      
      // Информируем пользователя об ошибке
      showToast({ content: 'Ошибка при сохранении фрагмента' });
      
      // Увеличиваем продолжительность на основе существующих фрагментов
      this.totalDuration += MAX_FRAGMENT_DURATION;
      
      // Обновляем статус с ошибкой
      if (this.onRecordingStatusChange) {
        this.onRecordingStatusChange({
          isRecording: true,
          duration: this.totalDuration,
          sessionId: this.sessionId,
          fragments: this.currentFragment + 1,
          status: 'error_fragment'
        });
      }
      
      // При ошибке попробуем записать новый фрагмент
      if (this.isRecording) {
        this.currentFragment++;
        console.log(`Пытаемся начать новый фрагмент #${this.currentFragment} после ошибки`);
        this.startRecordingFragment();
      }
    }
  }

  /**
   * Отправить фрагмент на сервер с поддержкой повторных попыток
   * @param {string} fragmentPath - Путь к файлу фрагмента
   * @param {number} index - Индекс фрагмента
   * @param {number} retryCount - Текущее количество попыток (начинается с 0)
   * @returns {Promise<boolean>} - Успешно ли отправлен фрагмент
   */
  async sendFragment(fragmentPath, index, retryCount = 0) {
    try {
      console.log(`Отправка фрагмента #${index} на сервер (попытка ${retryCount + 1}/${SEND_RETRY_COUNT + 1})`);
      
      // Отправляем фрагмент
      const result = await sendAudioFragment(fragmentPath, this.sessionId, index);
      
      if (result.error) {
        console.error(`Ошибка отправки фрагмента #${index}:`, result.error);
        
        // Если есть возможность повторить попытку
        if (retryCount < SEND_RETRY_COUNT) {
          console.log(`Повторная попытка отправки фрагмента #${index} через ${SEND_RETRY_DELAY}мс...`);
          
          // Ждем указанную задержку
          await new Promise(resolve => setTimeout(resolve, SEND_RETRY_DELAY));
          
          // Рекурсивно повторяем попытку с увеличенным счетчиком
          return this.sendFragment(fragmentPath, index, retryCount + 1);
        } else {
          console.error(`Исчерпаны попытки отправки фрагмента #${index}`);
          return false;
        }
      } else {
        console.log(`Фрагмент #${index} успешно отправлен`);
        return true;
      }
    } catch (error) {
      console.error(`Ошибка при отправке фрагмента #${index}:`, error);
      
      // Аналогично повторяем попытку при исключении
      if (retryCount < SEND_RETRY_COUNT) {
        console.log(`Повторная попытка отправки фрагмента #${index} после ошибки...`);
        await new Promise(resolve => setTimeout(resolve, SEND_RETRY_DELAY));
        return this.sendFragment(fragmentPath, index, retryCount + 1);
      } else {
        console.error(`Исчерпаны попытки отправки фрагмента #${index} после ошибки`);
        return false;
      }
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
      
      // Останавливаем текущий фрагмент и освобождаем ресурсы
      if (this.microphone) {
        console.log('Останавливаем запись микрофона...');
        this.microphone.stop();
        this.microphone.close();
        this.microphone = null;
        
        // Отправляем последний фрагмент, если он есть
        if (this.fragmentPaths[this.currentFragment]) {
          const lastFragmentPath = this.fragmentPaths[this.currentFragment];
          console.log(`Отправляем последний фрагмент #${this.currentFragment}...`);
          await this.sendFragment(lastFragmentPath, this.currentFragment);
        }
      }
      
      this.isRecording = false;
      
      // Сохраняем информацию о завершении записи
      const recordingInfo = {
        endTime: Date.now(),
        totalDuration: this.totalDuration,
        fragments: this.currentFragment + 1,
        status: 'completed',
        stopReason: reason
      };
      
      saveSessionInfo(this.sessionId, recordingInfo);
      console.log('Сохранена информация о записи:', recordingInfo);
      
      // Уведомляем сервер о завершении записи
      console.log('Уведомляем сервер о завершении записи...');
      const finalizeResult = await finishRecording(
        this.sessionId, 
        this.totalDuration, 
        this.currentFragment + 1
      );
      
      if (finalizeResult.error) {
        console.error('Ошибка финализации записи на сервере:', finalizeResult.error);
        showToast({ content: 'Ошибка отправки на сервер' });
      } else {
        console.log('Запись успешно финализирована на сервере:', finalizeResult);
        if (finalizeResult.recording && finalizeResult.recording.id) {
          console.log(`Создана запись #${finalizeResult.recording.id} на сервере`);
        }
      }
      
      // Обновляем статус в UI
      if (this.onRecordingStatusChange) {
        this.onRecordingStatusChange({
          isRecording: false,
          duration: this.totalDuration,
          sessionId: this.sessionId,
          fragments: this.currentFragment + 1,
          status: finalizeResult.error ? 'error' : 'completed',
          recordingId: finalizeResult.recording ? finalizeResult.recording.id : null
        });
      }
      
      console.log('Запись остановлена, причина:', reason);
      showToast({ 
        content: finalizeResult.error 
          ? 'Запись сохранена локально' 
          : 'Запись отправлена на сервер'
      });
      
      return {
        sessionId: this.sessionId,
        duration: this.totalDuration,
        fragments: this.currentFragment + 1,
        recordingId: finalizeResult.recording ? finalizeResult.recording.id : null
      };
    } catch (error) {
      console.error('Ошибка при остановке записи:', error);
      showToast({ content: 'Ошибка: ' + (error.message || 'неизвестная ошибка') });
      this.isRecording = false;
      
      // Обновляем статус в UI на ошибку
      if (this.onRecordingStatusChange) {
        this.onRecordingStatusChange({
          isRecording: false,
          duration: this.totalDuration,
          sessionId: this.sessionId,
          fragments: this.currentFragment + 1,
          status: 'error'
        });
      }
      
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