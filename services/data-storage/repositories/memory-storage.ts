import { AdminRecording, InsertAdminRecording, InsertRecordingFragment, InsertUserRecording, RecordingFragment, UserRecording } from "../models/schema";
import { IStorage } from "./storage-interface";
import fs from 'fs-extra';
import path from 'path';

/**
 * Хранилище данных в памяти с сохранением на диск
 */
export class MemStorage implements IStorage {
  private adminRecordings: Map<number, AdminRecording>;
  private userRecordings: Map<number, UserRecording>;
  private recordingFragments: Map<number, RecordingFragment>;
  private adminStorageFile: string;
  private userStorageFile: string;
  private fragmentsStorageFile: string;
  adminCurrentId: number;
  userCurrentId: number;
  fragmentCurrentId: number;
  
  constructor() {
    this.adminRecordings = new Map<number, AdminRecording>();
    this.userRecordings = new Map<number, UserRecording>();
    this.recordingFragments = new Map<number, RecordingFragment>();
    
    // Создаем директорию для хранения данных, если ее нет
    const dataDir = path.join(process.cwd(), 'data');
    fs.ensureDirSync(dataDir);
    
    this.adminStorageFile = path.join(dataDir, 'admin-recordings.json');
    this.userStorageFile = path.join(dataDir, 'user-recordings.json');
    this.fragmentsStorageFile = path.join(dataDir, 'recording-fragments.json');
    this.adminCurrentId = 1;
    this.userCurrentId = 1;
    this.fragmentCurrentId = 1;
    
    this.loadFromFiles();
  }

  /**
   * Сохраняет админские записи в файл
   */
  private saveAdminToFile(): void {
    const data = {
      recordings: Array.from(this.adminRecordings.values())
    };
    fs.writeJsonSync(this.adminStorageFile, data, { spaces: 2 });
  }
  
  /**
   * Сохраняет пользовательские записи в файл
   */
  private saveUserToFile(): void {
    const data = {
      recordings: Array.from(this.userRecordings.values())
    };
    fs.writeJsonSync(this.userStorageFile, data, { spaces: 2 });
  }
  
  /**
   * Сохраняет фрагменты записей в файл
   */
  private saveFragmentsToFile(): void {
    const data = {
      fragments: Array.from(this.recordingFragments.values())
    };
    fs.writeJsonSync(this.fragmentsStorageFile, data, { spaces: 2 });
  }
  
  /**
   * Загружает данные из файлов
   */
  private loadFromFiles(): void {
    try {
      if (fs.existsSync(this.adminStorageFile)) {
        const data = fs.readJsonSync(this.adminStorageFile);
        if (data && data.recordings && Array.isArray(data.recordings)) {
          data.recordings.forEach((recording: AdminRecording) => {
            this.adminRecordings.set(recording.id, recording);
            if (recording.id >= this.adminCurrentId) {
              this.adminCurrentId = recording.id + 1;
            }
          });
        }
      }
      
      if (fs.existsSync(this.userStorageFile)) {
        const data = fs.readJsonSync(this.userStorageFile);
        if (data && data.recordings && Array.isArray(data.recordings)) {
          data.recordings.forEach((recording: UserRecording) => {
            this.userRecordings.set(recording.id, recording);
            if (recording.id >= this.userCurrentId) {
              this.userCurrentId = recording.id + 1;
            }
          });
        }
      }
      
      if (fs.existsSync(this.fragmentsStorageFile)) {
        const data = fs.readJsonSync(this.fragmentsStorageFile);
        if (data && data.fragments && Array.isArray(data.fragments)) {
          data.fragments.forEach((fragment: RecordingFragment) => {
            this.recordingFragments.set(fragment.id, fragment);
            if (fragment.id >= this.fragmentCurrentId) {
              this.fragmentCurrentId = fragment.id + 1;
            }
          });
        }
      }
    } catch (error) {
      console.error('Error loading data from files:', error);
    }
  }

  // Методы для админских записей
  async createAdminRecording(insertRecording: InsertAdminRecording): Promise<AdminRecording> {
    const id = this.adminCurrentId++;
    const now = new Date();
    
    const recording: AdminRecording = { 
      ...insertRecording,
      id,
      createdAt: now,
      updatedAt: now,
      sentAt: null
    } as AdminRecording;
    
    this.adminRecordings.set(id, recording);
    this.saveAdminToFile();
    return recording;
  }
  
