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
import diarizationComparisonRoutes from './diarization-comparison-routes.js';

// Создаем роутер для API
const router = express.Router();

// Регистрируем маршруты
router.use(adminRoutes);
router.use(transcriptionRoutes);
router.use(diarizationComparisonRoutes);

// Общий эндпоинт для проверки работоспособности API
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      api: true,
      admin: true,
      transcription: true,
      diarization: true
    }
  });
});

export default router;