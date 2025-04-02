import { AdminRecording, InsertAdminRecording, InsertRecordingFragment, InsertUserRecording, RecordingFragment, UserRecording } from "../models/schema";

/**
 * Интерфейс хранилища данных
 */
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
  
  // Поддержка обратной совместимости
  createRecording(recording: InsertAdminRecording): Promise<AdminRecording>;
  getRecordings(): Promise<AdminRecording[]>;
  markRecordingAsSent(id: number): Promise<AdminRecording | undefined>;
  getRecordingById(id: number): Promise<AdminRecording | undefined>;
  updateRecordingStatus(id: number, status: string): Promise<AdminRecording | undefined>;
  updateRecording(recording: AdminRecording): Promise<AdminRecording | undefined>;
}