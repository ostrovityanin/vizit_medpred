/**
 * Главный файл маршрутов API
 * 
 * Объединяет все маршруты в единую систему
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Получаем путь к текущему файлу и директории
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Импортируем маршруты для различных функций
import adminRoutes from './admin-routes.js';
import transcriptionRoutes from './transcription-routes.js';

// Динамически импортируем CommonJS модули
const diarizationRoutes = await import('../routes/diarization-routes.js').then(m => m.default);

// Создаем роутер для API
const router = express.Router();

// Регистрируем маршруты
router.use('/admin', adminRoutes);
router.use('/transcription', transcriptionRoutes);
router.use('/diarization', diarizationRoutes);

// Общий эндпоинт для проверки работоспособности API
router.get('/health', async (req, res) => {
  // Проверяем статус сервиса диаризации
  let diarizationStatus = false;
  try {
    // Импортируем модуль диаризации для проверки статуса
    const diarizationModule = await import('../modules/diarization-comparison/index.js').then(m => m.default);
    const serviceStatus = await diarizationModule.checkDiarizationServiceStatus();
    diarizationStatus = serviceStatus.status === 'running';
  } catch (error) {
    console.error('Error checking diarization service status:', error);
  }
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      api: true,
      admin: true,
      transcription: true,
      diarization: diarizationStatus
    }
  });
});

export default router;