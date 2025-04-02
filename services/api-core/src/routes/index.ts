import { Express, Request, Response } from 'express';
import axios from 'axios';
import { upload } from '../index';

// URL-ы к другим микросервисам
const DATA_STORAGE_URL = process.env.DATA_STORAGE_URL || 'http://localhost:3002';
const AUDIO_PROCESSOR_URL = process.env.AUDIO_PROCESSOR_URL || 'http://localhost:3003';
const DOCUMENTATION_URL = process.env.DOCUMENTATION_URL || 'http://localhost:3004';

/**
 * Регистрирует все маршруты для API сервиса
 */
export function registerRoutes(app: Express) {
  // Общий эндпоинт для проверки работоспособности
  app.get('/health', async (req: Request, res: Response) => {
    try {
      // Проверяем статус всех сервисов
      const services = [
        { name: 'data-storage', url: `${DATA_STORAGE_URL}/health` },
        { name: 'audio-processor', url: `${AUDIO_PROCESSOR_URL}/health` },
        { name: 'documentation', url: `${DOCUMENTATION_URL}/health` }
      ];
      
      const results = await Promise.all(
        services.map(async (service) => {
          try {
            const response = await axios.get(service.url, { timeout: 1000 });
            return { 
              name: service.name, 
              status: response.status === 200 ? 'ok' : 'error',
              details: response.data
            };
          } catch (error) {
            return { 
              name: service.name, 
              status: 'error',
              error: error.message 
            };
          }
        })
      );
      
      res.json({
        status: 'ok',
        services: results
      });
    } catch (error) {
      res.status(500).json({ error: 'Error checking health status' });
    }
  });
  
  // API для записей
  
  // Создание новой записи (начало записи)
  app.post('/api/recordings/start', async (req: Request, res: Response) => {
    try {
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ error: 'Username is required' });
      }
      
      // Создаем новую запись в сервисе хранения данных
      const response = await axios.post(`${DATA_STORAGE_URL}/api/admin-recordings`, {
        filename: `recording-${Date.now()}.webm`,
        username,
        status: 'recording'
      });
      
      res.status(201).json(response.data);
    } catch (error) {
      res.status(500).json({ error: 'Error starting recording' });
    }
  });
  
  // Загрузка фрагмента аудио
  app.post('/api/recording-fragments', upload.single('fragmentAudio'), async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }
    
    try {
      const { index, sessionId, recordingId } = req.body;
      
      if (!index || !sessionId) {
        return res.status(400).json({ error: 'Index and sessionId are required' });
      }
      
      // Создаем FormData для отправки файла
      const formData = new FormData();
      formData.append('audio', new Blob([await fs.readFile(req.file.path)]), req.file.filename);
      formData.append('index', index);
      formData.append('sessionId', sessionId);
      
      if (recordingId) {
        formData.append('recordingId', recordingId);
      }
      
      // Отправляем фрагмент в сервис обработки аудио
      const response = await axios.post(`${AUDIO_PROCESSOR_URL}/api/process-fragment`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      res.status(201).json(response.data);
      
      // Удаляем временный файл
      await fs.remove(req.file.path).catch(() => {});
    } catch (error) {
      res.status(500).json({ error: 'Error processing audio fragment' });
    }
  });
  
  // Объединение фрагментов и финализация записи
  app.post('/api/recording-fragments/combine', async (req: Request, res: Response) => {
    try {
      const { sessionId, recordingId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'SessionId is required' });
      }
      
      // Отправляем запрос на объединение фрагментов в сервис обработки аудио
      const response = await axios.post(`${AUDIO_PROCESSOR_URL}/api/combine-fragments`, {
        sessionId
      });
      
      const { filename, path, optimizedPath, duration } = response.data;
      
      // Если есть ID записи, обновляем её
      if (recordingId) {
        await axios.patch(`${DATA_STORAGE_URL}/api/admin-recordings/${recordingId}/status`, {
          status: 'processing'
        });
        
        // Запрос на транскрипцию
        const transcriptionResponse = await axios.post(`${AUDIO_PROCESSOR_URL}/api/transcribe`, {
          filePath: optimizedPath,
          recordingId
        });
        
        const { text: transcription, cost, tokensProcessed } = transcriptionResponse.data;
        
        // Получаем запись
        const recordingResponse = await axios.get(`${DATA_STORAGE_URL}/api/admin-recordings/${recordingId}`);
        const recording = recordingResponse.data;
        
        // Обновляем запись с транскрипцией и длительностью
        await axios.patch(`${DATA_STORAGE_URL}/api/admin-recordings/${recordingId}/status`, {
          status: 'completed',
          duration,
          transcription
        });
        
        res.json({
          recordingId,
          filename,
          duration,
          transcription,
          cost,
          tokensProcessed,
          status: 'completed'
        });
      } else {
        res.json({
          filename,
          duration,
          path: optimizedPath,
          status: 'combined'
        });
      }
    } catch (error) {
      res.status(500).json({ error: 'Error combining fragments' });
    }
  });
  
  // Получение списка записей
  app.get('/api/recordings', async (req: Request, res: Response) => {
    try {
      const response = await axios.get(`${DATA_STORAGE_URL}/api/admin-recordings`);
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: 'Error getting recordings' });
    }
  });
  
  // Получение одной записи по ID
  app.get('/api/recordings/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const response = await axios.get(`${DATA_STORAGE_URL}/api/admin-recordings/${id}`);
      res.json(response.data);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return res.status(404).json({ error: 'Recording not found' });
      }
      res.status(500).json({ error: 'Error getting recording' });
    }
  });
  
  // Обновление статуса записи
  app.post('/api/recordings/:id/status', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const { status } = req.body;
      
      const response = await axios.patch(`${DATA_STORAGE_URL}/api/admin-recordings/${id}/status`, {
        status
      });
      
      res.json(response.data);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return res.status(404).json({ error: 'Recording not found' });
      }
      res.status(500).json({ error: 'Error updating recording status' });
    }
  });
  
  // Отметка записи как отправленной
  app.post('/api/recordings/:id/sent', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      
      const response = await axios.patch(`${DATA_STORAGE_URL}/api/admin-recordings/${id}/sent`, {});
      
      res.json(response.data);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return res.status(404).json({ error: 'Recording not found' });
      }
      res.status(500).json({ error: 'Error marking recording as sent' });
    }
  });
  
  // Перенаправление запросов документации
  app.get('/api/docs/*', async (req: Request, res: Response) => {
    try {
      const path = req.path.replace('/api/docs', '');
      const response = await axios.get(`${DOCUMENTATION_URL}/docs${path}`, {
        responseType: 'stream'
      });
      
      // Устанавливаем заголовки ответа
      response.headers['content-type'] && res.setHeader('Content-Type', response.headers['content-type']);
      response.headers['content-disposition'] && res.setHeader('Content-Disposition', response.headers['content-disposition']);
      
      // Передаем поток ответа
      response.data.pipe(res);
    } catch (error) {
      res.status(500).json({ error: 'Error getting documentation' });
    }
  });
  
  // Перенаправление запросов файлов
  app.get('/api/files/*', async (req: Request, res: Response) => {
    try {
      const path = req.path.replace('/api/files', '');
      const response = await axios.get(`${DOCUMENTATION_URL}/files${path}`, {
        responseType: 'stream'
      });
      
      // Устанавливаем заголовки ответа
      response.headers['content-type'] && res.setHeader('Content-Type', response.headers['content-type']);
      response.headers['content-disposition'] && res.setHeader('Content-Disposition', response.headers['content-disposition']);
      
      // Передаем поток ответа
      response.data.pipe(res);
    } catch (error) {
      res.status(500).json({ error: 'Error getting file' });
    }
  });
  
  // API для интеграции с Zepp OS
  
  // Загрузка фрагмента аудио с устройства Zepp
  app.post('/api/zepp/recording-fragments', upload.single('fragmentAudio'), async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }
    
    try {
      const { index, sessionId, deviceId } = req.body;
      
      if (!index || !sessionId) {
        return res.status(400).json({ error: 'Index and sessionId are required' });
      }
      
      // Создаем FormData для отправки файла
      const formData = new FormData();
      formData.append('audio', new Blob([await fs.readFile(req.file.path)]), req.file.filename);
      formData.append('index', index);
      formData.append('sessionId', sessionId);
      
      // Отправляем фрагмент в сервис обработки аудио
      const response = await axios.post(`${AUDIO_PROCESSOR_URL}/api/process-fragment`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      res.status(201).json(response.data);
      
      // Удаляем временный файл
      await fs.remove(req.file.path).catch(() => {});
    } catch (error) {
      res.status(500).json({ error: 'Error processing Zepp audio fragment' });
    }
  });
  
  // Финализация записи с устройства Zepp
  app.post('/api/zepp/finalize-recording', async (req: Request, res: Response) => {
    try {
      const { sessionId, username, deviceId } = req.body;
      
      if (!sessionId || !username) {
        return res.status(400).json({ error: 'SessionId and username are required' });
      }
      
      // Создаем новую запись
      const recordingResponse = await axios.post(`${DATA_STORAGE_URL}/api/admin-recordings`, {
        filename: `zepp-recording-${sessionId}.webm`,
        username,
        status: 'processing',
        zepp: true,
        zepp_device_id: deviceId || 'unknown'
      });
      
      const recordingId = recordingResponse.data.id;
      
      // Отправляем запрос на объединение фрагментов
      const combineResponse = await axios.post(`${AUDIO_PROCESSOR_URL}/api/combine-fragments`, {
        sessionId,
        recordingId
      });
      
      const { filename, path, optimizedPath, duration } = combineResponse.data;
      
      // Запрос на транскрипцию
      const transcriptionResponse = await axios.post(`${AUDIO_PROCESSOR_URL}/api/transcribe`, {
        filePath: optimizedPath,
        recordingId
      });
      
      const { text: transcription, cost, tokensProcessed } = transcriptionResponse.data;
      
      // Обновляем запись с транскрипцией и длительностью
      await axios.patch(`${DATA_STORAGE_URL}/api/admin-recordings/${recordingId}/status`, {
        status: 'completed',
        duration,
        transcription
      });
      
      res.json({
        recordingId,
        filename,
        duration,
        transcription,
        cost,
        tokensProcessed,
        status: 'completed'
      });
    } catch (error) {
      res.status(500).json({ error: 'Error finalizing Zepp recording' });
    }
  });
  
  // Обработка 404
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });
}