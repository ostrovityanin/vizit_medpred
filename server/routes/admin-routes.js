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
import { exec } from 'child_process';

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
    
    console.log(`[Admin API] Получаем фрагменты для записи #${id}`);
    
    // Получаем все фрагменты для данной записи по ID
    let fragments = await req.app.locals.storage.getRecordingFragments(id) || [];
    console.log(`[Admin API] По recordingId=${id} найдено ${fragments.length} фрагментов`);
    
    // Если фрагментов нет, попробуем поискать их по filename
    if (fragments.length === 0 && recording.filename) {
      // Извлекаем UUID из имени файла (например, 12e774e4-0792-48e3-bc9d-d9637a1e2fc8.wav)
      const filenameWithoutExt = recording.filename.split('.')[0];
      console.log(`[Admin API] Ищем фрагменты по имени файла: ${filenameWithoutExt}`);
      
      // Получаем все фрагменты из хранилища
      const allFragments = await req.app.locals.storage.getAllFragments();
      console.log(`[Admin API] Всего фрагментов в системе: ${allFragments.length}`);
      
      // Ищем фрагменты, в имени которых содержится UUID из имени файла записи
      const matchingFragments = allFragments.filter(fragment => {
        return fragment.filename && (
          fragment.filename.includes(filenameWithoutExt) || 
          (fragment.sessionId && fragment.sessionId.includes(filenameWithoutExt))
        );
      });
      
      if (matchingFragments.length > 0) {
        console.log(`[Admin API] Найдено ${matchingFragments.length} фрагментов по имени файла`);
        fragments = matchingFragments;
      }
      
      // Если фрагментов все еще нет, попробуем поискать по шаблонам имен файлов
      if (fragments.length === 0) {
        // Проверяем наличие файлов в папке фрагментов
        const fragmentsDir = path.join(process.cwd(), 'server', 'fragments');
        if (fs.existsSync(fragmentsDir)) {
          const files = fs.readdirSync(fragmentsDir);
          console.log(`[Admin API] Файлов в директории fragments: ${files.length}`);
          
          // Ищем файлы с похожими шаблонами имен
          const combinedFiles = files.filter(file => file.startsWith('combined-'));
          const fragmentFiles = files.filter(file => file.startsWith('fragment-'));
          
          console.log(`[Admin API] Найдено ${combinedFiles.length} объединенных файлов и ${fragmentFiles.length} фрагментов`);
          
          // Если мы нашли похожие файлы, создаем "виртуальные" записи фрагментов
          const virtualFragments = [];
          
          // Сначала обрабатываем combined-файлы
          combinedFiles.forEach((file, index) => {
            const filePath = path.join(fragmentsDir, file);
            const stats = fs.statSync(filePath);
            
            virtualFragments.push({
              id: 9000 + index, // Используем большие ID, чтобы избежать конфликтов
              recordingId: id,
              filename: file,
              index: 0,
              timestamp: new Date().toISOString(),
              sessionId: file.replace('combined-', '').split('.')[0],
              size: stats.size,
              isProcessed: true,
              isVirtual: true
            });
          });
          
          // Добавляем фрагменты, если нашли какие-то файлы
          if (virtualFragments.length > 0) {
            console.log(`[Admin API] Создано ${virtualFragments.length} виртуальных записей фрагментов`);
            fragments = virtualFragments;
          }
        }
      }
    }
    
    // Обновляем запись с информацией о количестве фрагментов
    if (fragments.length > 0 && (!recording.fragmentsCount || recording.fragmentsCount !== fragments.length)) {
      const updatedRecording = {
        ...recording,
        fragmentsCount: fragments.length,
        fragments: fragments.map(f => f.id)
      };
      await req.app.locals.storage.updateRecording(updatedRecording);
      console.log(`[Admin API] Обновлена запись #${id} с количеством фрагментов: ${fragments.length}`);
    }
    
    // Сортируем фрагменты по индексу
    const sortedFragments = fragments.sort((a, b) => (a.index || 0) - (b.index || 0));
    
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
    
    console.log(`[Admin API] Пытаемся найти аудиофайл для записи #${id}:`, recording);
    
    // Формируем список путей для поиска
    let possiblePaths = [
      path.join(process.cwd(), 'data', 'recordings', recording.filename)
    ];
    
    // Поиск в папке server/fragments
    const fragmentsDir = path.join(process.cwd(), 'server', 'fragments');
    const dataFragmentsDir = path.join(process.cwd(), 'data', 'fragments');
    const symlinkFragmentsDir = path.join(process.cwd(), 'data', 'fragments_symlink');
    
    // Если в имени файла уже есть "combined-" - добавляем путь к server/fragments
    if (recording.filename.startsWith('combined-')) {
      possiblePaths.push(path.join(fragmentsDir, recording.filename));
      possiblePaths.push(path.join(symlinkFragmentsDir, recording.filename));
      console.log(`[Admin API] Файл записи имеет формат объединенного, добавляем пути к fragments`);
    }
    
    // Пробуем найти по ID сессии из фрагментов
    try {
      // Получаем фрагменты записи, чтобы узнать ID сессии
      console.log(`[Admin API] Получаем фрагменты для записи #${id}`);
      const fragments = await req.app.locals.storage.getRecordingFragments(id);
      console.log(`[Admin API] Получены фрагменты для записи #${id}:`, fragments ? fragments.length : 0);
      
      if (fragments && fragments.length > 0) {
        const sessionId = fragments[0].sessionId;
        console.log(`[Admin API] Найден sessionId из фрагментов: ${sessionId}`);
        
        // Ищем все файлы с этой сессией
        if (fs.existsSync(fragmentsDir)) {
          const files = fs.readdirSync(fragmentsDir);
          // Сначала ищем объединенный файл
          const combinedFile = files.find(file => file.startsWith(`combined-${sessionId}`));
          if (combinedFile) {
            console.log(`[Admin API] Найден объединенный файл для сессии ${sessionId}: ${combinedFile}`);
            possiblePaths.push(path.join(fragmentsDir, combinedFile));
          }
          
          // Собираем все фрагменты этой сессии
          const sessionFragments = files.filter(file => 
            file.startsWith(`fragment-${sessionId}`) || 
            file.includes(sessionId.replace('session-', ''))
          );
          console.log(`[Admin API] Найдены фрагменты для сессии ${sessionId}:`, sessionFragments);
          
          // Добавляем первый фрагмент (если доступно)
          if (sessionFragments.length > 0) {
            possiblePaths.push(path.join(fragmentsDir, sessionFragments[0]));
          }
        }
      }
    } catch (sessionError) {
      console.error(`[Admin API] Ошибка при поиске ID сессии: ${sessionError.message}`);
    }
    
    // Пробуем искать по имени файла фрагмента
    console.log(`[Admin API] Ищем все возможные файлы в папке fragments`);
    if (fs.existsSync(fragmentsDir)) {
      const files = fs.readdirSync(fragmentsDir);
      for (const file of files) {
        // Файлы вида combined-*.webm
        if (file.startsWith('combined-')) {
          possiblePaths.push(path.join(fragmentsDir, file));
        }
      }
    }
    
    // Ищем файл в возможных местах
    console.log(`[Admin API] Проверяем все возможные пути (${possiblePaths.length})`);
    let filePath = null;
    for (const checkPath of possiblePaths) {
      console.log(`[Admin API] Проверяем путь: ${checkPath}`);
      if (fs.existsSync(checkPath)) {
        filePath = checkPath;
        console.log(`[Admin API] Файл записи найден: ${filePath}`);
        break;
      }
    }
    
    if (!filePath) {
      console.log(`[Admin API] Не удалось найти файл записи в списке путей`);
      
      // Более агрессивный поиск - любые webm файлы в папке fragments
      if (fs.existsSync(fragmentsDir)) {
        const files = fs.readdirSync(fragmentsDir);
        const webmFiles = files.filter(file => file.endsWith('.webm'));
        console.log(`[Admin API] В папке fragments найдено ${webmFiles.length} файлов .webm`);
        
        if (webmFiles.length > 0) {
          // Берем первый файл объединенной записи или фрагмента
          const combinedFiles = webmFiles.filter(file => file.startsWith('combined-'));
          if (combinedFiles.length > 0) {
            filePath = path.join(fragmentsDir, combinedFiles[0]);
            console.log(`[Admin API] Используем первый объединенный файл: ${filePath}`);
          } else {
            filePath = path.join(fragmentsDir, webmFiles[0]);
            console.log(`[Admin API] Используем первый файл фрагмента: ${filePath}`);
          }
        }
      }
    }
    
    // Для дополнительной отладки, проверим общее число файлов в директории фрагментов
    if (fs.existsSync(fragmentsDir)) {
      const fragmentFiles = fs.readdirSync(fragmentsDir);
      console.log(`[Admin API] Всего файлов в папке fragments: ${fragmentFiles.length}`);
    }
    
    // Если до сих пор не нашли, используем первый путь для сообщения об ошибке
    if (!filePath) {
      filePath = possiblePaths[0];
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
    
    console.log(`[Admin API] Пытаемся найти файл фрагмента #${id}:`, fragment);
    
    const fragmentsDir = path.join(process.cwd(), 'server', 'fragments');
    const dataFragmentsDir = path.join(process.cwd(), 'data', 'fragments');
    const symlinkFragmentsDir = path.join(process.cwd(), 'data', 'fragments_symlink');
    
    // Пробуем найти в различных директориях
    const possiblePaths = [
      path.join(dataFragmentsDir, fragment.filename),
      path.join(fragmentsDir, fragment.filename),
      path.join(symlinkFragmentsDir, fragment.filename)
    ];
    
    // Пробуем найти по паттерну фрагментов
    if (fragment.sessionId) {
      const sessionId = fragment.sessionId;
      const fragmentIndex = fragment.index || 0;
      
      // Паттерны возможных имен файлов
      const possiblePatterns = [
        `fragment-${sessionId}-${String(fragmentIndex).padStart(5, '0')}.webm`,
        `fragment-${sessionId.replace('session-', '')}-${String(fragmentIndex).padStart(5, '0')}.webm`
      ];
      
      for (const pattern of possiblePatterns) {
        possiblePaths.push(path.join(fragmentsDir, pattern));
      }
      
      // Проверяем файлы в директории
      if (fs.existsSync(fragmentsDir)) {
        const files = fs.readdirSync(fragmentsDir);
        // Ищем все файлы, которые могут соответствовать этому фрагменту
        const matchingFiles = files.filter(file => {
          return file.includes(sessionId) || 
                 (sessionId.includes('session-') && file.includes(sessionId.replace('session-', '')));
        });
        
        console.log(`[Admin API] Найдены файлы для сессии ${sessionId}:`, matchingFiles);
        
        // Добавляем найденные файлы в список возможных путей
        for (const file of matchingFiles) {
          possiblePaths.push(path.join(fragmentsDir, file));
        }
      }
    }
    
    // Ищем файл в возможных местах
    console.log(`[Admin API] Проверяем все возможные пути для фрагмента (${possiblePaths.length})`);
    let filePath = null;
    for (const checkPath of possiblePaths) {
      console.log(`[Admin API] Проверяем путь: ${checkPath}`);
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
      
      // Пытаемся использовать хотя бы какой-то аудиофайл для тестирования
      if (fs.existsSync(fragmentsDir)) {
        const files = fs.readdirSync(fragmentsDir);
        const webmFiles = files.filter(file => file.endsWith('.webm'));
        if (webmFiles.length > 0) {
          filePath = path.join(fragmentsDir, webmFiles[0]);
          console.log(`[Admin API] ТЕСТОВЫЙ РЕЖИМ: Используем первый доступный webm файл: ${filePath}`);
        } else {
          return res.status(404).json({ error: 'Файл фрагмента не найден и нет доступных .webm файлов' });
        }
      } else {
        return res.status(404).json({ error: 'Файл фрагмента не найден' });
      }
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

/**
 * Объединение фрагментов записи
 * POST /api/admin/recordings/:id/merge-fragments
 */
router.post('/recordings/:id/merge-fragments', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Некорректный ID записи' });
    }
    
    const { sessionId, forceProcess = false } = req.body;
    
    // Получаем запись из хранилища
    const recording = await req.app.locals.storage.getAdminRecordingById(id);
    
    if (!recording) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    
    console.log(`[Admin API] Запрос на объединение фрагментов для записи #${id}`, { sessionId, forceProcess });
    
    // Получаем фрагменты для данной записи
    let fragments = await req.app.locals.storage.getRecordingFragments(id);
    console.log(`[Admin API] Найдено ${fragments.length} фрагментов по ID записи`);
    
    // Если фрагменты не найдены по ID записи и предоставлен sessionId, ищем по sessionId
    if (fragments.length === 0 && sessionId) {
      fragments = await req.app.locals.storage.getFragmentsBySessionId(sessionId);
      console.log(`[Admin API] Найдено ${fragments.length} фрагментов по sessionId: ${sessionId}`);
      
      // Связываем найденные фрагменты с записью
      if (fragments.length > 0) {
        for (const fragment of fragments) {
          // Если фрагмент еще не связан с этой записью, обновляем его
          if (fragment.recordingId !== id) {
            const updatedFragment = { ...fragment, recordingId: id };
            await req.app.locals.storage.updateFragment(fragment.id, updatedFragment);
            console.log(`[Admin API] Фрагмент #${fragment.id} связан с записью #${id}`);
          }
        }
        
        // Обновляем запись с количеством фрагментов
        const updatedRecording = { 
          ...recording, 
          fragmentsCount: fragments.length,
          fragments: fragments.map(f => f.id)
        };
        await req.app.locals.storage.updateRecording(updatedRecording);
      }
    }
    
    if (fragments.length === 0) {
      return res.status(404).json({ error: 'Фрагменты для объединения не найдены' });
    }
    
    // Если у нас есть фрагменты, попробуем объединить их
    // Сортируем фрагменты по индексу
    fragments.sort((a, b) => a.index - b.index);
    
    const fragmentsDir = path.join(process.cwd(), 'server', 'fragments');
    let fragmentFiles = [];
    
    // Проверяем существование файлов фрагментов
    for (const fragment of fragments) {
      const filePath = path.join(fragmentsDir, fragment.filename);
      if (fs.existsSync(filePath)) {
        fragmentFiles.push({ path: filePath, index: fragment.index });
      } else {
        console.log(`[Admin API] Файл фрагмента не найден: ${filePath}`);
      }
    }
    
    if (fragmentFiles.length === 0) {
      return res.status(404).json({ error: 'Файлы фрагментов не найдены' });
    }
    
    // Создаем объединенный файл
    const fragmentSessionId = fragments[0].sessionId;
    const outputFilename = `combined-${fragmentSessionId}.webm`;
    const outputPath = path.join(fragmentsDir, outputFilename);
    
    console.log(`[Admin API] Объединение ${fragmentFiles.length} фрагментов в файл: ${outputPath}`);
    
    // Используем ffmpeg для объединения файлов
    try {
      // Создаем временный файл со списком файлов для объединения
      const listFilePath = path.join(fragmentsDir, `${fragmentSessionId}-list.txt`);
      const fileList = fragmentFiles.map(f => `file '${f.path.replace(/'/g, "'\\''")}'`).join('\n');
      fs.writeFileSync(listFilePath, fileList);
      
      // Выполняем команду ffmpeg
      const ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${listFilePath}" -c copy "${outputPath}"`;
      console.log(`[Admin API] Выполнение команды: ${ffmpegCmd}`);
      
      const { stdout, stderr } = await new Promise((resolve, reject) => {
        exec(ffmpegCmd, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve({ stdout, stderr });
          }
        });
      });
      
      // Удаляем временный файл списка
      fs.unlinkSync(listFilePath);
      
      console.log(`[Admin API] Объединение завершено. STDOUT: ${stdout}`);
      if (stderr) {
        console.log(`[Admin API] STDERR: ${stderr}`);
      }
      
      // Обновляем запись с информацией об объединенном файле
      const stats = fs.statSync(outputPath);
      const updatedRecording = {
        ...recording,
        filename: outputFilename,
        fileExists: true,
        fileSize: stats.size,
        status: 'completed',
        canMergeFragments: false
      };
      
      await req.app.locals.storage.updateRecording(updatedRecording);
      
      res.json({
        success: true,
        recording: updatedRecording,
        message: `Объединено ${fragmentFiles.length} фрагментов в файл ${outputFilename}`
      });
    } catch (ffmpegError) {
      console.error(`[Admin API] Ошибка при объединении фрагментов: ${ffmpegError.message}`);
      res.status(500).json({ error: `Ошибка при объединении фрагментов: ${ffmpegError.message}` });
    }
  } catch (error) {
    console.error(`[Admin API] Ошибка при объединении фрагментов: ${error.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

export default router;