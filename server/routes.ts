import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRecordingSchema } from "@shared/schema";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { sendAudioToTelegram, sendTextToTelegram, resolveTelegramUsername, getBotInfo, getBotUpdates } from './telegram';
import { getClientBotInfo, getClientBotUpdates, resolveClientUsername, sendClientAudio, sendClientTextMessage, notifyUserAboutRecording } from './client-bot';
import { log } from './vite';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { transcribeAudio } from './openai';
import { fragmentManager } from './fragments';
import { eventLogger } from './event-logger';

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
  // Функция для безопасного обращения с timestamp
  const safeTimestamp = (timestamp: string | null | undefined): string => {
    return timestamp || new Date().toISOString();
  };
  
  // Эндпоинт для начала записи (создает запись со статусом "started")
  app.post('/api/recordings/start', async (req: Request, res: Response) => {
    try {
      const { targetUsername, senderUsername = "Пользователь" } = req.body;
      
      if (!targetUsername) {
        return res.status(400).json({ 
          success: false, 
          message: 'Не указано имя пользователя получателя' 
        });
      }
      
      // Создаем запись со статусом "started"
      try {
        const timestamp = new Date().toISOString();
        
        const validData = insertRecordingSchema.parse({
          filename: '',  // Будет заполнено после записи
          duration: 0,   // Будет обновлено после записи
          timestamp,
          targetUsername,
          senderUsername,
          status: 'started'
        });
        
        const recording = await storage.createRecording(validData);
        
        // Логируем начало записи
        if (senderUsername && senderUsername !== "Пользователь") {
          eventLogger.logRecordingStart(senderUsername);
        }
        
        log(`Создана новая запись (ID: ${recording.id}) со статусом 'started'`, 'recording');
        
        res.status(201).json({
          success: true,
          recordingId: recording.id,
          message: 'Запись начата',
          recording
        });
      } catch (error) {
        log(`Ошибка при создании записи со статусом 'started': ${error}`, 'recording');
        res.status(400).json({ 
          success: false, 
          message: 'Не удалось создать запись со статусом "started"', 
          error 
        });
      }
    } catch (error) {
      log(`Ошибка при обработке запроса на начало записи: ${error}`, 'recording');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при обработке запроса', 
        error 
      });
    }
  });
  
  // Эндпоинт для загрузки готовой записи
  app.post('/api/recordings', upload.single('audio'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No audio file uploaded' });
      }

      const recordingData = req.body;
      const recordingId = recordingData.recordingId ? parseInt(recordingData.recordingId, 10) : null;
      
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

        // Проверяем существует ли начатая запись, которую нужно обновить
        let recording;
        if (recordingId) {
          try {
            const existingRecording = await storage.getRecordingById(recordingId);
            
            if (existingRecording && existingRecording.status === 'started') {
              log(`Найдена запись со статусом 'started' (ID: ${recordingId}), обновляем...`, 'recording');
              
              // Сначала обновляем статус на 'completed'
              await storage.updateRecordingStatus(recordingId, 'completed');
              
              // Затем обновляем другие данные (для этого нужно создать специальный метод)
              // Пока просто создаем новую запись с отметкой, что она является продолжением предыдущей
              const validData = insertRecordingSchema.parse({
                filename: req.file.filename,
                duration: parseInt(recordingData.duration, 10),
                timestamp: recordingData.timestamp || new Date().toISOString(),
                targetUsername: recordingData.targetUsername || existingRecording.targetUsername,
                senderUsername: recordingData.senderUsername || existingRecording.senderUsername || "Пользователь",
                fileSize: fileSize,
                transcription: transcriptionText,
                transcriptionCost: transcriptionCost,
                tokensProcessed: tokensProcessed,
                status: 'completed'
              });

              recording = await storage.createRecording(validData);
              
              log(`Создана новая запись (ID: ${recording.id}) со статусом 'completed' на основе записи ${recordingId}`, 'recording');
              
              // Если есть информация о пользователе, логируем завершение записи
              if (recordingData.senderUsername) {
                eventLogger.logRecordingEnd(recordingData.senderUsername, parseInt(recordingData.duration, 10), fileSize);
              }
            } else {
              // Запись не найдена или уже имеет статус, отличный от 'started'
              log(`Запись с ID: ${recordingId} не найдена или уже не имеет статус 'started'`, 'recording');
              
              // Создаем новую запись
              const validData = insertRecordingSchema.parse({
                filename: req.file.filename,
                duration: parseInt(recordingData.duration, 10),
                timestamp: recordingData.timestamp || new Date().toISOString(),
                targetUsername: recordingData.targetUsername,
                senderUsername: recordingData.senderUsername || "Пользователь",
                fileSize: fileSize,
                transcription: transcriptionText,
                transcriptionCost: transcriptionCost,
                tokensProcessed: tokensProcessed,
                status: 'completed'
              });

              recording = await storage.createRecording(validData);
            }
          } catch (updateError) {
            log(`Ошибка при обновлении существующей записи: ${updateError}`, 'recording');
            // Создаем новую запись если не удалось обновить существующую
            const validData = insertRecordingSchema.parse({
              filename: req.file.filename,
              duration: parseInt(recordingData.duration, 10),
              timestamp: recordingData.timestamp || new Date().toISOString(),
              targetUsername: recordingData.targetUsername,
              senderUsername: recordingData.senderUsername || "Пользователь",
              fileSize: fileSize,
              transcription: transcriptionText,
              transcriptionCost: transcriptionCost,
              tokensProcessed: tokensProcessed,
              status: 'completed'
            });

            recording = await storage.createRecording(validData);
          }
        } else {
          // Создаем новую запись, так как ID не предоставлен
          const validData = insertRecordingSchema.parse({
            filename: req.file.filename,
            duration: parseInt(recordingData.duration, 10),
            timestamp: recordingData.timestamp || new Date().toISOString(),
            targetUsername: recordingData.targetUsername,
            senderUsername: recordingData.senderUsername || "Пользователь",
            fileSize: fileSize,
            transcription: transcriptionText,
            transcriptionCost: transcriptionCost,
            tokensProcessed: tokensProcessed,
            status: 'completed'
          });

          recording = await storage.createRecording(validData);
        }
        
        // Также создаем запись в пользовательской базе, если указан целевой пользователь
        if (recordingData.targetUsername) {
          try {
            await storage.createUserRecording({
              adminRecordingId: recording.id,
              username: recordingData.targetUsername,
              duration: parseInt(recordingData.duration, 10),
              timestamp: recordingData.timestamp || new Date().toISOString(),
            });
            log(`Создана пользовательская запись для @${recordingData.targetUsername}`, 'storage');
          } catch (createUserError) {
            log(`Ошибка при создании пользовательской записи: ${createUserError}`, 'storage');
            // Продолжаем выполнение, не прерываем основной процесс
          }
        }
        
        // Если указан отправитель, то создаем запись и для него
        if (recordingData.senderUsername && recordingData.senderUsername !== "Пользователь") {
          try {
            await storage.createUserRecording({
              adminRecordingId: recording.id,
              username: recordingData.senderUsername,
              duration: parseInt(recordingData.duration, 10),
              timestamp: recordingData.timestamp || new Date().toISOString(),
            });
            log(`Создана пользовательская запись для отправителя @${recordingData.senderUsername}`, 'storage');
          } catch (createSenderError) {
            log(`Ошибка при создании пользовательской записи для отправителя: ${createSenderError}`, 'storage');
            // Продолжаем выполнение, не прерываем основной процесс
          }
        }
        
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

  // Эндпоинт для обновления статуса записи
  app.post('/api/recordings/:id/status', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { status } = req.body;
      
      if (!status || !['started', 'completed', 'error'].includes(status)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Некорректный статус. Допустимые значения: started, completed, error' 
        });
      }
      
      const recording = await storage.getRecordingById(id);
      
      if (!recording) {
        return res.status(404).json({ 
          success: false, 
          message: 'Запись не найдена' 
        });
      }
      
      const updatedRecording = await storage.updateRecordingStatus(id, status);
      
      if (status === 'error' && req.body.errorMessage) {
        log(`Запись ${id} помечена как ошибочная: ${req.body.errorMessage}`, 'recording');
        
        // Если запись в состоянии ошибки и есть информация о пользователе, логируем ошибку
        if (recording.senderUsername && recording.senderUsername !== "Пользователь") {
          eventLogger.logRecordingError(recording.senderUsername, req.body.errorMessage);
        }
      }
      
      log(`Обновлен статус записи ${id}: ${status}`, 'recording');
      
      res.json({
        success: true,
        message: `Статус записи обновлен на "${status}"`,
        recording: updatedRecording
      });
    } catch (error) {
      log(`Ошибка при обновлении статуса записи: ${error}`, 'recording');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при обновлении статуса', 
        error 
      });
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
      // Проверяем, что filename существует, а не null
      if (!recording.filename) {
        return res.status(404).json({ message: 'Audio filename is missing' });
      }
      
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
      // Проверяем, что filename существует, а не null
      if (!recording.filename) {
        return res.status(404).json({ message: 'Audio filename is missing' });
      }
      
      const filePath = path.join(__dirname, 'uploads', recording.filename);
      
      // Проверка существования файла
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Audio file not found on server' });
      }

      // Отправляем аудио целевому пользователю через бот с API токеном
      const targetUsername = recording.targetUsername.replace('@', '');
      log(`Preparing to send audio file to @${targetUsername}`, 'telegram');
      
      // Попытка найти chat_id по имени пользователя
      const targetChatId = await resolveTelegramUsername(targetUsername);
      
      if (!targetChatId) {
        log(`Failed to resolve username @${targetUsername}`, 'telegram');
        return res.status(200).json({ 
          message: `Аудио записано, но не удалось найти получателя @${targetUsername}. Файл сохранен на сервере.` 
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
        message: `Запись успешно отправлена @${targetUsername}`
      });
    } catch (error) {
      log(`Error sending recording: ${error}`, 'telegram');
      res.status(500).json({ message: 'Failed to send recording', error });
    }
  });

  // Маршрут для тестирования отправки текстового сообщения в Telegram
  app.post('/api/send-telegram-message', async (req: Request, res: Response) => {
    try {
      const { username, message = 'Тестовое сообщение из таймера визита' } = req.body;
      
      if (!username) {
        return res.status(400).json({
          success: false,
          message: 'Не указано имя пользователя-получателя'
        });
      }
      
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

  // Эндпоинт для получения информации об админском боте
  app.get('/api/telegram/admin-bot-info', async (req: Request, res: Response) => {
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
      log(`Error getting admin bot info: ${error}`, 'telegram');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при получении информации о боте',
        error
      });
    }
  });
  
  // Эндпоинт для получения обновлений админского бота
  app.get('/api/telegram/admin-bot-updates', async (req: Request, res: Response) => {
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
      log(`Error getting admin bot updates: ${error}`, 'telegram');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при получении обновлений для бота',
        error
      });
    }
  });
  
  // Эндпоинт для получения информации о клиентском боте
  app.get('/api/telegram/client-bot-info', async (req: Request, res: Response) => {
    try {
      const botInfo = await getClientBotInfo();
      if (!botInfo) {
        return res.status(500).json({ success: false, message: 'Не удалось получить информацию о клиентском боте' });
      }
      
      res.json({
        success: true,
        botInfo
      });
    } catch (error) {
      log(`Error getting client bot info: ${error}`, 'client-bot');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при получении информации о клиентском боте',
        error
      });
    }
  });
  
  // Эндпоинт для получения обновлений клиентского бота
  app.get('/api/telegram/client-bot-updates', async (req: Request, res: Response) => {
    try {
      const updates = await getClientBotUpdates();
      if (!updates) {
        return res.status(500).json({ success: false, message: 'Не удалось получить обновления для клиентского бота' });
      }
      
      res.json({
        success: true,
        updates
      });
    } catch (error) {
      log(`Error getting client bot updates: ${error}`, 'client-bot');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при получении обновлений для клиентского бота',
        error
      });
    }
  });

  // ======= API для работы с админкой ======= 
  
  // Получение всех записей для админки
  app.get('/api/admin/recordings', async (req: Request, res: Response) => {
    try {
      const recordings = await storage.getAdminRecordings();
      res.json(recordings);
    } catch (error) {
      log(`Error fetching admin recordings: ${error}`, 'admin');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при получении записей админки',
        error
      });
    }
  });
  
  // Получение записи по ID для админки
  app.get('/api/admin/recordings/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }
      
      const recording = await storage.getAdminRecordingById(id);
      if (!recording) {
        return res.status(404).json({ message: 'Recording not found' });
      }
      
      res.json(recording);
    } catch (error) {
      log(`Error fetching admin recording: ${error}`, 'admin');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при получении записи админки',
        error
      });
    }
  });
  
  // Отметка записи как отправленной для админки
  app.post('/api/admin/recordings/:id/mark-sent', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID' });
      }
      
      const recording = await storage.markAdminRecordingAsSent(id);
      if (!recording) {
        return res.status(404).json({ message: 'Recording not found' });
      }
      
      res.json(recording);
    } catch (error) {
      log(`Error marking admin recording as sent: ${error}`, 'admin');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при отметке записи как отправленной',
        error
      });
    }
  });
  
  // ======= API для работы с клиентскими записями (пользовательская часть) =======
  
  // Получение записей для конкретного пользователя (по его username)
  app.get('/api/client/recordings/:username', async (req: Request, res: Response) => {
    try {
      const username = req.params.username;
      
      if (!username) {
        return res.status(400).json({ 
          success: false, 
          message: 'Не указано имя пользователя' 
        });
      }
      
      // Подробное логирование
      log(`Запрошены записи для пользователя: @${username}`, 'client-bot');
      
      // Получаем записи пользователя
      const userRecordings = await storage.getUserRecordings(username);
      log(`Найдено ${userRecordings.length} записей для пользователя @${username}`, 'client-bot');
      
      // Если записей пользователя нет, но мы должны искать в основной базе
      if (userRecordings.length === 0) {
        log(`Записи пользователя не найдены, ищем в основной базе (для обратной совместимости)`, 'client-bot');
        
        // Получаем все записи из админской базы
        const allRecordings = await storage.getAdminRecordings();
        
        // Очищаем имя пользователя от @ и переводим в нижний регистр
        const cleanUsername = username.replace(/^@/, '').toLowerCase();
        
        // Фильтруем записи, где пользователь является отправителем или получателем
        const matchingRecordings = allRecordings.filter(recording => {
          const senderMatch = recording.senderUsername && 
                            recording.senderUsername.replace(/^@/, '').toLowerCase() === cleanUsername;
                            
          const targetMatch = recording.targetUsername && 
                            recording.targetUsername.replace(/^@/, '').toLowerCase() === cleanUsername;
                            
          // Для бота пользователь должен видеть только свои записи (где он отправитель)
          return senderMatch;
        });
        
        // Для каждой найденной записи создаем запись в пользовательской базе
        for (const recording of matchingRecordings) {
          try {
            await storage.createUserRecording({
              adminRecordingId: recording.id,
              username: username,
              duration: recording.duration,
              timestamp: recording.timestamp,
            });
          } catch (error) {
            log(`Ошибка при создании записи пользователя из основной базы: ${error}`, 'client-bot');
          }
        }
        
        // Получаем обновленный список записей пользователя
        const updatedUserRecordings = await storage.getUserRecordings(username);
        log(`Создано ${updatedUserRecordings.length} записей пользователя из основной базы`, 'client-bot');
        
        res.json({
          success: true,
          recordings: updatedUserRecordings
        });
      } else {
        res.json({
          success: true,
          recordings: userRecordings
        });
      }
    } catch (error) {
      log(`Error fetching client recordings: ${error}`, 'client-bot');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при получении записей пользователя',
        error
      });
    }
  });
  
  // Отправка сообщения пользователю через клиентский бот
  app.post('/api/client/send-message', async (req: Request, res: Response) => {
    try {
      const { username, message } = req.body;
      
      if (!username || !message) {
        return res.status(400).json({ 
          success: false, 
          message: 'Не указано имя пользователя или текст сообщения' 
        });
      }
      
      log(`Attempting to send client message to @${username}`, 'client-bot');
      
      // Попытка найти chat_id по имени пользователя
      const targetChatId = await resolveClientUsername(username);
      
      if (!targetChatId) {
        log(`Failed to resolve username @${username} for client bot`, 'client-bot');
        return res.status(200).json({ 
          success: false,
          message: 'Не удалось найти получателя в клиентском боте'
        });
      }
      
      log(`Sending text message to resolved client recipient: ${targetChatId}`, 'client-bot');
      
      // Отправка текстового сообщения через клиентский бот
      const success = await sendClientTextMessage(
        targetChatId,
        message
      );
      
      if (!success) {
        return res.status(200).json({ 
          success: false,
          message: 'Отправка сообщения через клиентский бот не удалась'
        });
      }
      
      res.json({
        success: true,
        message: `Сообщение успешно отправлено @${username} через клиентский бот`
      });
    } catch (error) {
      log(`Error sending client message: ${error}`, 'client-bot');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при отправке сообщения через клиентский бот',
        error
      });
    }
  });
  
  // Отправка аудиозаписи пользователю через клиентский бот
  app.post('/api/client/send-audio/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ 
          success: false, 
          message: 'Не указано имя пользователя-получателя' 
        });
      }
      
      const recording = await storage.getRecordingById(id);
      
      if (!recording) {
        return res.status(404).json({ 
          success: false, 
          message: 'Запись не найдена' 
        });
      }
      
      // Полный путь к аудиофайлу
      // Проверяем, что filename существует, а не null
      if (!recording.filename) {
        return res.status(404).json({ 
          success: false, 
          message: 'Имя аудиофайла отсутствует'
        });
      }
      
      const filePath = path.join(__dirname, 'uploads', recording.filename);
      
      // Проверка существования файла
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ 
          success: false, 
          message: 'Аудиофайл не найден на сервере' 
        });
      }
      
      log(`Attempting to send client audio to @${username}`, 'client-bot');
      
      // Попытка найти chat_id по имени пользователя
      const targetChatId = await resolveClientUsername(username);
      
      if (!targetChatId) {
        log(`Failed to resolve username @${username} for client bot`, 'client-bot');
        return res.status(200).json({ 
          success: false,
          message: 'Не удалось найти получателя в клиентском боте'
        });
      }
      
      // Форматируем подпись к аудио
      let caption = `Запись с таймера визита (${new Date(recording.timestamp).toLocaleString('ru')})`;
      if (recording.senderUsername) {
        caption += `\nОтправитель: ${recording.senderUsername}`;
      }
      
      // Отправка аудио через клиентский бот
      const success = await sendClientAudio(
        filePath,
        targetChatId,
        caption
      );
      
      if (!success) {
        return res.status(200).json({ 
          success: false,
          message: 'Отправка аудио через клиентский бот не удалась'
        });
      }
      
      // Если запись предназначена для этого пользователя, помечаем как отправленную
      if (recording.targetUsername.toLowerCase() === username.toLowerCase()) {
        await storage.markRecordingAsSent(id);
      }
      
      res.json({
        success: true,
        message: `Аудиозапись успешно отправлена @${username} через клиентский бот`
      });
    } catch (error) {
      log(`Error sending client audio: ${error}`, 'client-bot');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при отправке аудио через клиентский бот',
        error
      });
    }
  });
  
  // Уведомление пользователя о новой записи
  app.post('/api/client/notify-user/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ 
          success: false, 
          message: 'Не указано имя пользователя-получателя' 
        });
      }
      
      const recording = await storage.getRecordingById(id);
      
      if (!recording) {
        return res.status(404).json({ 
          success: false, 
          message: 'Запись не найдена' 
        });
      }
      
      log(`Attempting to notify user @${username} about recording`, 'client-bot');
      
      // Попытка найти chat_id по имени пользователя
      const targetChatId = await resolveClientUsername(username);
      
      if (!targetChatId) {
        log(`Failed to resolve username @${username} for client notification`, 'client-bot');
        return res.status(200).json({ 
          success: false,
          message: 'Не удалось найти получателя в клиентском боте'
        });
      }
      
      // Отправляем уведомление о новой записи
      const success = await notifyUserAboutRecording(recording, targetChatId);
      
      if (!success) {
        return res.status(200).json({ 
          success: false,
          message: 'Отправка уведомления через клиентский бот не удалась'
        });
      }
      
      res.json({
        success: true,
        message: `Уведомление успешно отправлено @${username} через клиентский бот`
      });
    } catch (error) {
      log(`Error sending client notification: ${error}`, 'client-bot');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при отправке уведомления через клиентский бот',
        error
      });
    }
  });
  
  // Эндпоинт для получения информации о файлах на сервере
  // ======= API для работы с фрагментами записи =======
  
  // Прием фрагмента записи
  app.post('/api/recording-fragments', upload.single('fragmentAudio'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Не загружен аудиофайл фрагмента' });
      }
      
      const { fragmentIndex, timestamp, sessionId } = req.body;
      
      if (!fragmentIndex || !timestamp || !sessionId) {
        return res.status(400).json({ 
          message: 'Отсутствуют необходимые параметры (fragmentIndex, timestamp, sessionId)' 
        });
      }
      
      // Чтение содержимого файла
      const filePath = path.join(__dirname, 'uploads', req.file.filename);
      const fileBuffer = await fs.promises.readFile(filePath);
      
      // Сохраняем фрагмент через менеджер фрагментов
      const fragment = await fragmentManager.saveFragment(
        fileBuffer, 
        parseInt(fragmentIndex, 10), 
        parseInt(timestamp, 10),
        sessionId
      );
      
      // Логирование события
      eventLogger.logEvent(
        'system', 
        'FRAGMENT_RECEIVED', 
        { sessionId, index: fragment.index, size: fragment.size }
      );
      
      // Удаляем временный файл, так как мы уже сохранили его в fragmentManager
      await fs.promises.unlink(filePath).catch(() => {});
      
      res.status(201).json({ 
        success: true, 
        message: 'Фрагмент успешно сохранен',
        fragment
      });
    } catch (error) {
      log(`Ошибка при приеме фрагмента: ${error}`, 'fragments');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при сохранении фрагмента записи',
        error
      });
    }
  });
  
  // Объединение фрагментов записи
  app.get('/api/recording-fragments/combine', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.query;
      
      if (!sessionId) {
        return res.status(400).json({ 
          message: 'Не указан ID сессии записи' 
        });
      }
      
      // Получаем объединенный файл из менеджера фрагментов
      const combinedBuffer = await fragmentManager.getCombinedFile(sessionId as string);
      
      if (!combinedBuffer) {
        return res.status(404).json({ 
          message: 'Не найдены фрагменты для указанной сессии' 
        });
      }
      
      // Логирование события
      eventLogger.logEvent(
        'system', 
        'FRAGMENTS_COMBINED_REQUESTED', 
        { sessionId, size: combinedBuffer.length }
      );
      
      // Отправляем файл
      res.set('Content-Type', 'audio/webm');
      res.set('Content-Disposition', `attachment; filename="combined-${sessionId}.webm"`);
      res.send(combinedBuffer);
    } catch (error) {
      log(`Ошибка при объединении фрагментов: ${error}`, 'fragments');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при объединении фрагментов записи',
        error
      });
    }
  });
  
  // Очистка фрагментов сессии
  app.delete('/api/recording-fragments/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({ 
          message: 'Не указан ID сессии записи' 
        });
      }
      
      // Очищаем фрагменты через менеджер
      await fragmentManager.cleanupSession(sessionId);
      
      // Логирование события
      eventLogger.logEvent(
        'system', 
        'FRAGMENTS_CLEANED', 
        { sessionId }
      );
      
      res.json({ 
        success: true, 
        message: 'Фрагменты успешно удалены' 
      });
    } catch (error) {
      log(`Ошибка при очистке фрагментов: ${error}`, 'fragments');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при очистке фрагментов записи',
        error
      });
    }
  });
  
  // Эндпоинт для регистрации событий клиента
  app.post('/api/events/recording-start', async (req: Request, res: Response) => {
    try {
      const { username, timestamp } = req.body;
      
      if (!username) {
        return res.status(400).json({ 
          message: 'Не указано имя пользователя' 
        });
      }
      
      // Логируем начало записи
      eventLogger.logRecordingStart(username);
      
      // Создаем запись в БД со статусом 'started'
      try {
        const recordingData = {
          // Обязательные поля
          duration: 0, // Начальная длительность
          timestamp: timestamp || new Date().toISOString(),
          targetUsername: 'archive', // По умолчанию
          senderUsername: username,
          status: 'started'
        };
        
        // Валидация данных
        const validData = insertRecordingSchema.parse(recordingData);
        
        // Создаем запись для админской базы
        const recording = await storage.createRecording(validData);
        
        console.log(`[recording] Создана запись со статусом "started" для ${username}, ID: ${recording.id}`);
        
        res.json({ 
          success: true, 
          message: 'Событие начала записи зарегистрировано',
          recordingId: recording.id 
        });
      } catch (dbError) {
        console.error(`[recording] Ошибка при создании записи: ${dbError}`);
        // Даже если не удалось создать запись, продолжаем работу
        res.json({ 
          success: true, 
          message: 'Событие начала записи зарегистрировано, но не сохранено в БД',
          error: dbError.message
        });
      }
    } catch (error) {
      log(`Ошибка при регистрации события: ${error}`, 'events');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при регистрации события',
        error
      });
    }
  });
  
  // Получение всех событий логов
  app.get('/api/events', async (req: Request, res: Response) => {
    try {
      const events = eventLogger.getAllEvents();
      res.json({ 
        success: true, 
        events 
      });
    } catch (error) {
      log(`Ошибка при получении событий: ${error}`, 'events');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при получении списка событий',
        error
      });
    }
  });
  
  // Получение событий для конкретного пользователя
  app.get('/api/events/user/:username', async (req: Request, res: Response) => {
    try {
      const { username } = req.params;
      
      if (!username) {
        return res.status(400).json({ 
          message: 'Не указано имя пользователя' 
        });
      }
      
      const events = eventLogger.getUserEvents(username);
      res.json({ 
        success: true, 
        events 
      });
    } catch (error) {
      log(`Ошибка при получении событий пользователя: ${error}`, 'events');
      res.status(500).json({ 
        success: false, 
        message: 'Ошибка при получении списка событий пользователя',
        error
      });
    }
  });

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
