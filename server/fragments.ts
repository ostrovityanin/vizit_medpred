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
  ): Promise<RecordingFragment | null> {
    try {
      // Проверяем входные данные
      if (!buffer || !sessionId) {
        log(`Ошибка: некорректные входные параметры для сохранения фрагмента`, 'fragments');
        return null;
      }
      
      // Проверяем существование директории
      if (!fs.existsSync(this.fragmentsDir)) {
        fs.mkdirSync(this.fragmentsDir, { recursive: true });
        log(`Создана директория для фрагментов: ${this.fragmentsDir}`, 'fragments');
      }
      
      // Создаем имя файла для фрагмента
      const filename = `fragment-${sessionId}-${index.toString().padStart(5, '0')}.webm`;
      const fullPath = path.join(this.fragmentsDir, filename);
      
      log(`Сохранение фрагмента #${index} сессии ${sessionId}`, 'fragments');
      
      // Сохраняем файл
      await fs.promises.writeFile(fullPath, buffer);
      
      // Получаем размер файла
      let fileSize = buffer.length; // Резервный размер
      try {
        const stats = await fs.promises.stat(fullPath);
        fileSize = stats.size;
      } catch (statError) {
        log(`Предупреждение: не удалось получить размер файла ${filename}: ${statError}`, 'fragments');
      }
      
      // Создаем объект фрагмента
      const fragment: RecordingFragment = {
        filename,
        index,
        timestamp,
        sessionId,
        size: fileSize
      };
      
      // Добавляем фрагмент в коллекцию по sessionId для обратной совместимости
      if (!this.fragments.has(sessionId)) {
        this.fragments.set(sessionId, []);
      }
      
      const fragments = this.fragments.get(sessionId);
      if (fragments) {
        fragments.push(fragment);
      }
      
      // Сохраняем фрагмент в базу данных, если указан ID записи
      if (recordingId) {
        try {
          const fragmentData: InsertRecordingFragment = {
            recordingId,
            filename,
            index,
            timestamp,
            sessionId,
            size: fileSize,
            processed: false
          };
          
          await storage.createRecordingFragment(fragmentData);
          log(`Фрагмент #${index} сессии ${sessionId} сохранен в базу данных`, 'fragments');
        } catch (error) {
          log(`Ошибка при сохранении фрагмента в базу данных: ${error}`, 'fragments');
          // Продолжаем работу даже если не удалось сохранить в БД
        }
      }
      
      // Логируем событие
      log(`Сохранен фрагмент #${index} сессии ${sessionId}, размер: ${fileSize} байт`, 'fragments');
      eventLogger.logEvent('system', 'FRAGMENT_SAVED', { 
        sessionId, 
        index, 
        size: fileSize,
        recordingId
      });
      
      return fragment;
    } catch (error) {
      log(`Критическая ошибка при сохранении фрагмента #${index} сессии ${sessionId}: ${error}`, 'fragments');
      return null;
    }
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
    try {
      if (!sessionId) {
        log(`Ошибка: попытка объединить фрагменты для пустого sessionId`, 'fragments');
        return null;
      }
      
      // Проверяем наличие директории для фрагментов
      if (!fs.existsSync(this.fragmentsDir)) {
        log(`Директория фрагментов не существует: ${this.fragmentsDir}, создаем...`, 'fragments');
        fs.mkdirSync(this.fragmentsDir, { recursive: true });
      }
      
      // Получаем фрагменты для сессии
      let fragments: RecordingFragment[] = [];
      try {
        fragments = await this.getSessionFragments(sessionId);
        log(`Получено ${fragments.length} фрагментов для объединения`, 'fragments');
      } catch (getFragmentsError) {
        log(`Ошибка при получении фрагментов для объединения: ${getFragmentsError}`, 'fragments');
        return null;
      }
      
      if (!fragments || fragments.length === 0) {
        log(`Нет фрагментов для сессии ${sessionId}`, 'fragments');
        return null;
      }
      
      // Сортируем фрагменты по индексу (для надежности)
      fragments.sort((a, b) => a.index - b.index);
      
      log(`Объединение ${fragments.length} фрагментов для сессии ${sessionId}`, 'fragments');
      
      // Создаем буфер для объединенного файла
      const buffers: Buffer[] = [];
      let successfulReads = 0;
      
      // Читаем все файлы фрагментов
      for (const fragment of fragments) {
        const filePath = path.join(this.fragmentsDir, fragment.filename);
        
        try {
          if (!fs.existsSync(filePath)) {
            log(`Предупреждение: файл фрагмента не найден: ${filePath}`, 'fragments');
            continue;
          }
          
          const stats = await fs.promises.stat(filePath);
          if (stats.size === 0) {
            log(`Предупреждение: пустой файл фрагмента: ${filePath}`, 'fragments');
            continue;
          }
          
          const fileBuffer = await fs.promises.readFile(filePath);
          if (fileBuffer.length === 0) {
            log(`Предупреждение: пустой буфер фрагмента: ${filePath}`, 'fragments');
            continue;
          }
          
          buffers.push(fileBuffer);
          successfulReads++;
          log(`Прочитан фрагмент #${fragment.index}, размер: ${fileBuffer.length} байт`, 'fragments');
        } catch (error) {
          log(`Ошибка чтения фрагмента ${fragment.filename}: ${error}`, 'fragments');
        }
      }
      
      // Если нет фрагментов для объединения
      if (buffers.length === 0) {
        log(`Нет данных для объединения, все фрагменты недоступны или пусты`, 'fragments');
        return null;
      }
      
      log(`Успешно прочитано ${successfulReads} из ${fragments.length} фрагментов`, 'fragments');
      
      // Объединяем буферы
      let combinedBuffer: Buffer;
      try {
        // Проверяем, что у нас есть буферы с контентом
        let validBuffers = buffers;
        if (buffers.some(b => b.length === 0)) {
          log(`Предупреждение: обнаружены пустые буферы в списке фрагментов`, 'fragments');
          // Удаляем пустые буферы
          validBuffers = buffers.filter(b => b.length > 0);
          log(`Отфильтровано ${buffers.length - validBuffers.length} пустых буферов`, 'fragments');
          // Используем validBuffers дальше
        }
        
        combinedBuffer = Buffer.concat(validBuffers);
        log(`Объединено ${buffers.length} буферов, общий размер: ${combinedBuffer.length} байт`, 'fragments');
        
        // Проверка на наличие WebM заголовка (WebM начинается с 0x1A45DFA3)
        const hasValidHeader = combinedBuffer.length > 4 && 
                             combinedBuffer[0] === 0x1A && 
                             combinedBuffer[1] === 0x45 && 
                             combinedBuffer[2] === 0xDF && 
                             combinedBuffer[3] === 0xA3;
        
        if (!hasValidHeader) {
          log(`Предупреждение: Объединенный буфер не содержит корректного WebM заголовка`, 'fragments');
        } else {
          log(`Объединенный буфер содержит корректный WebM заголовок`, 'fragments');
        }
      } catch (concatError) {
        log(`Ошибка при объединении буферов: ${concatError}`, 'fragments');
        return null;
      }
      
      // Сохраняем объединенный файл
      const combinedFilename = `combined-${sessionId}.webm`;
      const combinedPath = path.join(this.fragmentsDir, combinedFilename);
      
      try {
        await fs.promises.writeFile(combinedPath, combinedBuffer);
        log(`Успешно сохранен объединенный файл ${combinedFilename}, размер: ${combinedBuffer.length} байт`, 'fragments');
        
        // Проверяем целостность записанного файла
        const stats = await fs.promises.stat(combinedPath);
        if (stats.size !== combinedBuffer.length) {
          log(`Предупреждение: Размер записанного файла (${stats.size}) не соответствует размеру буфера (${combinedBuffer.length})`, 'fragments');
        }
      } catch (writeError) {
        log(`Ошибка при сохранении объединенного файла: ${writeError}`, 'fragments');
        // Продолжаем выполнение, так как у нас все еще есть combinedBuffer
      }
      
      // Логируем событие
      try {
        log(`Создан объединенный файл ${combinedFilename}, размер: ${combinedBuffer.length} байт`, 'fragments');
        eventLogger.logEvent('system', 'FRAGMENTS_COMBINED', { 
          sessionId, 
          fragmentCount: fragments.length,
          successfulFragments: successfulReads,
          combinedSize: combinedBuffer.length 
        });
      } catch (logError) {
        log(`Ошибка при логировании события объединения: ${logError}`, 'fragments');
        // Продолжаем выполнение даже при ошибке логирования
      }
      
      // Помечаем фрагменты как обработанные в базе данных
      try {
        const dbFragments = await storage.getFragmentsBySessionId(sessionId);
        log(`Найдено ${dbFragments.length} фрагментов в БД для маркировки как обработанные`, 'fragments');
        
        for (const fragment of dbFragments) {
          try {
            await storage.markFragmentAsProcessed(fragment.id);
            log(`Фрагмент #${fragment.index} (ID: ${fragment.id}) помечен как обработанный`, 'fragments');
          } catch (markError) {
            log(`Ошибка при маркировке фрагмента #${fragment.index}: ${markError}`, 'fragments');
            // Продолжаем с другими фрагментами
          }
        }
      } catch (dbError) {
        log(`Ошибка при обновлении статуса фрагментов в БД: ${dbError}`, 'fragments');
        // Продолжаем выполнение даже при ошибке работы с БД
      }
      
      return combinedBuffer;
    } catch (error) {
      log(`Критическая ошибка при объединении фрагментов для сессии ${sessionId}: ${error}`, 'fragments');
      return null;
    }
  }
  
  /**
   * Возвращает объединенный файл как буфер
   */
  public async getCombinedFile(sessionId: string): Promise<Buffer | null> {
    try {
      if (!sessionId) {
        log(`Ошибка: попытка получить объединенный файл для пустого sessionId`, 'fragments');
        return null;
      }
      
      log(`Запрос на получение объединенного файла для сессии ${sessionId}`, 'fragments');
      
      // Проверяем наличие директории для фрагментов
      if (!fs.existsSync(this.fragmentsDir)) {
        log(`Директория фрагментов не существует: ${this.fragmentsDir}, создаем...`, 'fragments');
        fs.mkdirSync(this.fragmentsDir, { recursive: true });
      }
      
      // Проверяем, существует ли уже объединенный файл
      const combinedFilename = `combined-${sessionId}.webm`;
      const combinedPath = path.join(this.fragmentsDir, combinedFilename);
      
      if (fs.existsSync(combinedPath)) {
        try {
          // Проверяем, что файл не пустой
          const stats = await fs.promises.stat(combinedPath);
          if (stats.size === 0) {
            log(`Предупреждение: объединенный файл ${combinedFilename} существует, но имеет нулевой размер`, 'fragments');
            // Удаляем пустой файл и создаем новый
            await fs.promises.unlink(combinedPath);
            return await this.combineFragments(sessionId);
          }
          
          // Возвращаем уже существующий объединенный файл
          const fileBuffer = await fs.promises.readFile(combinedPath);
          
          if (fileBuffer.length === 0) {
            log(`Предупреждение: объединенный файл ${combinedFilename} прочитан, но буфер пуст`, 'fragments');
            // Удаляем поврежденный файл и создаем новый
            await fs.promises.unlink(combinedPath);
            return await this.combineFragments(sessionId);
          }
          
          log(`Использован существующий объединенный файл ${combinedFilename}, размер: ${fileBuffer.length} байт`, 'fragments');
          return fileBuffer;
        } catch (error) {
          log(`Ошибка чтения объединенного файла ${combinedFilename}: ${error}`, 'fragments');
          // Если ошибка чтения, пробуем объединить заново
          log(`Повторное объединение фрагментов после ошибки чтения`, 'fragments');
          return await this.combineFragments(sessionId);
        }
      }
      
      log(`Объединенный файл не найден, запускаем объединение фрагментов`, 'fragments');
      
      // Если файл не найден, объединяем фрагменты
      const buffer = await this.combineFragments(sessionId);
      
      if (!buffer) {
        log(`Не удалось создать объединенный файл для сессии ${sessionId}`, 'fragments');
      } else {
        log(`Создан новый объединенный файл размером ${buffer.length} байт`, 'fragments');
      }
      
      return buffer;
    } catch (error) {
      log(`Критическая ошибка при получении объединенного файла для сессии ${sessionId}: ${error}`, 'fragments');
      return null;
    }
  }
  
  /**
   * Конвертирует WebM файл в WAV формат, поддерживаемый OpenAI API
   */
  public async convertToWav(input: string, output: string): Promise<boolean> {
    try {
      log(`Конвертация файла ${input} в формат WAV`, 'fragments');
      
      // Проверка существования исходного файла
      if (!fs.existsSync(input)) {
        log(`Ошибка: Исходный файл для конвертации не существует: ${input}`, 'fragments');
        return false;
      }
      
      // Проверка размера исходного файла
      const inputStats = await fs.promises.stat(input);
      if (inputStats.size === 0) {
        log(`Ошибка: Исходный файл для конвертации имеет нулевой размер: ${input}`, 'fragments');
        return false;
      }
      
      log(`Исходный файл проверен, размер: ${inputStats.size} байт`, 'fragments');
      
      // Используем более надежный набор параметров для FFmpeg с улучшенной обработкой аудио
      // -vn: отключаем обработку видео (если есть)
      // -acodec pcm_s16le: используем несжатый 16-bit PCM аудиокодек
      // -ar 16000: частота дискретизации 16kHz (рекомендуемая для OpenAI)
      // -ac 1: монофонический звук
      // -y: перезаписать файл, если существует
      // -af "highpass=f=50, lowpass=f=8000, volume=2, dynaudnorm" - улучшение аудио для распознавания
      //     - highpass: убирает низкочастотный шум (ниже 50 Гц)
      //     - lowpass: фокусируется на речевом диапазоне (до 8000 Гц)
      //     - volume: увеличивает громкость
      //     - dynaudnorm: динамическая нормализация для выравнивания уровня громкости
      const command = `ffmpeg -y -i "${input}" -vn -acodec pcm_s16le -ar 16000 -ac 1 -af "highpass=f=50, lowpass=f=8000, volume=2, dynaudnorm" "${output}"`;
      
      log(`Выполняем команду конвертации: ${command}`, 'fragments');
      await execAsync(command);
      
      // Проверка, что выходной файл создан
      if (!fs.existsSync(output)) {
        log(`Ошибка: Выходной WAV файл не был создан: ${output}`, 'fragments');
        return false;
      }
      
      const stats = await fs.promises.stat(output);
      if (stats.size === 0) {
        log(`Ошибка: Созданный WAV файл имеет нулевой размер: ${output}`, 'fragments');
        return false;
      }
      
      log(`Конвертация успешна, размер файла: ${stats.size} байт`, 'fragments');
      return true;
    } catch (error) {
      log(`Ошибка при конвертации аудио: ${error}`, 'fragments');
      
      // Попробуем использовать запасной вариант конвертации
      try {
        log(`Попытка использовать альтернативный метод конвертации...`, 'fragments');
        // Альтернативный вариант с более надежными параметрами
        // Используем более простые параметры, которые с большей вероятностью сработают
        // -c:a libmp3lame - используем MP3 кодек, который более стабилен 
        // -b:a 128k - достаточное качество для распознавания речи
        // -ar 44100 - стандартная частота дискретизации
        const fallbackCommand = `ffmpeg -y -i "${input}" -vn -c:a libmp3lame -b:a 128k -ar 44100 -ac 1 "${output}"`;
        log(`Выполняем альтернативную команду конвертации: ${fallbackCommand}`, 'fragments');
        await execAsync(fallbackCommand);
        
        if (fs.existsSync(output)) {
          const stats = await fs.promises.stat(output);
          if (stats.size > 0) {
            log(`Альтернативный метод конвертации успешен, размер файла: ${stats.size} байт`, 'fragments');
            return true;
          }
        }
        
        log(`Альтернативный метод конвертации также не удался`, 'fragments');
        return false;
      } catch (fallbackError) {
        log(`Ошибка при альтернативной конвертации: ${fallbackError}`, 'fragments');
        return false;
      }
    }
  }

  /**
   * Конвертирует объединенный файл WebM в формат WAV и копирует в директорию uploads
   */
  public async convertCombinedToWav(sessionId: string, recordingId?: string | number): Promise<string | null> {
    try {
      if (!sessionId) {
        log(`Ошибка: попытка конвертировать файл для пустого sessionId`, 'fragments');
        return null;
      }
      
      log(`Начата конвертация объединенного файла в WAV для сессии ${sessionId}`, 'fragments');
      
      // Строгое приведение recordingId к числу, если оно передано
      let recordingIdNum: number | undefined;
      if (recordingId !== undefined) {
        if (typeof recordingId === 'string') {
          recordingIdNum = parseInt(recordingId, 10);
          if (isNaN(recordingIdNum)) {
            log(`Предупреждение: некорректный формат recordingId: ${recordingId}`, 'fragments');
            recordingIdNum = undefined;
          }
        } else {
          recordingIdNum = recordingId;
        }
      }
      
      // Проверяем существование директорий
      if (!fs.existsSync(this.fragmentsDir)) {
        log(`Директория фрагментов не существует: ${this.fragmentsDir}, создаем...`, 'fragments');
        fs.mkdirSync(this.fragmentsDir, { recursive: true });
      }
      
      const combinedFilename = `combined-${sessionId}.webm`;
      const combinedPath = path.join(this.fragmentsDir, combinedFilename);
      
      // Проверяем наличие объединенного файла
      if (!fs.existsSync(combinedPath)) {
        log(`Ошибка: Объединенный файл ${combinedFilename} не найден, пробуем объединить фрагменты`, 'fragments');
        
        // Пробуем создать объединенный файл, если не существует
        const combinedBuffer = await this.combineFragments(sessionId);
        if (!combinedBuffer) {
          log(`Ошибка: Не удалось создать объединенный файл для сессии ${sessionId}`, 'fragments');
          return null;
        }
        
        // Проверяем, что файл создан
        if (!fs.existsSync(combinedPath)) {
          log(`Ошибка: После объединения объединенный файл все равно не найден`, 'fragments');
          return null;
        }
      }
      
      // Проверяем, что файл не пустой
      try {
        const stats = await fs.promises.stat(combinedPath);
        if (stats.size === 0) {
          log(`Ошибка: Объединенный файл ${combinedFilename} имеет нулевой размер`, 'fragments');
          return null;
        }
        log(`Объединенный файл ${combinedFilename} найден, размер: ${stats.size} байт`, 'fragments');
      } catch (statError) {
        log(`Ошибка при получении информации о файле ${combinedFilename}: ${statError}`, 'fragments');
        return null;
      }
      
      // Генерируем уникальное имя файла для WAV версии
      const uuid = crypto.randomUUID();
      const wavFilename = `${uuid}.wav`;
      const uploadsDir = path.join(__dirname, 'uploads');
      
      // Создаем директорию uploads, если она не существует
      if (!fs.existsSync(uploadsDir)) {
        log(`Директория uploads не существует, создаем: ${uploadsDir}`, 'fragments');
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const wavPath = path.join(uploadsDir, wavFilename);
      
      // Конвертируем файл
      log(`Запуск конвертации ${combinedFilename} в ${wavFilename}`, 'fragments');
      const success = await this.convertToWav(combinedPath, wavPath);
      
      if (!success) {
        log(`Ошибка при конвертации файла ${combinedFilename} в WAV`, 'fragments');
        return null;
      }
      
      // Проверяем, что WAV файл создан и не пустой
      try {
        if (!fs.existsSync(wavPath)) {
          log(`Ошибка: WAV файл не создан после конвертации`, 'fragments');
          return null;
        }
        
        const wavStats = await fs.promises.stat(wavPath);
        if (wavStats.size === 0) {
          log(`Ошибка: WAV файл имеет нулевой размер после конвертации`, 'fragments');
          await fs.promises.unlink(wavPath); // Удаляем пустой файл
          return null;
        }
        
        log(`Файл ${combinedFilename} успешно конвертирован в ${wavFilename}, размер: ${wavStats.size} байт`, 'fragments');
      } catch (fsError) {
        log(`Ошибка при проверке WAV файла: ${fsError}`, 'fragments');
        return null;
      }
      
      // Если указан ID записи, обновляем имя файла в базе данных
      if (recordingIdNum) {
        try {
          log(`Обновление записи с ID ${recordingIdNum} в базе данных`, 'fragments');
          
          const recording = await storage.getRecordingById(recordingIdNum);
          
          if (recording) {
            // Обновляем имя файла в записи
            recording.filename = wavFilename;
            
            // Обновляем статус записи
            await storage.updateRecordingStatus(recordingIdNum, 'completed');
            log(`Обновлен статус записи с ID: ${recordingIdNum} на 'completed', установлен файл ${wavFilename}`, 'recording');
          } else {
            log(`Предупреждение: Запись с ID ${recordingIdNum} не найдена в базе`, 'fragments');
          }
        } catch (dbError) {
          log(`Ошибка при обновлении записи в базе данных: ${dbError}`, 'fragments');
          // Продолжаем выполнение, это не критическая ошибка
        }
      }
      
      return wavFilename;
    } catch (error) {
      log(`Критическая ошибка при конвертации аудио для сессии ${sessionId}: ${error}`, 'fragments');
      return null;
    }
  }

  /**
   * Очищает временные файлы фрагментов для указанной сессии
   */
  public async cleanupSession(sessionId: string): Promise<void> {
    try {
      if (!sessionId) {
        log(`Предупреждение: попытка очистить сессию с пустым ID`, 'fragments');
        return;
      }
      
      log(`Начата очистка фрагментов для сессии ${sessionId}`, 'fragments');
      
      // Проверяем наличие директории для фрагментов
      if (!fs.existsSync(this.fragmentsDir)) {
        log(`Директория фрагментов не существует: ${this.fragmentsDir}`, 'fragments');
        return;
      }
      
      // Получаем фрагменты для сессии
      let fragments: RecordingFragment[] = [];
      try {
        fragments = await this.getSessionFragments(sessionId);
        log(`Получено ${fragments.length} фрагментов для очистки`, 'fragments');
      } catch (getFragmentsError) {
        log(`Ошибка при получении фрагментов для очистки: ${getFragmentsError}`, 'fragments');
        // Продолжаем, будем искать файлы по паттерну имени
      }
      
      // Если фрагменты найдены, удаляем их
      if (fragments && fragments.length > 0) {
        // Удаляем каждый файл фрагмента
        for (const fragment of fragments) {
          const filePath = path.join(this.fragmentsDir, fragment.filename);
          
          try {
            if (fs.existsSync(filePath)) {
              await fs.promises.unlink(filePath);
              log(`Удален фрагмент ${fragment.filename}`, 'fragments');
            } else {
              log(`Файл фрагмента не найден: ${filePath}`, 'fragments');
            }
          } catch (unlinkError) {
            log(`Ошибка при удалении фрагмента ${fragment.filename}: ${unlinkError}`, 'fragments');
            // Продолжаем с другими фрагментами
          }
        }
      } else {
        // Если фрагменты не найдены через API, ищем файлы с подходящим именем
        log(`Фрагменты не найдены в базе, ищем по имени файла`, 'fragments');
        
        try {
          const allFiles = fs.readdirSync(this.fragmentsDir);
          const sessionFragmentFiles = allFiles.filter(file => 
            file.startsWith(`fragment-${sessionId}`)
          );
          
          log(`Найдено ${sessionFragmentFiles.length} файлов фрагментов по имени`, 'fragments');
          
          for (const file of sessionFragmentFiles) {
            const filePath = path.join(this.fragmentsDir, file);
            try {
              await fs.promises.unlink(filePath);
              log(`Удален файл фрагмента ${file}`, 'fragments');
            } catch (unlinkError) {
              log(`Ошибка при удалении файла фрагмента ${file}: ${unlinkError}`, 'fragments');
            }
          }
        } catch (readdirError) {
          log(`Ошибка при чтении директории фрагментов: ${readdirError}`, 'fragments');
        }
      }
      
      // Удаляем объединенный файл если он существует
      const combinedFilename = `combined-${sessionId}.webm`;
      const combinedPath = path.join(this.fragmentsDir, combinedFilename);
      
      try {
        if (fs.existsSync(combinedPath)) {
          await fs.promises.unlink(combinedPath);
          log(`Удален объединенный файл ${combinedFilename}`, 'fragments');
        }
      } catch (unlinkError) {
        log(`Ошибка при удалении объединенного файла ${combinedFilename}: ${unlinkError}`, 'fragments');
      }
      
      // Удаляем сессию из коллекции в памяти
      this.fragments.delete(sessionId);
      
      log(`Очистка фрагментов для сессии ${sessionId} завершена`, 'fragments');
    } catch (error) {
      log(`Критическая ошибка при очистке фрагментов сессии ${sessionId}: ${error}`, 'fragments');
    }
  }
}

// Экспортируем синглтон-экземпляр менеджера фрагментов
export const fragmentManager = new FragmentManager();