  async getAdminRecordings(): Promise<AdminRecording[]> {
    return Array.from(this.adminRecordings.values());
  }
  
  async markAdminRecordingAsSent(id: number): Promise<AdminRecording | undefined> {
    const recording = this.adminRecordings.get(id);
    if (recording) {
      recording.sentAt = new Date();
      this.saveAdminToFile();
    }
    return recording;
  }
  
  async getAdminRecordingById(id: number): Promise<AdminRecording | undefined> {
    return this.adminRecordings.get(id);
  }
  
  async updateAdminRecordingStatus(id: number, status: string): Promise<AdminRecording | undefined> {
    const recording = this.adminRecordings.get(id);
    if (recording) {
      recording.status = status;
      recording.updatedAt = new Date();
      this.saveAdminToFile();
    }
    return recording;
  }
  
  // Методы для пользовательских записей
  async createUserRecording(insertRecording: InsertUserRecording): Promise<UserRecording> {
    const id = this.userCurrentId++;
    const now = new Date();
    
    const recording: UserRecording = { 
      ...insertRecording,
      id,
      createdAt: now,
      updatedAt: now,
      sentAt: null
    } as UserRecording;
    
    this.userRecordings.set(id, recording);
    this.saveUserToFile();
    return recording;
  }
  
  async getUserRecordings(username: string): Promise<UserRecording[]> {
    return Array.from(this.userRecordings.values())
      .filter(recording => recording.username === username);
  }
  
  async getUserRecordingById(id: number): Promise<UserRecording | undefined> {
    return this.userRecordings.get(id);
  }
  
  async markUserRecordingAsSent(id: number): Promise<UserRecording | undefined> {
    const recording = this.userRecordings.get(id);
    if (recording) {
      recording.sentAt = new Date();
      this.saveUserToFile();
    }
    return recording;
  }
  
  // Методы для фрагментов записей
  async createRecordingFragment(insertFragment: InsertRecordingFragment): Promise<RecordingFragment> {
    const id = this.fragmentCurrentId++;
    
    const fragment: RecordingFragment = {
      ...insertFragment,
      id,
      timestamp: new Date(),
      processed: false
    } as RecordingFragment;
    
    this.recordingFragments.set(id, fragment);
    this.saveFragmentsToFile();
    return fragment;
  }
  
  async getRecordingFragments(recordingId: number): Promise<RecordingFragment[]> {
    return Array.from(this.recordingFragments.values())
      .filter(fragment => fragment.recordingId === recordingId)
      .sort((a, b) => a.index - b.index);
  }
  
  async getFragmentsBySessionId(sessionId: string): Promise<RecordingFragment[]> {
    return Array.from(this.recordingFragments.values())
      .filter(fragment => fragment.sessionId === sessionId)
      .sort((a, b) => a.index - b.index);
  }
  
  async markFragmentAsProcessed(id: number): Promise<RecordingFragment | undefined> {
    const fragment = this.recordingFragments.get(id);
    if (fragment) {
      fragment.processed = true;
      this.saveFragmentsToFile();
    }
    return fragment;
  }
  
  // Поддержка обратной совместимости
  async createRecording(recording: InsertAdminRecording): Promise<AdminRecording> {
    return this.createAdminRecording(recording);
  }
  
  async getRecordings(): Promise<AdminRecording[]> {
    return this.getAdminRecordings();
  }
  
  async markRecordingAsSent(id: number): Promise<AdminRecording | undefined> {
    return this.markAdminRecordingAsSent(id);
  }
  
  async getRecordingById(id: number): Promise<AdminRecording | undefined> {
    return this.getAdminRecordingById(id);
  }
  
  async updateRecordingStatus(id: number, status: string): Promise<AdminRecording | undefined> {
    return this.updateAdminRecordingStatus(id, status);
  }
  
  async updateAdminRecording(recording: AdminRecording): Promise<AdminRecording | undefined> {
    if (recording.id && this.adminRecordings.has(recording.id)) {
      recording.updatedAt = new Date();
      this.adminRecordings.set(recording.id, recording);
      this.saveAdminToFile();
      return recording;
    }
    return undefined;
  }
  
  async updateRecording(recording: AdminRecording): Promise<AdminRecording | undefined> {
    return this.updateAdminRecording(recording);
  }
}

// Экспортируем экземпляр хранилища
export const memoryStorage = new MemStorage();