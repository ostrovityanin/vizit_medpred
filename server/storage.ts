import { recordings, type Recording, type InsertRecording } from "@shared/schema";
import fs from 'fs';
import path from 'path';

export interface IStorage {
  createRecording(recording: InsertRecording): Promise<Recording>;
  getRecordings(): Promise<Recording[]>;
  markRecordingAsSent(id: number): Promise<Recording | undefined>;
  getRecordingById(id: number): Promise<Recording | undefined>;
}

export class MemStorage implements IStorage {
  private recordings: Map<number, Recording>;
  private storageFile: string;
  currentId: number;

  constructor() {
    // В ES модулях __dirname не определен, используем import.meta.url
    const modulePath = new URL(import.meta.url).pathname;
    const moduleDir = path.dirname(modulePath);
    this.storageFile = path.join(moduleDir, 'recordings.json');
    
    this.recordings = new Map();
    this.currentId = 1;
    
    // Загружаем данные из файла при инициализации
    this.loadFromFile();
  }
  
  // Сохраняем данные в файл
  private saveToFile(): void {
    try {
      // Преобразуем Map в массив для сохранения
      const data = {
        recordings: Array.from(this.recordings.values()),
        currentId: this.currentId
      };
      
      fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2));
      console.log('[storage] Данные успешно сохранены в файл');
    } catch (error) {
      console.error('[storage] Ошибка при сохранении данных:', error);
    }
  }
  
  // Загружаем данные из файла
  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.storageFile)) {
        const data = JSON.parse(fs.readFileSync(this.storageFile, 'utf8'));
        
        // Восстанавливаем Map из массива
        if (data.recordings && Array.isArray(data.recordings)) {
          this.recordings = new Map();
          data.recordings.forEach((recording: Recording) => {
            this.recordings.set(recording.id, recording);
          });
        }
        
        // Восстанавливаем текущий ID
        if (data.currentId) {
          this.currentId = data.currentId;
        }
        
        console.log(`[storage] Загружено ${this.recordings.size} записей из файла`);
      } else {
        console.log('[storage] Файл хранилища не найден, используем пустое хранилище');
      }
    } catch (error) {
      console.error('[storage] Ошибка при загрузке данных:', error);
    }
  }

  async createRecording(insertRecording: InsertRecording): Promise<Recording> {
    const id = this.currentId++;
    const recording: Recording = { 
      ...insertRecording, 
      id, 
      sent: false,
      senderUsername: insertRecording.senderUsername || null,
      fileSize: insertRecording.fileSize || null,
      transcription: insertRecording.transcription || null
    };
    this.recordings.set(id, recording);
    this.saveToFile(); // Сохраняем данные после добавления новой записи
    return recording;
  }

  async getRecordings(): Promise<Recording[]> {
    return Array.from(this.recordings.values());
  }

  async markRecordingAsSent(id: number): Promise<Recording | undefined> {
    const recording = this.recordings.get(id);
    if (recording) {
      const updatedRecording = { ...recording, sent: true };
      this.recordings.set(id, updatedRecording);
      this.saveToFile(); // Сохраняем данные после обновления записи
      return updatedRecording;
    }
    return undefined;
  }

  async getRecordingById(id: number): Promise<Recording | undefined> {
    return this.recordings.get(id);
  }
}

export const storage = new MemStorage();
