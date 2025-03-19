import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Логирование событий для отслеживания цикла жизни записи
 */
export class EventLogger {
  private logFile: string;
  
  constructor() {
    this.logFile = path.join(__dirname, 'recording_events.log');
    // Проверяем существование файла логов, создаем если не существует
    if (!fs.existsSync(this.logFile)) {
      fs.writeFileSync(this.logFile, '', 'utf8');
    }
  }
  
  /**
   * Логирует событие с пользователем и действием
   */
  public logEvent(username: string, action: string, details: any = {}): void {
    try {
      const timestamp = new Date().toISOString();
      const detailsStr = JSON.stringify(details);
      const logEntry = `[${timestamp}] ${username}: ${action} - ${detailsStr}\n`;
      
      // Добавляем запись в лог файл
      fs.appendFileSync(this.logFile, logEntry, 'utf8');
      console.log(`[Event] ${username}: ${action}`);
    } catch (error) {
      console.error('Ошибка при логировании события:', error);
    }
  }
  
  /**
   * Логирует начало записи для пользователя
   */
  public logRecordingStart(username: string): void {
    this.logEvent(username, 'RECORDING_STARTED');
  }
  
  /**
   * Логирует завершение записи с продолжительностью и размером файла
   */
  public logRecordingEnd(username: string, duration: number, fileSize: number = 0): void {
    this.logEvent(username, 'RECORDING_ENDED', { 
      duration,
      fileSize,
      formattedDuration: this.formatDuration(duration)
    });
  }
  
  /**
   * Логирует отправку записи пользователю
   */
  public logRecordingSent(username: string, targetUsername: string, recordingId: number): void {
    this.logEvent(username, 'RECORDING_SENT', {
      targetUsername,
      recordingId
    });
  }
  
  /**
   * Логирует ошибку в процессе записи
   */
  public logRecordingError(username: string, error: string): void {
    this.logEvent(username, 'RECORDING_ERROR', { error });
  }
  
  /**
   * Форматирует продолжительность в секундах в формат MM:SS
   */
  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  /**
   * Возвращает все события из лог-файла
   */
  public getAllEvents(): string[] {
    try {
      const content = fs.readFileSync(this.logFile, 'utf8');
      return content.split('\n').filter(line => line.trim() !== '');
    } catch (error) {
      console.error('Ошибка при чтении лог-файла:', error);
      return [];
    }
  }
  
  /**
   * Возвращает события для конкретного пользователя
   */
  public getUserEvents(username: string): string[] {
    return this.getAllEvents().filter(event => event.includes(`] ${username}:`));
  }
}

// Экспортируем экземпляр логгера для использования в приложении
export const eventLogger = new EventLogger();