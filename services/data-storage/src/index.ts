import express from 'express';
import { memoryStorage } from '../repositories/memory-storage';
import { insertAdminRecordingSchema, insertRecordingFragmentSchema, insertUserRecordingSchema } from '../models/schema';
import { z } from 'zod';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// API эндпоинты для админских записей
app.post('/api/admin-recordings', async (req, res) => {
  try {
    const validatedData = insertAdminRecordingSchema.parse(req.body);
    const recording = await memoryStorage.createAdminRecording(validatedData);
    res.status(201).json(recording);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.get('/api/admin-recordings', async (req, res) => {
  try {
    const recordings = await memoryStorage.getAdminRecordings();
    res.json(recordings);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin-recordings/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const recording = await memoryStorage.getAdminRecordingById(id);
    if (recording) {
      res.json(recording);
    } else {
      res.status(404).json({ error: 'Recording not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/admin-recordings/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const recording = await memoryStorage.updateAdminRecordingStatus(id, status);
    if (recording) {
      res.json(recording);
    } else {
      res.status(404).json({ error: 'Recording not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/admin-recordings/:id/sent', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const recording = await memoryStorage.markAdminRecordingAsSent(id);
    if (recording) {
      res.json(recording);
    } else {
      res.status(404).json({ error: 'Recording not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API эндпоинты для пользовательских записей
app.post('/api/user-recordings', async (req, res) => {
  try {
    const validatedData = insertUserRecordingSchema.parse(req.body);
    const recording = await memoryStorage.createUserRecording(validatedData);
    res.status(201).json(recording);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.get('/api/user-recordings/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const recordings = await memoryStorage.getUserRecordings(username);
    res.json(recordings);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/user-recordings/id/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const recording = await memoryStorage.getUserRecordingById(id);
    if (recording) {
      res.json(recording);
    } else {
      res.status(404).json({ error: 'Recording not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/user-recordings/:id/sent', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const recording = await memoryStorage.markUserRecordingAsSent(id);
    if (recording) {
      res.json(recording);
    } else {
      res.status(404).json({ error: 'Recording not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API эндпоинты для фрагментов записей
app.post('/api/recording-fragments', async (req, res) => {
  try {
    const validatedData = insertRecordingFragmentSchema.parse(req.body);
    const fragment = await memoryStorage.createRecordingFragment(validatedData);
    res.status(201).json(fragment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.get('/api/recording-fragments/recording/:recordingId', async (req, res) => {
  try {
    const recordingId = parseInt(req.params.recordingId);
    const fragments = await memoryStorage.getRecordingFragments(recordingId);
    res.json(fragments);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/recording-fragments/session/:sessionId', async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const fragments = await memoryStorage.getFragmentsBySessionId(sessionId);
    res.json(fragments);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/recording-fragments/:id/processed', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const fragment = await memoryStorage.markFragmentAsProcessed(id);
    if (fragment) {
      res.json(fragment);
    } else {
      res.status(404).json({ error: 'Fragment not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Для проверки статуса сервиса
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'data-storage' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Data Storage service running on port ${PORT}`);
});