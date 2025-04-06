/**
 * Маршруты API для работы с записями
 */

import express from 'express';
import { log } from '../vite.js';
import recordingModule from '../modules/recording/index.js';
import userModule from '../modules/user/index.js';
import { transcribe } from '../modules/transcription/index.js';
import fs from 'fs';

const router = express.Router();

// Эндпоинт для начала записи (создает запись со статусом "started")
router.post('/start', async (req, res) => {
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
      const recording = await recordingModule.startRecording({
        targetUsername,
        senderUsername
      });
      
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
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      });
    }
  } catch (error) {
    log(`Ошибка при обработке запроса на начало записи: ${error}`, 'recording');
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка при обработке запроса', 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
});

// Эндпоинт для загрузки фрагмента записи
router.post('/fragment', recordingModule.upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Не загружен аудиофайл' 
      });
    }
    
    const { recordingId, sessionId, index, duration } = req.body;
    
    if (!recordingId || !sessionId || index === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Не указаны обязательные параметры: recordingId, sessionId, index' 
      });
    }
    
    try {
      const fragmentData = {
        recordingId: parseInt(recordingId, 10),
        sessionId,
        index: parseInt(index, 10),
        audio: fs.readFileSync(req.file.path),
        duration: duration ? parseFloat(duration) : 0
      };
      
      // Добавляем фрагмент записи
      const fragment = await recordingModule.addRecordingFragment(fragmentData);
      
      // Удаляем временный файл
      fs.unlinkSync(req.file.path);
      
      res.status(201).json({
        success: true,
        message: `Фрагмент ${index} успешно добавлен`,
        fragment
      });
    } catch (error) {
      // Удаляем временный файл в случае ошибки
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      log(`Ошибка при добавлении фрагмента: ${error}`, 'recording');
      res.status(400).json({ 
        success: false, 
        message: 'Ошибка при добавлении фрагмента', 
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      });
    }
  } catch (error) {
    // Удаляем временный файл в случае ошибки
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    log(`Ошибка при загрузке фрагмента: ${error}`, 'recording');
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка при загрузке фрагмента', 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
});

// Эндпоинт для завершения записи
router.post('/:id/complete', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { sessionId, forceProcess = false } = req.body;
    
    try {
      // Завершаем запись и обрабатываем аудиофайл
      const recording = await recordingModule.completeRecording(id, { sessionId, forceProcess });
      
      // Если указан адресат, отправляем ему уведомление
      if (recording.targetUsername) {
        try {
          await userModule.notifyUserAboutNewRecording(recording.targetUsername, recording.id);
          log(`Отправлено уведомление пользователю ${recording.targetUsername} о новой записи`, 'recording');
        } catch (notifyError) {
          log(`Ошибка при отправке уведомления: ${notifyError}`, 'recording');
          // Игнорируем ошибку отправки уведомления
        }
      }
      
      res.json({
        success: true,
        message: 'Запись успешно завершена',
        recording
      });
    } catch (error) {
      log(`Ошибка при завершении записи: ${error}`, 'recording');
      res.status(400).json({ 
        success: false, 
        message: 'Ошибка при завершении записи', 
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      });
    }
  } catch (error) {
    log(`Ошибка при обработке запроса на завершение записи: ${error}`, 'recording');
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка при обработке запроса', 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
});

