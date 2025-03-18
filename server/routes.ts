import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRecordingSchema } from "@shared/schema";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { resolveTelegramUsername, sendAudioToTelegram } from './telegram';
import { sendAudioToEmail } from './email';
import { log } from './vite';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Setup multer storage for audio files
const storageConfig = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "uploads");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  }
});

const upload = multer({ 
  storage: storageConfig,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an audio file'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  app.post('/api/recordings', upload.single('audio'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No audio file uploaded' });
      }

      const recordingData = req.body;
      
      try {
        const validData = insertRecordingSchema.parse({
          filename: req.file.filename,
          duration: parseInt(recordingData.duration, 10),
          timestamp: recordingData.timestamp,
          targetUsername: recordingData.targetUsername
        });

        const recording = await storage.createRecording(validData);
        res.status(201).json(recording);
      } catch (error) {
        res.status(400).json({ message: 'Invalid recording data', error });
      }
    } catch (error) {
      res.status(500).json({ message: 'Failed to upload recording', error });
    }
  });

  app.get('/api/recordings', async (req: Request, res: Response) => {
    try {
      const recordings = await storage.getRecordings();
      res.json(recordings);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch recordings', error });
    }
  });

  app.get('/api/recordings/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const recording = await storage.getRecordingById(id);
      
      if (!recording) {
        return res.status(404).json({ message: 'Recording not found' });
      }
      
      res.json(recording);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch recording', error });
    }
  });

  app.post('/api/recordings/:id/send', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const recording = await storage.getRecordingById(id);
      
      if (!recording) {
        return res.status(404).json({ message: 'Recording not found' });
      }
      
      // Полный путь к аудиофайлу
      const filePath = path.join(__dirname, 'uploads', recording.filename);
      
      // Проверка существования файла
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Audio file not found on server' });
      }

      // Просто помечаем запись как отправленную и возвращаем путь к файлу для скачивания
      const updatedRecording = await storage.markRecordingAsSent(id);
      
      res.json({
        ...updatedRecording,
        message: 'Запись доступна для скачивания',
        fileUrl: `/api/recordings/${id}/download`
      });
    } catch (error) {
      log(`Error sending recording: ${error}`, 'telegram');
      res.status(500).json({ message: 'Failed to send recording', error });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
