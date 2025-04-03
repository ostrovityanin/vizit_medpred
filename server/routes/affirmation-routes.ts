/**
 * Маршруты API для работы с аффирмациями
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Схема валидации для новой аффирмации
const AffirmationSchema = z.object({
  text: z.string().min(3, { message: 'Текст аффирмации должен содержать минимум 3 символа' }),
  recipientUsername: z.string().optional(),
  recipientId: z.string().optional(),
  authorUsername: z.string().optional(),
  authorId: z.string().optional(),
  messageId: z.string(),  // Уникальный ID сообщения для отслеживания
});

const CommentCheckSchema = z.object({
  commentId: z.string().min(1, { message: 'ID комментария обязателен' }),
});

type Affirmation = z.infer<typeof AffirmationSchema>;

// Путь к файлу для хранения информации об обработанных комментариях
// Корректное получение пути в ES модулях
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data/affirmations');
const PROCESSED_COMMENTS_FILE = path.join(DATA_DIR, 'processed_comments.json');

// Создаем директорию, если она не существует
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Загружаем информацию об уже обработанных комментариях
let processedComments = new Set<string>();
try {
  if (fs.existsSync(PROCESSED_COMMENTS_FILE)) {
    const data = JSON.parse(fs.readFileSync(PROCESSED_COMMENTS_FILE, 'utf8'));
    processedComments = new Set(data);
    console.log(`[Affirmation Routes] Загружено ${processedComments.size} обработанных комментариев`);
  } else {
    // Создаем пустой файл
    fs.writeFileSync(PROCESSED_COMMENTS_FILE, '[]', 'utf8');
    console.log('[Affirmation Routes] Создан новый файл для хранения обработанных комментариев');
  }
} catch (error) {
  console.error('[Affirmation Routes] Ошибка загрузки обработанных комментариев:', error);
  // Создаем пустой файл
  fs.writeFileSync(PROCESSED_COMMENTS_FILE, '[]', 'utf8');
}

/**
 * Сохраняет ID комментария как обработанный
 * @param commentId ID комментария
 */
function markCommentAsProcessed(commentId: string): void {
  try {
    if (!processedComments.has(commentId)) {
      processedComments.add(commentId);
      fs.writeFileSync(
        PROCESSED_COMMENTS_FILE,
        JSON.stringify(Array.from(processedComments)),
        'utf8'
      );
      console.log(`[Affirmation Routes] Комментарий ${commentId} добавлен в список обработанных`);
    }
  } catch (error) {
    console.error('[Affirmation Routes] Ошибка при сохранении обработанного комментария:', error);
  }
}

// Создаем роутер
const router = Router();

/**
 * Проверка, был ли комментарий обработан ранее
 * @route POST /api/affirmations/check-comment
 */
router.post('/check-comment', (req, res) => {
  try {
    // Валидируем входные данные
    const result = CommentCheckSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Неверные данные', 
        details: result.error.format() 
      });
    }
    
    const { commentId } = result.data;
    const isProcessed = processedComments.has(commentId);
    
    return res.json({ 
      commentId,
      isProcessed,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Affirmation Routes] Ошибка при проверке комментария:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * Пометить комментарий как обработанный
 * @route POST /api/affirmations/mark-processed
 */
router.post('/mark-processed', (req, res) => {
  try {
    // Валидируем входные данные
    const result = CommentCheckSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Неверные данные', 
        details: result.error.format() 
      });
    }
    
    const { commentId } = result.data;
    
    // Пометка комментария как обработанного
    markCommentAsProcessed(commentId);
    
    return res.json({ 
      success: true,
      commentId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Affirmation Routes] Ошибка при обработке комментария:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * Отправка новой аффирмации
 * @route POST /api/affirmations
 */
router.post('/', (req, res) => {
  try {
    // Валидируем входные данные
    const result = AffirmationSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Неверные данные', 
        details: result.error.format() 
      });
    }
    
    const affirmation = result.data;
    
    // Проверяем, был ли комментарий уже обработан
    if (processedComments.has(affirmation.messageId)) {
      return res.json({ 
        success: false,
        error: 'Комментарий уже был обработан',
        messageId: affirmation.messageId
      });
    }
    
    // Логгируем получение аффирмации и помечаем как обработанную
    console.log(`[Affirmation Routes] Получена новая аффирмация: ${JSON.stringify(affirmation)}`);
    markCommentAsProcessed(affirmation.messageId);
    
    // В реальном приложении здесь будет логика отправки аффирмации пользователю
    // Например, через микросервис аффирмаций или напрямую через Telegram API
    
    return res.json({ 
      success: true, 
      messageId: affirmation.messageId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Affirmation Routes] Ошибка при обработке аффирмации:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * Получение списка всех обработанных ID комментариев
 * @route GET /api/affirmations/processed
 */
router.get('/processed', (req, res) => {
  try {
    return res.json({
      count: processedComments.size,
      processed: Array.from(processedComments)
    });
  } catch (error) {
    console.error('[Affirmation Routes] Ошибка при получении списка обработанных комментариев:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

export default router;