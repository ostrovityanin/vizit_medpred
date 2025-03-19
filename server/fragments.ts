import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import { log } from './vite';
import { eventLogger } from './event-logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import { storage } from './storage';
import { InsertRecordingFragment } from '@shared/schema';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Интерфейс фрагмента записи
 */
interface RecordingFragment {
  filename: string;
  index: number;
  timestamp: number;
  sessionId: string;
  size: number;
}

/**
 * Менеджер работы с фрагментами аудиозаписей
 */
class FragmentManager {
  private fragments: Map<string, RecordingFragment[]>;
  private fragmentsDir: string;
  
  constructor() {
    this.fragments = new Map<string, RecordingFragment[]>();
    this.fragmentsDir = path.join(__dirname, 'fragments');
    
    // Создаем директорию для фрагментов, если ее нет
    if (!fs.existsSync(this.fragmentsDir)) {
      fs.mkdirSync(this.fragmentsDir, { recursive: true });
    }
  }
  
  /**
   * Сохраняет фрагмент записи
   */
  public async saveFragment(
    buffer: Buffer, 
    index: number, 
    timestamp: number, 
    sessionId: string,
    recordingId?: number
  ): Promise<RecordingFragment> {
    // Создаем имя файла для фрагмента
    const filename = `fragment-${sessionId}-${index.toString().padStart(5, '0')}.webm`;
    const fullPath = path.join(this.fragmentsDir, filename);
    
    // Сохраняем файл
    await fs.promises.writeFile(fullPath, buffer);
    
    // Получаем размер файла
    const stats = await fs.promises.stat(fullPath);
    
    // Создаем объект фрагмента
    const fragment: RecordingFragment = {
      filename,
      index,
      timestamp,
      sessionId,
      size: stats.size
    };
    
    // Добавляем фрагмент в коллекцию по sessionId для обратной совместимости
    if (!this.fragments.has(sessionId)) {
      this.fragments.set(sessionId, []);
    }
    
    this.fragments.get(sessionId)?.push(fragment);
    
    // Сохраняем фрагмент в базу данных, если указан ID записи
    if (recordingId) {
      try {
        const fragmentData: InsertRecordingFragment = {
          recordingId,
          filename,
          index,
          timestamp,
          sessionId,
          size: stats.size,
          processed: false
        };
        
        await storage.createRecordingFragment(fragmentData);
        log(`Фрагмент #${index} сессии ${sessionId} сохранен в базу данных`, 'fragments');
      } catch (error) {
        log(`Ошибка при сохранении фрагмента в базу данных: ${error}`, 'fragments');
      }
    }
    
    // Логируем событие
    log(`Сохранен фрагмент #${index} сессии ${sessionId}, размер: ${stats.size} байт`, 'fragments');
    eventLogger.logEvent('system', 'FRAGMENT_SAVED', { 
      sessionId, 
      index, 
      size: stats.size,
      recordingId
    });
    
    return fragment;
  }
  
  /**
   * Возвращает все фрагменты для указанной сессии
   */
  public async getSessionFragments(sessionId: string): Promise<RecordingFragment[]> {
    try {
      // Пытаемся получить фрагменты из базы данных
      const dbFragments = await storage.getFragmentsBySessionId(sessionId);
      
      if (dbFragments && dbFragments.length > 0) {
        log(`Получены фрагменты из базы данных для сессии ${sessionId}: ${dbFragments.length} шт.`, 'fragments');
        
        // Преобразуем формат данных из БД в локальный формат
        return dbFragments.map(fragment => ({
          filename: fragment.filename,
          index: fragment.index,
          timestamp: fragment.timestamp,
          sessionId: fragment.sessionId,
          size: fragment.size
        })).sort((a, b) => a.index - b.index);
      }
    } catch (error) {
      log(`Ошибка при получении фрагментов из базы данных: ${error}`, 'fragments');
    }
    
    // Если из БД получить не удалось, используем локальное хранилище (для обратной совместимости)
    const fragments = this.fragments.get(sessionId) || [];
    log(`Используем локальное хранилище для сессии ${sessionId}: ${fragments.length} фрагментов`, 'fragments');
    
    // Сортируем фрагменты по индексу
    return fragments.sort((a, b) => a.index - b.index);
  }
  
  /**
   * Объединяет все фрагменты сессии в один файл
   */
  public async combineFragments(sessionId: string): Promise<Buffer | null> {
    // Получаем фрагменты для сессии
    const fragments = await this.getSessionFragments(sessionId);
    
    if (!fragments || fragments.length === 0) {
      log(`Нет фрагментов для сессии ${sessionId}`, 'fragments');
      return null;
    }
    
    log(`Объединение ${fragments.length} фрагментов для сессии ${sessionId}`, 'fragments');
    
    // Создаем буфер для объединенного файла
    const buffers: Buffer[] = [];
    
    // Читаем все файлы фрагментов
    for (const fragment of fragments) {
      const filePath = path.join(this.fragmentsDir, fragment.filename);
      
      try {
        const fileBuffer = await fs.promises.readFile(filePath);
        buffers.push(fileBuffer);
      } catch (error) {
        log(`Ошибка чтения фрагмента ${fragment.filename}: ${error}`, 'fragments');
      }
    }
    
    // Если нет фрагментов для объединения
    if (buffers.length === 0) {
      return null;
    }
    
    // Объединяем буферы
    const combinedBuffer = Buffer.concat(buffers);
    
    // Сохраняем объединенный файл
    const combinedFilename = `combined-${sessionId}.webm`;
    const combinedPath = path.join(this.fragmentsDir, combinedFilename);
    
    await fs.promises.writeFile(combinedPath, combinedBuffer);
    
    // Логируем событие
    log(`Создан объединенный файл ${combinedFilename}, размер: ${combinedBuffer.length} байт`, 'fragments');
    eventLogger.logEvent('system', 'FRAGMENTS_COMBINED', { 
      sessionId, 
      fragmentCount: fragments.length,
      combinedSize: combinedBuffer.length 
    });
    
    // Помечаем фрагменты как обработанные в базе данных
    try {
      const dbFragments = await storage.getFragmentsBySessionId(sessionId);
      for (const fragment of dbFragments) {
        await storage.markFragmentAsProcessed(fragment.id);
        log(`Фрагмент #${fragment.index} (ID: ${fragment.id}) помечен как обработанный`, 'fragments');
      }
    } catch (error) {
      log(`Ошибка при обновлении статуса фрагментов: ${error}`, 'fragments');
    }
    
    return combinedBuffer;
  }
  
