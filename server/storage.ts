import { 
  adminRecordings, userRecordings, recordingFragments,
  type AdminRecording, type UserRecording, type RecordingFragment,
  type InsertAdminRecording, type InsertUserRecording, type InsertRecordingFragment
} from "@shared/schema";
import fs from 'fs';
import path from 'path';

export interface IStorage {
  // Методы для админских записей
  createAdminRecording(recording: InsertAdminRecording): Promise<AdminRecording>;
  getAdminRecordings(): Promise<AdminRecording[]>;
  markAdminRecordingAsSent(id: number): Promise<AdminRecording | undefined>;
  getAdminRecordingById(id: number): Promise<AdminRecording | undefined>;
  updateAdminRecordingStatus(id: number, status: string): Promise<AdminRecording | undefined>;
  updateAdminRecording(recording: AdminRecording): Promise<AdminRecording | undefined>;
  
  // Методы для пользовательских записей
  createUserRecording(recording: InsertUserRecording): Promise<UserRecording>;
  getUserRecordings(username: string): Promise<UserRecording[]>;
  getUserRecordingById(id: number): Promise<UserRecording | undefined>;
  markUserRecordingAsSent(id: number): Promise<UserRecording | undefined>;
  
  // Методы для фрагментов записей
  createRecordingFragment(fragment: InsertRecordingFragment): Promise<RecordingFragment>;
  getRecordingFragments(recordingId: number): Promise<RecordingFragment[]>;
  getFragmentsBySessionId(sessionId: string): Promise<RecordingFragment[]>;
  markFragmentAsProcessed(id: number): Promise<RecordingFragment | undefined>;
  getFragmentById(id: number): Promise<RecordingFragment | undefined>;
  updateFragment(id: number, fragment: RecordingFragment): Promise<RecordingFragment | undefined>;
  
