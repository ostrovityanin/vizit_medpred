import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MemoryStore from 'memorystore';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { registerRoutes } from './routes';

// Инициализация Express
const app = express();
const PORT = process.env.PORT || 3001;

// Настройка CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Парсинг JSON и URL-encoded тел запросов
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Настройка сессий
const sessionStore = MemoryStore(session);
app.use(session({
  secret: process.env.SESSION_SECRET || 'recorder-secret-key',
  resave: false,
  saveUninitialized: false,
  store: new sessionStore({
    checkPeriod: 86400000 // Очистка устаревших сессий каждые 24 часа
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 дней
  }
}));

// Создание директории для загрузки файлов
const uploadsDir = path.join(__dirname, '../uploads');
fs.ensureDirSync(uploadsDir);

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

export const upload = multer({ storage });

// Статические файлы
app.use('/static', express.static(path.join(__dirname, '../public')));

// Регистрация всех маршрутов
registerRoutes(app);

// Обработка ошибок
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Запуск сервера
const server = app.listen(PORT, () => {
  console.log(`API Core service running on port ${PORT}`);
});

export default server;