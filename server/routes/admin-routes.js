/**
 * Маршруты API для админ-панели
 */

import express from 'express';
import { log } from '../vite.js';
import adminModule from '../modules/admin/index.js';
import recordingModule from '../modules/recording/index.js';
import audioPlayerModule from '../modules/audio-player/index.js';

const router = express.Router();

// Получение списка всех записей
router.get('/recordings', async (req, res) => {
  try {
    const { limit = 50, offset = 0, sortBy = 'timestamp', sortDir = 'desc' } = req.query;
    
    const result = await adminModule.getAdminRecordings({
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      sortBy,
      sortDir
    });
    
    res.json(result);
  } catch (error) {
    log(`Ошибка при получении списка записей: ${error}`, 'admin-api');
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка при получении списка записей'
    });
  }
});

// Получение записи по ID
router.get('/recordings/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const recording = await adminModule.getAdminRecordingById(id);
    
    if (!recording) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    
    res.json(recording);
  } catch (error) {
    log(`Ошибка при получении записи: ${error}`, 'admin-api');
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка при получении записи'
    });
  }
});

// Удаление записи
router.delete('/recordings/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await adminModule.deleteAdminRecording(id);
    res.json(result);
  } catch (error) {
    log(`Ошибка при удалении записи: ${error}`, 'admin-api');
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка при удалении записи'
    });
  }
});

// Получение аудиофайла записи
router.get('/recordings/:id/audio', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    // Получаем путь к файлу
    const filePath = await recordingModule.getRecordingFilePath(id);
    
    // Обрабатываем запрос на потоковую передачу
    const streamInfo = await audioPlayerModule.handleAudioStream(req, filePath);
    
    // Устанавливаем заголовки
    for (const [key, value] of Object.entries(streamInfo.headers)) {
      res.setHeader(key, value);
    }
    
    // Отправляем файл
    if (streamInfo.range) {
      const { start, end } = streamInfo.range;
      const fileStream = fs.createReadStream(filePath, { start, end });
      res.status(streamInfo.statusCode);
      fileStream.pipe(res);
    } else {
      res.status(streamInfo.statusCode);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    log(`Ошибка при получении аудиофайла: ${error}`, 'admin-api');
    res.status(404).json({ 
      error: error instanceof Error ? error.message : 'Аудиофайл не найден'
    });
  }
});

// Получение фрагментов записи
router.get('/recordings/:id/fragments', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const fragments = await recordingModule.getRecordingFragments(id);
    res.json(fragments);
  } catch (error) {
    log(`Ошибка при получении фрагментов записи: ${error}`, 'admin-api');
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка при получении фрагментов записи'
    });
  }
});

// Получение аудиофайла фрагмента
router.get('/recordings/:recordingId/fragments/:fragmentId/audio', async (req, res) => {
  try {
    const fragmentId = parseInt(req.params.fragmentId, 10);
    
    // Получаем путь к файлу фрагмента
    const filePath = await audioPlayerModule.getFragmentFilePath(fragmentId);
    
    // Обрабатываем запрос на потоковую передачу
    const streamInfo = await audioPlayerModule.handleAudioStream(req, filePath);
    
    // Устанавливаем заголовки
    for (const [key, value] of Object.entries(streamInfo.headers)) {
      res.setHeader(key, value);
    }
    
    // Отправляем файл
    if (streamInfo.range) {
      const { start, end } = streamInfo.range;
      const fileStream = fs.createReadStream(filePath, { start, end });
      res.status(streamInfo.statusCode);
      fileStream.pipe(res);
    } else {
      res.status(streamInfo.statusCode);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    log(`Ошибка при получении аудиофайла фрагмента: ${error}`, 'admin-api');
    res.status(404).json({ 
      error: error instanceof Error ? error.message : 'Аудиофайл фрагмента не найден'
    });
  }
});

// Объединение фрагментов записи
router.post('/recordings/:id/merge-fragments', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { sessionId, forceProcess = false } = req.body;
    
    const result = await adminModule.mergeRecordingFragments(id, { sessionId, forceProcess });
    res.json(result);
  } catch (error) {
    log(`Ошибка при объединении фрагментов: ${error}`, 'admin-api');
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка при объединении фрагментов'
    });
  }
});

// Обновление статуса записи
router.post('/recordings/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, sessionId, forceProcess } = req.body;
    
    if (!status || !['started', 'completed', 'error'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Некорректный статус. Допустимые значения: started, completed, error' 
      });
    }
    
    // Проверяем существование записи
    const recording = await recordingModule.getRecordingById(id);
    
    if (!recording) {
      return res.status(404).json({ 
        success: false, 
        message: 'Запись не найдена' 
      });
    }
    
    // Обновляем статус записи
    if (status === 'completed' && (sessionId || forceProcess)) {
      // Если статус 'completed' и указан sessionId или включен режим принудительной обработки,
      // запускаем процесс завершения записи с обработкой фрагментов
      const result = await recordingModule.completeRecording(id, { sessionId, forceProcess });
      res.json({
        success: true,
        message: `Статус записи изменен на ${status}`,
        recording: result
      });
    } else {
      // Просто обновляем статус записи
      await storage.updateRecordingStatus(id, status);
      
      const updatedRecording = await recordingModule.getRecordingById(id);
      
      res.json({
        success: true,
        message: `Статус записи изменен на ${status}`,
        recording: updatedRecording
      });
    }
  } catch (error) {
    log(`Ошибка при обновлении статуса записи: ${error}`, 'admin-api');
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка при обновлении статуса записи', 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
});

// Сравнительная транскрипция
router.post('/recordings/:id/compare', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { language = 'ru' } = req.body;
    
    const result = await adminModule.compareRecordingTranscription(id, { language });
    res.json(result);
  } catch (error) {
    log(`Ошибка сравнительной транскрипции: ${error}`, 'admin-api');
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка при выполнении сравнительной транскрипции' 
    });
  }
});

// Получение статистики для админ-панели
router.get('/stats', async (req, res) => {
  try {
    const stats = await adminModule.getAdminStats();
    res.json(stats);
  } catch (error) {
    log(`Ошибка при получении статистики: ${error}`, 'admin-api');
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка при получении статистики'
    });
  }
});

// Получение информации о фрагментах для плеера
router.get('/recordings/:id/player-fragments', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const playerFragments = await audioPlayerModule.getPlayerFragments(id);
    res.json(playerFragments);
  } catch (error) {
    log(`Ошибка при получении фрагментов для плеера: ${error}`, 'admin-api');
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка при получении фрагментов для плеера'
    });
  }
});

export default router;