  /**
   * Возвращает объединенный файл как буфер
   */
  public async getCombinedFile(sessionId: string): Promise<Buffer | null> {
    // Проверяем, существует ли уже объединенный файл
    const combinedFilename = `combined-${sessionId}.webm`;
    const combinedPath = path.join(this.fragmentsDir, combinedFilename);
    
    if (fs.existsSync(combinedPath)) {
      try {
        // Возвращаем уже существующий объединенный файл
        return await fs.promises.readFile(combinedPath);
      } catch (error) {
        log(`Ошибка чтения объединенного файла ${combinedFilename}: ${error}`, 'fragments');
      }
    }
    
    // Если файл не найден, объединяем фрагменты
    return await this.combineFragments(sessionId);
  }
  
  /**
   * Конвертирует WebM файл в WAV формат, поддерживаемый OpenAI API
   */
  public async convertToWav(input: string, output: string): Promise<boolean> {
    try {
      log(`Конвертация файла ${input} в формат WAV`, 'fragments');
      
      // Используем FFmpeg для конвертации
      const command = `ffmpeg -i "${input}" -ar 44100 -ac 1 "${output}" -y`;
      await execAsync(command);
      
      const stats = await fs.promises.stat(output);
      log(`Конвертация успешна, размер файла: ${stats.size} байт`, 'fragments');
      
      return true;
    } catch (error) {
      log(`Ошибка при конвертации аудио: ${error}`, 'fragments');
      return false;
    }
  }

  /**
   * Конвертирует объединенный файл WebM в формат WAV и копирует в директорию uploads
   */
  public async convertCombinedToWav(sessionId: string, recordingId?: string | number): Promise<string | null> {
    try {
      const combinedFilename = `combined-${sessionId}.webm`;
      const combinedPath = path.join(this.fragmentsDir, combinedFilename);
      
      if (!fs.existsSync(combinedPath)) {
        log(`Ошибка: Объединенный файл ${combinedFilename} не найден`, 'fragments');
        return null;
      }
      
      // Генерируем уникальное имя файла для WAV версии
      const uuid = crypto.randomUUID();
      const wavFilename = `${uuid}.wav`;
      const uploadsDir = path.join(__dirname, 'uploads');
      
      // Создаем директорию uploads, если она не существует
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const wavPath = path.join(uploadsDir, wavFilename);
      
      // Конвертируем файл
      const success = await this.convertToWav(combinedPath, wavPath);
      
      if (!success) {
        log(`Ошибка при конвертации файла ${combinedFilename} в WAV`, 'fragments');
        return null;
      }
      
      log(`Файл ${combinedFilename} успешно конвертирован в ${wavFilename}`, 'fragments');
      
      // Если указан ID записи, обновляем имя файла в базе данных
      if (recordingId) {
        try {
          const id = typeof recordingId === 'string' ? parseInt(recordingId, 10) : recordingId;
          const recording = await storage.getRecordingById(id);
          
          if (recording) {
            // Обновляем имя файла в записи
            recording.filename = wavFilename;
            
            // Обновляем статус записи
            await storage.updateRecordingStatus(id, 'completed');
            log(`Обновлен статус записи с ID: ${id} на 'completed' при объединении фрагментов`, 'recording');
          }
        } catch (error) {
          log(`Ошибка при обновлении записи: ${error}`, 'fragments');
        }
      }
      
      return wavFilename;
    } catch (error) {
      log(`Ошибка при конвертации аудио: ${error}`, 'fragments');
      return null;
    }
  }

  /**
   * Очищает временные файлы фрагментов для указанной сессии
   */
  public async cleanupSession(sessionId: string): Promise<void> {
    // Получаем фрагменты для сессии
    const fragments = await this.getSessionFragments(sessionId);
    
    if (fragments && fragments.length > 0) {
      // Удаляем каждый файл фрагмента
      for (const fragment of fragments) {
        const filePath = path.join(this.fragmentsDir, fragment.filename);
        
        try {
          await fs.promises.unlink(filePath);
        } catch (error) {
          log(`Ошибка при удалении фрагмента ${fragment.filename}: ${error}`, 'fragments');
        }
      }
    }
    
    // Удаляем объединенный файл если он существует
    const combinedFilename = `combined-${sessionId}.webm`;
    const combinedPath = path.join(this.fragmentsDir, combinedFilename);
    
    if (fs.existsSync(combinedPath)) {
      try {
        await fs.promises.unlink(combinedPath);
      } catch (error) {
        log(`Ошибка при удалении объединенного файла ${combinedFilename}: ${error}`, 'fragments');
      }
    }
    
    // Удаляем сессию из коллекции
    this.fragments.delete(sessionId);
    
    log(`Очищены все файлы фрагментов для сессии ${sessionId}`, 'fragments');
  }
}

// Экспортируем синглтон-экземпляр менеджера фрагментов
export const fragmentManager = new FragmentManager();