/**
 * Главный файл маршрутов API
 * 
 * Объединяет все маршруты в единую систему
 */

import express from 'express';
import adminRoutes from './admin-routes.js';
import recordingRoutes from './recording-routes.js';
import transcriptionRoutes from './transcription-routes.js';
import apiDocsRouter from '../api-docs.js';
import apiFilesRouter from '../api-files.js';
import { storage } from '../storage.js';
import { log } from '../vite.js';

const router = express.Router();

// Маршруты для админ-панели
router.use('/admin', adminRoutes);

// Маршруты для записей
router.use('/recordings', recordingRoutes);

// Маршруты для транскрипции
router.use('/transcribe', transcriptionRoutes);

// Маршруты для документации API
router.use('/docs', apiDocsRouter);

// Маршруты для доступа к файлам
router.use('/files', apiFilesRouter);

// Маршруты для пользовательских записей
router.get('/user-recordings/:username', async (req, res) => {
  try {
    const username = req.params.username;
    
    if (!username) {
      return res.status(400).json({ error: 'Не указано имя пользователя' });
    }
    
    const userRecordings = await storage.getUserRecordings(username);
    
    // Форматируем данные для фронтенда
    const formattedRecordings = await Promise.all(
      userRecordings.map(async (userRec) => {
        try {
          // Получаем информацию из админской записи
          const adminRec = await storage.getRecordingById(userRec.adminRecordingId);
          
          return {
            id: userRec.id,
            adminRecordingId: userRec.adminRecordingId,
            timestamp: userRec.timestamp,
            duration: userRec.duration,
            audioUrl: adminRec ? `/api/files/${adminRec.filename}` : null,
            sender: adminRec ? adminRec.senderUsername : 'Неизвестно',
            transcription: adminRec ? adminRec.transcription : null,
            exists: adminRec && adminRec.filename ? true : false
          };
        } catch (error) {
          log(`Ошибка при получении админской записи для пользовательской записи ${userRec.id}: ${error}`, 'user-recordings');
          // Возвращаем базовую информацию, если не удалось получить детали
          return {
            id: userRec.id,
            adminRecordingId: userRec.adminRecordingId,
            timestamp: userRec.timestamp,
            duration: userRec.duration,
            audioUrl: null,
            sender: 'Неизвестно',
            transcription: null,
            exists: false
          };
        }
      })
    );
    
    res.json(formattedRecordings);
  } catch (error) {
    log(`Ошибка при получении записей пользователя: ${error}`, 'user-recordings');
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка при получении записей пользователя' 
    });
  }
});

// Эндпоинт для проверки здоровья сервера (health check)
router.get('/health', (req, res) => {
  const startTime = Date.now();
  const status = {
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
    },
    responseTime: Date.now() - startTime + 'ms'
  };
  res.json(status);
});

export default router;