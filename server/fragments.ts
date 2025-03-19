import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { log } from './vite';
import { eventLogger } from './event-logger';

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
    sessionId: string
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
    
    // Добавляем фрагмент в коллекцию по sessionId
    if (!this.fragments.has(sessionId)) {
      this.fragments.set(sessionId, []);
    }
    
    this.fragments.get(sessionId)?.push(fragment);
    
    // Логируем событие
    log(`Сохранен фрагмент #${index} сессии ${sessionId}, размер: ${stats.size} байт`, 'fragments');
    eventLogger.logEvent('system', 'FRAGMENT_SAVED', { 
      sessionId, 
      index, 
      size: stats.size 
    });
    
    return fragment;
  }
  
  /**
   * Возвращает все фрагменты для указанной сессии
   */
  public getSessionFragments(sessionId: string): RecordingFragment[] {
    const fragments = this.fragments.get(sessionId) || [];
    
    // Сортируем фрагменты по индексу
    return fragments.sort((a, b) => a.index - b.index);
  }
  
  /**
   * Объединяет все фрагменты сессии в один файл
   */
  public async combineFragments(sessionId: string): Promise<Buffer | null> {
    const fragments = this.getSessionFragments(sessionId);
    
    if (fragments.length === 0) {
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
   * Очищает временные файлы фрагментов для указанной сессии
   */
  public async cleanupSession(sessionId: string): Promise<void> {
    const fragments = this.getSessionFragments(sessionId);
    
    // Удаляем каждый файл фрагмента
    for (const fragment of fragments) {
      const filePath = path.join(this.fragmentsDir, fragment.filename);
      
      try {
        await fs.promises.unlink(filePath);
      } catch (error) {
        log(`Ошибка при удалении фрагмента ${fragment.filename}: ${error}`, 'fragments');
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