// Эндпоинт для загрузки готовой записи (устаревший, для совместимости)
router.post('/', recordingModule.upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Не загружен аудиофайл' 
      });
    }
    
    const { recordingId, targetUsername, senderUsername, duration, timestamp } = req.body;
    
    // Получаем размер файла
    let fileSize = 0;
    if (fs.existsSync(req.file.path)) {
      const stats = fs.statSync(req.file.path);
      fileSize = stats.size;
    }
    
    // Распознаем текст из аудио
    log('Начинаем распознавание речи...', 'recording');
    
    let transcriptionResult = null;
    try {
      transcriptionResult = await transcribe(req.file.path, { model: 'whisper-1', language: 'ru' });
      log(`Результат распознавания: ${transcriptionResult.text}`, 'recording');
    } catch (transcriptionError) {
      log(`Ошибка при распознавании речи: ${transcriptionError}`, 'recording');
      // Продолжаем выполнение без транскрипции
    }
    
    // Данные для создания или обновления записи
    const recordingData = {
      filename: req.file.filename,
      duration: parseInt(duration, 10) || 0,
      timestamp: timestamp || new Date().toISOString(),
      targetUsername,
      senderUsername: senderUsername || "Пользователь",
      fileSize,
      transcription: transcriptionResult ? transcriptionResult.text : null,
      transcriptionCost: transcriptionResult ? transcriptionResult.cost : 0,
      tokensProcessed: transcriptionResult ? transcriptionResult.tokensProcessed : 0,
      status: 'completed'
    };
    
    let recording;
    
    // Проверяем, существует ли начатая запись, которую нужно обновить
    if (recordingId) {
      try {
        const id = parseInt(recordingId, 10);
        const existingRecording = await recordingModule.getRecordingById(id);
        
        if (existingRecording && existingRecording.status === 'started') {
          log(`Найдена запись со статусом 'started' (ID: ${id}), обновляем...`, 'recording');
          
          // Создаем новую запись с отметкой о завершении
          recording = await storage.createRecording(recordingData);
          
          // Обновляем статус исходной записи
          await storage.updateRecordingStatus(id, 'completed');
          
          log(`Создана новая запись (ID: ${recording.id}) со статусом 'completed' на основе записи ${id}`, 'recording');
        } else {
          // Запись не найдена или уже имеет статус, отличный от 'started'
          log(`Запись с ID: ${recordingId} не найдена или уже не имеет статус 'started'`, 'recording');
          recording = await storage.createRecording(recordingData);
        }
      } catch (updateError) {
        log(`Ошибка при обновлении существующей записи: ${updateError}`, 'recording');
        recording = await storage.createRecording(recordingData);
      }
    } else {
      // Создаем новую запись, так как ID не предоставлен
      recording = await storage.createRecording(recordingData);
    }
    
    // Создаем записи для пользователей, если указаны username
    if (targetUsername) {
      try {
        await userModule.addUserRecording({
          adminRecordingId: recording.id,
          username: targetUsername,
          duration: parseInt(duration, 10) || 0,
          timestamp: timestamp || new Date().toISOString()
        });
        
        log(`Создана пользовательская запись для @${targetUsername}`, 'recording');
      } catch (createUserError) {
        log(`Ошибка при создании пользовательской записи: ${createUserError}`, 'recording');
        // Продолжаем выполнение, не прерываем основной процесс
      }
    }
    
    if (senderUsername && senderUsername !== "Пользователь") {
      try {
        await userModule.addUserRecording({
          adminRecordingId: recording.id,
          username: senderUsername,
          duration: parseInt(duration, 10) || 0,
          timestamp: timestamp || new Date().toISOString()
        });
        
        log(`Создана пользовательская запись для отправителя @${senderUsername}`, 'recording');
      } catch (createSenderError) {
        log(`Ошибка при создании пользовательской записи для отправителя: ${createSenderError}`, 'recording');
        // Продолжаем выполнение, не прерываем основной процесс
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'Запись успешно создана',
      recording
    });
  } catch (error) {
    // Удаляем временный файл в случае ошибки
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    log(`Ошибка при загрузке записи: ${error}`, 'recording');
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка при загрузке записи', 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
});

// Получение списка записей
router.get('/', async (req, res) => {
  try {
    const recordings = await recordingModule.getAllRecordings();
    res.json(recordings);
  } catch (error) {
    log(`Ошибка при получении списка записей: ${error}`, 'recording');
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка при получении списка записей', 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
});

// Получение записи по ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const recording = await recordingModule.getRecordingById(id);
    
    if (!recording) {
      return res.status(404).json({ 
        success: false, 
        message: 'Запись не найдена' 
      });
    }
    
    res.json({
      success: true,
      recording
    });
  } catch (error) {
    log(`Ошибка при получении записи: ${error}`, 'recording');
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка при получении записи', 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
});

// Удаление записи
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await recordingModule.deleteRecording(id);
    
    res.json({
      success: result,
      message: result ? `Запись с ID ${id} удалена` : `Не удалось удалить запись с ID ${id}`
    });
  } catch (error) {
    log(`Ошибка при удалении записи: ${error}`, 'recording');
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка при удалении записи', 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
});

export default router;