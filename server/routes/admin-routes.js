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
router.get('/recordings', async (req, res) => {
  try {
    // Получаем записи из хранилища асинхронно
    // Это согласуется с типами IStorage в storage.ts
    const recordings = await req.app.locals.storage?.getRecordings?.() || [];
    
    // Добавим проверку, что recordings - это массив
    if (!Array.isArray(recordings)) {
      console.error(`[Admin API] Ошибка: recordings не является массивом: ${typeof recordings}`);
      return res.json([]);
    }
    
    // Сортируем записи по времени в обратном порядке
    const sortedRecordings = [...recordings].sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    
    // Добавим подробное логирование для отладки
    console.log(`[Admin API] Возвращаем ${sortedRecordings.length} записей`);
    
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
router.get('/recordings/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Некорректный ID записи' });
    }
    
    // Получаем запись напрямую из хранилища
    const recording = await req.app.locals.storage?.getRecordingById?.(id);
    
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
router.post('/recordings/upload', upload.single('file'), async (req, res) => {
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
      status: 'uploaded',
      targetUsername: req.body.targetUsername || "archive",
      senderUsername: req.body.senderUsername || "Пользователь",
      duration: 0
    };
    
    // Добавляем запись в хранилище
    const savedRecording = await req.app.locals.storage?.createRecording?.(newRecording);
    
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
router.patch('/recordings/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Некорректный ID записи' });
    }
    
    // Получаем запись напрямую из хранилища
    const recording = await req.app.locals.storage?.getRecordingById?.(id);
    
    if (!recording) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    
    // Обновляем запись
    const updatedRecording = {
      ...recording,
      ...req.body,
      id // Сохраняем оригинальный ID
    };
    
    // Сохраняем обновленную запись
    const savedRecording = await req.app.locals.storage?.updateRecording?.(updatedRecording);
    
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
router.delete('/recordings/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Некорректный ID записи' });
    }
    
    // Получаем запись напрямую из хранилища
    const recording = await req.app.locals.storage?.getRecordingById?.(id);
    
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
    const success = await req.app.locals.storage?.deleteRecording?.(id);
    
    if (!success) {
      return res.status(500).json({ error: 'Не удалось удалить запись' });
    }
    
    res.status(204).end();
  } catch (error) {
    console.error(`[Admin API] Ошибка при удалении записи: ${error.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * Получение фрагментов записи
 * GET /api/admin/recordings/:id/player-fragments
 */
router.get('/recordings/:id/player-fragments', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Некорректный ID записи' });
    }
    
    // Получаем запись из хранилища
    const recording = await req.app.locals.storage.getAdminRecordingById(id);
    
    if (!recording) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    
    // Получаем все фрагменты для данной записи, если они есть в хранилище
    const fragments = await req.app.locals.storage.getRecordingFragments(id) || [];
    
    // Фрагменты уже отсортированы по индексу в методе хранилища
    const sortedFragments = fragments;
    
    res.json(sortedFragments);
  } catch (error) {
    console.error(`[Admin API] Ошибка при получении фрагментов: ${error.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * Скачивание аудио файла
 * GET /api/recordings/:id/download
 */
router.get('/recordings/:id/download', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Некорректный ID записи' });
    }
    
    // Получаем запись из хранилища
    const recording = await req.app.locals.storage.getAdminRecordingById(id);
    
    if (!recording || !recording.filename) {
      return res.status(404).json({ error: 'Запись не найдена или не содержит файла' });
    }
    
    // Формируем список путей для поиска
    let possiblePaths = [
      path.join(process.cwd(), 'data', 'recordings', recording.filename)
    ];
    
    // Если в имени файла уже есть "combined-" - добавляем путь к server/fragments
    if (recording.filename.startsWith('combined-')) {
      possiblePaths.push(path.join(process.cwd(), 'server', 'fragments', recording.filename));
      possiblePaths.push(path.join(process.cwd(), 'data', 'fragments_symlink', recording.filename));
      console.log(`[Admin API] Файл записи имеет формат объединенного, добавляем пути к fragments`);
    }
    
    // Пробуем найти по ID сессии (если доступно)
    try {
      // Получаем фрагменты записи, чтобы узнать ID сессии
      const fragments = await req.app.locals.storage.getRecordingFragments(id);
      if (fragments && fragments.length > 0) {
        const sessionId = fragments[0].sessionId;
        const combinedFilename = `combined-${sessionId}.webm`;
        
        // Добавляем пути с объединенным файлом по ID сессии
        possiblePaths.push(path.join(process.cwd(), 'server', 'fragments', combinedFilename));
        possiblePaths.push(path.join(process.cwd(), 'data', 'fragments_symlink', combinedFilename));
        possiblePaths.push(path.join(process.cwd(), 'data', 'fragments', combinedFilename));
        
        console.log(`[Admin API] Добавлены пути для поиска объединенного файла по сессии: ${sessionId}`);
      }
    } catch (sessionError) {
      console.error(`[Admin API] Ошибка при поиске ID сессии: ${sessionError.message}`);
    }
    
    // Ищем файл в возможных местах
    let filePath = null;
    for (const checkPath of possiblePaths) {
      if (fs.existsSync(checkPath)) {
        filePath = checkPath;
        console.log(`[Admin API] Файл записи найден: ${filePath}`);
        break;
      }
    }
    
    if (!filePath) {
      filePath = possiblePaths[0]; // Для сообщения об ошибке используем первый путь
      console.log(`[Admin API] Не удалось найти файл записи, используем путь по умолчанию: ${filePath}`);
    }
    
    // Проверяем, существует ли файл
    if (!fs.existsSync(filePath)) {
      console.error(`[Admin API] Файл не найден по путям:
        - ${path.join(process.cwd(), 'data', 'recordings', recording.filename)}
        - ${filePath}`);
      return res.status(404).json({ error: 'Файл не найден' });
    }
    
    console.log(`[Admin API] Отправляем файл записи: ${filePath}`);
    
    // Отправляем файл
    res.download(filePath, recording.filename, (err) => {
      if (err) {
        console.error(`[Admin API] Ошибка отправки файла: ${err.message}`);
        
        // Если заголовки уже отправлены, не можем отправить статус ошибки
        if (!res.headersSent) {
          res.status(500).json({ error: 'Ошибка при скачивании файла' });
        }
      }
    });
  } catch (error) {
    console.error(`[Admin API] Ошибка при скачивании записи: ${error.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * Скачивание фрагмента записи
 * GET /api/admin/fragments/:id/download
 */
router.get('/fragments/:id/download', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Некорректный ID фрагмента' });
    }
    
    // Получаем фрагмент из хранилища
    const fragment = await req.app.locals.storage.getFragmentById(id);
    
    if (!fragment || !fragment.filename) {
      return res.status(404).json({ error: 'Фрагмент не найден или не содержит файла' });
    }
    
    // Пробуем найти в различных директориях
    const possiblePaths = [
      path.join(process.cwd(), 'data', 'fragments', fragment.filename),
      path.join(process.cwd(), 'server', 'fragments', fragment.filename),
      path.join(process.cwd(), 'data', 'fragments_symlink', fragment.filename)
    ];
    
    let filePath = null;
    for (const checkPath of possiblePaths) {
      if (fs.existsSync(checkPath)) {
        filePath = checkPath;
        console.log(`[Admin API] Файл фрагмента найден: ${filePath}`);
        break;
      }
    }
    
    if (!filePath) {
      filePath = possiblePaths[0]; // Для сообщения об ошибке используем первый путь
      console.log(`[Admin API] Не удалось найти файл фрагмента, используем путь по умолчанию: ${filePath}`);
    }
    
    // Проверяем, существует ли файл
    if (!fs.existsSync(filePath)) {
      console.error(`[Admin API] Файл фрагмента не найден по путям:
        - ${path.join(process.cwd(), 'data', 'fragments', fragment.filename)}
        - ${path.join(process.cwd(), 'server', 'fragments', fragment.filename)}`);
      return res.status(404).json({ error: 'Файл фрагмента не найден' });
    }
    
    console.log(`[Admin API] Отправляем фрагмент: ${filePath}`);
    
    // Отправляем файл
    res.download(filePath, fragment.filename, (err) => {
      if (err) {
        console.error(`[Admin API] Ошибка отправки файла фрагмента: ${err.message}`);
        
        // Если заголовки уже отправлены, не можем отправить статус ошибки
        if (!res.headersSent) {
          res.status(500).json({ error: 'Ошибка при скачивании файла фрагмента' });
        }
      }
    });
  } catch (error) {
    console.error(`[Admin API] Ошибка при скачивании фрагмента: ${error.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

export default router;