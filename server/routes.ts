import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRecordingSchema } from "@shared/schema";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { sendAudioToTelegram, sendTextToTelegram, resolveTelegramUsername, getBotInfo, getBotUpdates } from './telegram';
import { log } from './vite';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { transcribeAudio } from './openai';

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
        // Получить размер файла
        const filePath = path.join(__dirname, 'uploads', req.file.filename);
        let fileSize = 0;
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          fileSize = stats.size;
        }
        
        // Распознаем текст из аудио и получаем стоимость
        log('Начинаем распознавание речи...', 'openai');
        const transcriptionResult = await transcribeAudio(filePath);
        
        // Извлекаем данные из результата
        let transcriptionText = null;
        let transcriptionCost = null;
        let tokensProcessed = null;
        
        if (transcriptionResult) {
          transcriptionText = transcriptionResult.text;
          transcriptionCost = transcriptionResult.cost;
          tokensProcessed = transcriptionResult.tokensProcessed;
          log(`Результат распознавания: ${transcriptionText}`, 'openai');
          log(`Стоимость распознавания: $${transcriptionCost} (${tokensProcessed} токенов)`, 'openai');
        }
        
        const validData = insertRecordingSchema.parse({
          filename: req.file.filename,
          duration: parseInt(recordingData.duration, 10),
          timestamp: recordingData.timestamp,
          targetUsername: recordingData.targetUsername,
          senderUsername: recordingData.senderUsername || "Пользователь", // Добавляем имя отправителя
          fileSize: fileSize, // Добавляем размер файла
          transcription: transcriptionText, // Добавляем распознанный текст
          transcriptionCost: transcriptionCost, // Добавляем стоимость распознавания
          tokensProcessed: tokensProcessed // Добавляем количество обработанных токенов
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

  // Добавляем маршрут для скачивания записи аудио
  app.get('/api/recordings/:id/download', async (req: Request, res: Response) => {
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
      
      // Отправляем файл для скачивания
      res.download(filePath, `recording_${id}.wav`);
    } catch (error) {
      res.status(500).json({ message: 'Failed to download recording', error });
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

      // Всегда отправляем аудио пользователю @ostrovityanin через бот с API токеном
      log(`Preparing to send audio file to @ostrovityanin`, 'telegram');
      
      // Попытка найти chat_id по имени пользователя
      const targetUsername = 'ostrovityanin';
      const targetChatId = await resolveTelegramUsername(targetUsername);
      
      if (!targetChatId) {
        log(`Failed to resolve username @${targetUsername}`, 'telegram');
        return res.status(200).json({ 
          message: 'Аудио записано, но не удалось найти получателя. Файл сохранен на сервере.' 
        });
      }
      
      log(`Sending audio to resolved recipient: ${targetChatId}`, 'telegram');
      
      // Отправка аудио через Telegram бот
      const success = await sendAudioToTelegram(
        filePath, 
        targetChatId, // Используем полученный chat_id или имя пользователя с @
        `Запись с таймера визита (${new Date(recording.timestamp).toLocaleString('ru')})`
      );
      
      if (!success) {
        return res.status(200).json({ 
          message: 'Аудио записано, но отправка не удалась. Файл сохранен на сервере.' 
        });
      }
      
      // Mark as sent
      const updatedRecording = await storage.markRecordingAsSent(id);
      
      res.json({
        ...updatedRecording,
        message: 'Запись успешно отправлена @ostrovityanin'
      });
    } catch (error) {
      log(`Error sending recording: ${error}`, 'telegram');
      res.status(500).json({ message: 'Failed to send recording', error });
    }
  });

  // Маршрут для тестирования отправки текстового сообщения в Telegram
  app.post('/api/send-telegram-message', async (req: Request, res: Response) => {
    try {
      const { username = 'ostrovityanin', message = 'Тестовое сообщение из таймера визита' } = req.body;
      
      log(`Attempting to send test message to @${username}`, 'telegram');
      
      // Попытка найти chat_id по имени пользователя
      const targetChatId = await resolveTelegramUsername(username);
      
      if (!targetChatId) {
        log(`Failed to resolve username @${username}`, 'telegram');
        return res.status(200).json({ 
          success: false,
          message: 'Не удалось найти получателя.'
        });
      }
      
      log(`Sending text message to resolved recipient: ${targetChatId}`, 'telegram');
      
      // Отправка текстового сообщения через Telegram бот
      const success = await sendTextToTelegram(
        targetChatId,
        message
      );
      
      if (!success) {
        return res.status(200).json({ 
          success: false,
          message: 'Отправка сообщения не удалась.'
        });
      }
      
      res.json({
        success: true,
        message: `Сообщение успешно отправлено @${username}`
      });
    } catch (error) {
      log(`Error sending text message: ${error}`, 'telegram');
      res.status(500).json({ 
        success: false,
        message: 'Ошибка при отправке сообщения',
        error
      });
    }
  });

  // Эндпоинт для получения информации о боте
  app.get('/api/telegram/bot-info', async (req: Request, res: Response) => {
    try {
      const botInfo = await getBotInfo();
      if (!botInfo) {
        return res.status(500).json({ success: false, message: 'Не удалось получить информацию о боте' });
      }
      
      res.json({
        success: true,
        botInfo
      });
    } catch (error) {
      log(`Error getting bot info: ${error}`, 'telegram');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при получении информации о боте',
        error
      });
    }
  });
  
  // Эндпоинт для получения обновлений бота
  app.get('/api/telegram/updates', async (req: Request, res: Response) => {
    try {
      const updates = await getBotUpdates();
      if (!updates) {
        return res.status(500).json({ success: false, message: 'Не удалось получить обновления для бота' });
      }
      
      res.json({
        success: true,
        updates
      });
    } catch (error) {
      log(`Error getting bot updates: ${error}`, 'telegram');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при получении обновлений для бота',
        error
      });
    }
  });

  // Эндпоинт для получения информации о файлах на сервере
  app.get('/api/files', async (req: Request, res: Response) => {
    try {
      const uploadsDir = path.join(__dirname, 'uploads');
      
      // Проверяем существует ли директория
      if (!fs.existsSync(uploadsDir)) {
        return res.json({ files: [] });
      }
      
      // Получаем список файлов в директории
      const files = fs.readdirSync(uploadsDir);
      
      // Получаем информацию о каждом файле
      const fileDetails = files.map(filename => {
        const filePath = path.join(uploadsDir, filename);
        const stats = fs.statSync(filePath);
        
        return {
          filename,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          fullPath: filePath
        };
      });
      
      // Получаем записи из базы данных
      const recordings = await storage.getRecordings();
      
      // Объединяем информацию о файлах с данными из базы
      const combinedData = fileDetails.map(file => {
        // Находим запись в базе, которая соответствует файлу
        const recording = recordings.find(rec => rec.filename === file.filename);
        
        return {
          ...file,
          recording: recording || null,
          inDatabase: !!recording
        };
      });
      
      res.json({
        success: true,
        files: combinedData
      });
    } catch (error) {
      log(`Error getting file info: ${error}`, 'express');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при получении информации о файлах',
        error
      });
    }
  });
  
  const httpServer = createServer(app);
  return httpServer;
}
