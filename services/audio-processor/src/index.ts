import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { transcribeAudio } from '../utils/openai';
import { optimizeAudioForTranscription, combineAudioFragments } from '../utils/audio';
import { getAudioDuration } from '../utils/ffmpeg';
import axios from 'axios';

// Настройка Express
const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

// Настройка multer для загрузки файлов
const uploadsDir = path.join(__dirname, '../uploads');
const fragmentsDir = path.join(__dirname, '../fragments');
const combinedDir = path.join(__dirname, '../combined');

fs.ensureDirSync(uploadsDir);
fs.ensureDirSync(fragmentsDir);
fs.ensureDirSync(combinedDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, fragmentsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// URL сервиса хранения данных
const DATA_STORAGE_URL = process.env.DATA_STORAGE_URL || 'http://localhost:3002';

// API для обработки фрагментов аудио
app.post('/api/process-fragment', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }
  
  try {
    const { index, sessionId, recordingId } = req.body;
    
    if (!index || !sessionId) {
      return res.status(400).json({ error: 'Требуются index и sessionId' });
    }
    
    // Сохраняем информацию о фрагменте в базу данных
    const fragmentData = {
      filename: req.file.filename,
      recordingId: recordingId ? parseInt(recordingId) : undefined,
      sessionId,
      index: parseInt(index),
      size: req.file.size
    };
    
    // Сохраняем фрагмент в сервисе хранения данных
    const response = await axios.post(`${DATA_STORAGE_URL}/api/recording-fragments`, fragmentData);
    
    res.status(201).json({ 
      id: response.data.id,
      filename: req.file.filename,
      size: req.file.size,
      index: parseInt(index),
      sessionId
    });
  } catch (error) {
    console.error('Ошибка обработки фрагмента:', error);
    res.status(500).json({ error: 'Ошибка обработки фрагмента' });
  }
});

// API для объединения фрагментов по sessionId
app.post('/api/combine-fragments', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Требуется sessionId' });
    }
    
    // Получаем все фрагменты для этой сессии из сервиса хранения данных
    const response = await axios.get(`${DATA_STORAGE_URL}/api/recording-fragments/session/${sessionId}`);
    const fragments = response.data;
    
    if (!fragments || fragments.length === 0) {
      return res.status(404).json({ error: 'Фрагменты не найдены' });
    }
    
    // Сортируем фрагменты по индексу
    fragments.sort((a, b) => a.index - b.index);
    
    // Пути к фрагментам
    const fragmentPaths = fragments.map(fragment => 
      path.join(fragmentsDir, fragment.filename)
    );
    
    // Объединяем фрагменты
    const outputFilename = `combined-${sessionId}-${Date.now()}.webm`;
    const outputPath = path.join(combinedDir, outputFilename);
    
    await combineAudioFragments(fragmentPaths, outputPath);
    
    // Оптимизируем аудио для транскрипции
    const optimizedFilePath = await optimizeAudioForTranscription(outputPath);
    
    // Получаем длительность аудио
    const duration = await getAudioDuration(optimizedFilePath);
    
    res.json({
      filename: outputFilename,
      path: outputPath,
      optimizedPath: optimizedFilePath,
      duration,
      fragments: fragments.length
    });
  } catch (error) {
    console.error('Ошибка объединения фрагментов:', error);
    res.status(500).json({ error: 'Ошибка объединения фрагментов' });
  }
});

// API для транскрипции аудио
app.post('/api/transcribe', async (req, res) => {
  try {
    const { filePath, recordingId } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'Требуется путь к файлу' });
    }
    
    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Файл не найден' });
    }
    
    // Получаем транскрипцию через OpenAI
    const result = await transcribeAudio(filePath);
    
    if (!result) {
      return res.status(500).json({ error: 'Ошибка транскрипции' });
    }
    
    // Если есть ID записи, обновляем её с транскрипцией
    if (recordingId) {
      try {
        const recording = await axios.get(`${DATA_STORAGE_URL}/api/admin-recordings/${recordingId}`);
        if (recording.data) {
          const updatedRecording = {
            ...recording.data,
            transcription: result.text,
            status: 'transcribed'
          };
          
          await axios.patch(`${DATA_STORAGE_URL}/api/admin-recordings/${recordingId}/status`, { 
            status: 'transcribed' 
          });
        }
      } catch (error) {
        console.error('Ошибка обновления записи:', error);
      }
    }
    
    res.json({
      text: result.text,
      cost: result.cost,
      tokensProcessed: result.tokensProcessed
    });
  } catch (error) {
    console.error('Ошибка транскрипции:', error);
    res.status(500).json({ error: 'Ошибка транскрипции' });
  }
});

// API для статуса сервиса
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'audio-processor' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Audio Processor service running on port ${PORT}`);
});