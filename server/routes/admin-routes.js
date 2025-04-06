/**
 * Маршруты для административной панели
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Настройка загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(process.cwd(), 'data', 'recordings');
    // Создаем директорию, если не существует
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100 MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый формат файла. Загружайте только аудиофайлы.'));
    }
  }
});

/**
 * Получение списка всех записей
 * GET /api/admin/recordings
 */
router.get('/admin/recordings', (req, res) => {
  try {
    // Получаем записи из хранилища
    const recordings = req.app.locals.storage?.getRecordings?.() || [];
    
    // Сортируем записи по времени в обратном порядке
    const sortedRecordings = [...recordings].sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    
    res.json(sortedRecordings);
  } catch (error) {
    console.error(`[Admin API] Ошибка при получении записей: ${error.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * Получение информации о конкретной записи
 * GET /api/admin/recordings/:id
 */
router.get('/admin/recordings/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Некорректный ID записи' });
    }
    
    // Получаем запись из хранилища
    const recordings = req.app.locals.storage?.getRecordings?.() || [];
    const recording = recordings.find(r => r.id === id);
    
    if (!recording) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    
    res.json(recording);
  } catch (error) {
    console.error(`[Admin API] Ошибка при получении записи: ${error.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * Загрузка аудиофайла
 * POST /api/admin/recordings/upload
 */
router.post('/admin/recordings/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }
    
    // Создаем новую запись
    const newRecording = {
      id: Date.now(),
      filename: req.file.filename,
      originalFilename: req.file.originalname,
      timestamp: new Date().toISOString(),
      size: req.file.size,
      status: 'uploaded'
    };
    
    // Добавляем запись в хранилище
    const savedRecording = req.app.locals.storage?.addRecording?.(newRecording);
    
    if (!savedRecording) {
      return res.status(500).json({ error: 'Не удалось сохранить запись' });
    }
    
    res.status(201).json(savedRecording);
  } catch (error) {
    console.error(`[Admin API] Ошибка при загрузке файла: ${error.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * Обновление информации о записи
 * PATCH /api/admin/recordings/:id
 */
router.patch('/admin/recordings/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Некорректный ID записи' });
    }
    
    // Получаем запись из хранилища
    const recordings = req.app.locals.storage?.getRecordings?.() || [];
    const recordingIndex = recordings.findIndex(r => r.id === id);
    
    if (recordingIndex === -1) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    
    // Обновляем запись
    const updatedRecording = {
      ...recordings[recordingIndex],
      ...req.body,
      id // Сохраняем оригинальный ID
    };
    
    // Сохраняем обновленную запись
    const savedRecording = req.app.locals.storage?.updateRecording?.(id, updatedRecording);
    
    if (!savedRecording) {
      return res.status(500).json({ error: 'Не удалось обновить запись' });
    }
    
    res.json(savedRecording);
  } catch (error) {
    console.error(`[Admin API] Ошибка при обновлении записи: ${error.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * Удаление записи
 * DELETE /api/admin/recordings/:id
 */
router.delete('/admin/recordings/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Некорректный ID записи' });
    }
    
    // Получаем запись из хранилища
    const recordings = req.app.locals.storage?.getRecordings?.() || [];
    const recording = recordings.find(r => r.id === id);
    
    if (!recording) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    
    // Если есть имя файла, удаляем его
    if (recording.filename) {
      const filePath = path.join(process.cwd(), 'data', 'recordings', recording.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    // Удаляем запись из хранилища
    const success = req.app.locals.storage?.deleteRecording?.(id);
    
    if (!success) {
      return res.status(500).json({ error: 'Не удалось удалить запись' });
    }
    
    res.status(204).end();
  } catch (error) {
    console.error(`[Admin API] Ошибка при удалении записи: ${error.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

export default router;