  // Поддержка обратной совместимости
  createRecording(recording: InsertAdminRecording): Promise<AdminRecording>;
  getRecordings(): Promise<AdminRecording[]>;
  markRecordingAsSent(id: number): Promise<AdminRecording | undefined>;
  getRecordingById(id: number): Promise<AdminRecording | undefined>;
  updateRecordingStatus(id: number, status: string): Promise<AdminRecording | undefined>;
  updateRecording(recording: AdminRecording): Promise<AdminRecording | undefined>;
}

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
    // В ES модулях __dirname не определен, используем import.meta.url
    const modulePath = new URL(import.meta.url).pathname;
    const moduleDir = path.dirname(modulePath);
    this.adminStorageFile = path.join(moduleDir, 'admin_recordings.json');
    this.userStorageFile = path.join(moduleDir, 'user_recordings.json');
    this.fragmentsStorageFile = path.join(moduleDir, 'recording_fragments.json');
    
    this.adminRecordings = new Map();
    this.userRecordings = new Map();
    this.recordingFragments = new Map();
    this.adminCurrentId = 1;
    this.userCurrentId = 1;
    this.fragmentCurrentId = 1;
    
    // Загружаем данные из файлов при инициализации
    this.loadFromFiles();
  }
  
  // Сохраняем данные админки в файл
  private saveAdminToFile(): void {
    try {
      // Преобразуем Map в массив для сохранения
      const data = {
        recordings: Array.from(this.adminRecordings.values()),
        currentId: this.adminCurrentId
      };
      
      fs.writeFileSync(this.adminStorageFile, JSON.stringify(data, null, 2));
      console.log('[storage] Данные админки успешно сохранены в файл');
    } catch (error) {
      console.error('[storage] Ошибка при сохранении данных админки:', error);
    }
  }
  
  // Сохраняем данные пользователей в файл
  private saveUserToFile(): void {
    try {
      // Преобразуем Map в массив для сохранения
      const data = {
        recordings: Array.from(this.userRecordings.values()),
        currentId: this.userCurrentId
      };
      
      fs.writeFileSync(this.userStorageFile, JSON.stringify(data, null, 2));
      console.log('[storage] Данные пользователей успешно сохранены в файл');
    } catch (error) {
      console.error('[storage] Ошибка при сохранении данных пользователей:', error);
    }
  }
  
  // Сохраняем данные фрагментов записей в файл
  private saveFragmentsToFile(): void {
    try {
      // Преобразуем Map в массив для сохранения
      const data = {
        fragments: Array.from(this.recordingFragments.values()),
        currentId: this.fragmentCurrentId
      };
      
      fs.writeFileSync(this.fragmentsStorageFile, JSON.stringify(data, null, 2));
      console.log('[storage] Данные фрагментов записей успешно сохранены в файл');
    } catch (error) {
      console.error('[storage] Ошибка при сохранении данных фрагментов записей:', error);
    }
  }
  
  // Загружаем данные из файлов
  private loadFromFiles(): void {
    // Загружаем данные админки
    try {
      if (fs.existsSync(this.adminStorageFile)) {
        const data = JSON.parse(fs.readFileSync(this.adminStorageFile, 'utf8'));
        
        // Восстанавливаем Map из массива
        if (data.recordings && Array.isArray(data.recordings)) {
          this.adminRecordings = new Map();
          data.recordings.forEach((recording: AdminRecording) => {
            this.adminRecordings.set(recording.id, recording);
          });
        }
        
        // Восстанавливаем текущий ID
        if (data.currentId) {
          this.adminCurrentId = data.currentId;
        }
        
        console.log(`[storage] Загружено ${this.adminRecordings.size} записей админки из файла`);
      } else {
        console.log('[storage] Файл хранилища админки не найден, используем пустое хранилище');
        
        // Для обратной совместимости проверим наличие старого файла
        const oldStorageFile = path.join(path.dirname(this.adminStorageFile), 'recordings.json');
        if (fs.existsSync(oldStorageFile)) {
          console.log('[storage] Найден старый файл с записями, мигрируем данные');
          const oldData = JSON.parse(fs.readFileSync(oldStorageFile, 'utf8'));
          
          if (oldData.recordings && Array.isArray(oldData.recordings)) {
            this.adminRecordings = new Map();
            oldData.recordings.forEach((recording: any) => {
              this.adminRecordings.set(recording.id, recording);
            });
            
            if (oldData.currentId) {
              this.adminCurrentId = oldData.currentId;
            }
            
            // Сохраняем мигрированные данные в новый файл
            this.saveAdminToFile();
            console.log(`[storage] Мигрировано ${this.adminRecordings.size} записей из старого файла`);
          }
        }
      }
    } catch (error) {
      console.error('[storage] Ошибка при загрузке данных админки:', error);
    }
    
    // Загружаем данные пользователей
    try {
      if (fs.existsSync(this.userStorageFile)) {
        const data = JSON.parse(fs.readFileSync(this.userStorageFile, 'utf8'));
        
        // Восстанавливаем Map из массива
        if (data.recordings && Array.isArray(data.recordings)) {
          this.userRecordings = new Map();
          data.recordings.forEach((recording: UserRecording) => {
            this.userRecordings.set(recording.id, recording);
          });
        }
        
        // Восстанавливаем текущий ID
        if (data.currentId) {
          this.userCurrentId = data.currentId;
        }
        
        console.log(`[storage] Загружено ${this.userRecordings.size} записей пользователей из файла`);
      } else {
        console.log('[storage] Файл хранилища пользователей не найден, используем пустое хранилище');
      }
    } catch (error) {
      console.error('[storage] Ошибка при загрузке данных пользователей:', error);
    }
    
    // Загружаем данные фрагментов записей
    try {
      if (fs.existsSync(this.fragmentsStorageFile)) {
        const data = JSON.parse(fs.readFileSync(this.fragmentsStorageFile, 'utf8'));
        
        // Восстанавливаем Map из массива
        if (data.fragments && Array.isArray(data.fragments)) {
          this.recordingFragments = new Map();
          data.fragments.forEach((fragment: RecordingFragment) => {
            this.recordingFragments.set(fragment.id, fragment);
          });
        }
        
        // Восстанавливаем текущий ID
        if (data.currentId) {
          this.fragmentCurrentId = data.currentId;
        }
        
        console.log(`[storage] Загружено ${this.recordingFragments.size} фрагментов записей из файла`);
      } else {
        console.log('[storage] Файл хранилища фрагментов не найден, используем пустое хранилище');
      }
    } catch (error) {
      console.error('[storage] Ошибка при загрузке данных фрагментов:', error);
    }
  }

  // === Методы для админских записей ===
  
  async createAdminRecording(insertRecording: InsertAdminRecording): Promise<AdminRecording> {
    const id = this.adminCurrentId++;
    const recording: AdminRecording = { 
      ...insertRecording, 
      id, 
      sent: false,
      filename: insertRecording.filename || null,
      senderUsername: insertRecording.senderUsername || null,
      fileSize: insertRecording.fileSize || null,
      transcription: insertRecording.transcription || null,
      transcriptionCost: insertRecording.transcriptionCost || null,
      tokensProcessed: insertRecording.tokensProcessed || null,
      status: insertRecording.status || 'started'
    };
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
      const updatedRecording = { ...recording, sent: true };
      this.adminRecordings.set(id, updatedRecording);
      this.saveAdminToFile();
      return updatedRecording;
    }
    return undefined;
  }

  async getAdminRecordingById(id: number): Promise<AdminRecording | undefined> {
    return this.adminRecordings.get(id);
  }
  
  async updateAdminRecordingStatus(id: number, status: string): Promise<AdminRecording | undefined> {
    const recording = this.adminRecordings.get(id);
    if (recording) {
      const updatedRecording = { ...recording, status };
      this.adminRecordings.set(id, updatedRecording);
      this.saveAdminToFile();
      return updatedRecording;
    }
    return undefined;
  }
  
  // === Методы для пользовательских записей ===
  
  async createUserRecording(insertRecording: InsertUserRecording): Promise<UserRecording> {
    const id = this.userCurrentId++;
    const recording: UserRecording = { 
      ...insertRecording, 
      id, 
      sent: false,
      adminRecordingId: insertRecording.adminRecordingId || null
    };
    this.userRecordings.set(id, recording);
    this.saveUserToFile();
    return recording;
  }
  
  async getUserRecordings(username: string): Promise<UserRecording[]> {
    const cleanUsername = username.replace(/^@/, '').toLowerCase();
    return Array.from(this.userRecordings.values())
      .filter(record => record.username.replace(/^@/, '').toLowerCase() === cleanUsername);
  }
  
  async getUserRecordingById(id: number): Promise<UserRecording | undefined> {
    return this.userRecordings.get(id);
  }
  
  async markUserRecordingAsSent(id: number): Promise<UserRecording | undefined> {
    const recording = this.userRecordings.get(id);
    if (recording) {
      const updatedRecording = { ...recording, sent: true };
      this.userRecordings.set(id, updatedRecording);
      this.saveUserToFile();
      return updatedRecording;
    }
    return undefined;
  }
  
  // === Методы для фрагментов записей ===
  
  async createRecordingFragment(insertFragment: InsertRecordingFragment): Promise<RecordingFragment> {
    const id = this.fragmentCurrentId++;
    const fragment: RecordingFragment = {
      ...insertFragment,
      id,
      isProcessed: insertFragment.isProcessed || false
    };
    this.recordingFragments.set(id, fragment);
    this.saveFragmentsToFile();
    return fragment;
  }
  
  async getRecordingFragments(recordingId: number): Promise<RecordingFragment[]> {
    return Array.from(this.recordingFragments.values())
      .filter(fragment => fragment.recordingId === recordingId)
      .sort((a, b) => a.index - b.index); // Сортируем по порядковому номеру
  }
  
  async getFragmentsBySessionId(sessionId: string): Promise<RecordingFragment[]> {
    return Array.from(this.recordingFragments.values())
      .filter(fragment => fragment.sessionId === sessionId)
      .sort((a, b) => a.index - b.index); // Сортируем по порядковому номеру
  }
  
  async markFragmentAsProcessed(id: number): Promise<RecordingFragment | undefined> {
    const fragment = this.recordingFragments.get(id);
    if (fragment) {
      const updatedFragment = { ...fragment, isProcessed: true };
      this.recordingFragments.set(id, updatedFragment);
      this.saveFragmentsToFile();
      return updatedFragment;
    }
    return undefined;
  }
  
  async getFragmentById(id: number): Promise<RecordingFragment | undefined> {
    return this.recordingFragments.get(id);
  }
  
  async updateFragment(id: number, fragment: RecordingFragment): Promise<RecordingFragment | undefined> {
    if (this.recordingFragments.has(id)) {
      this.recordingFragments.set(id, fragment);
      this.saveFragmentsToFile();
      return fragment;
    }
    return undefined;
  }
  
  async getAllFragments(): Promise<RecordingFragment[]> {
    return Array.from(this.recordingFragments.values());
  }
  
  // === Методы для обратной совместимости ===
  
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
    if (recording && recording.id && this.adminRecordings.has(recording.id)) {
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

export const storage = new MemStorage();
