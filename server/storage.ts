import { recordings, type Recording, type InsertRecording } from "@shared/schema";

export interface IStorage {
  createRecording(recording: InsertRecording): Promise<Recording>;
  getRecordings(): Promise<Recording[]>;
  markRecordingAsSent(id: number): Promise<Recording | undefined>;
  getRecordingById(id: number): Promise<Recording | undefined>;
}

export class MemStorage implements IStorage {
  private recordings: Map<number, Recording>;
  currentId: number;

  constructor() {
    this.recordings = new Map();
    this.currentId = 1;
  }

  async createRecording(insertRecording: InsertRecording): Promise<Recording> {
    const id = this.currentId++;
    const recording: Recording = { 
      ...insertRecording, 
      id, 
      sent: false,
      senderUsername: insertRecording.senderUsername || null 
    };
    this.recordings.set(id, recording);
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
      return updatedRecording;
    }
    return undefined;
  }

  async getRecordingById(id: number): Promise<Recording | undefined> {
    return this.recordings.get(id);
  }
}

export const storage = new MemStorage();
