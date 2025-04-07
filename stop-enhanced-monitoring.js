/**
 * Скрипт для остановки усовершенствованного сервиса мониторинга
 * Версия 3.0 - С расширенной диагностикой и проверкой состояния
 */
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Инициализация для ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Конфигурация
const CONFIG = {
  pidFile: 'enhanced-monitoring.pid',
  statusFile: 'enhanced-monitoring.status'
};

/**
 * Поиск процессов мониторинга по имени
 * @returns {Promise<Array<number>>} Массив найденных PID
 */
async function findMonitoringProcesses() {
  try {
    const processName = 'enhanced-monitor.mjs';
    let pids = [];
    
    // Используем команду ps для поиска процессов по имени
    try {
      const output = execSync(`ps aux | grep "${processName}" | grep -v grep`).toString();
      const lines = output.split('\n').filter(Boolean);
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length > 1) {
          const pid = parseInt(parts[1]);
          if (!isNaN(pid)) {
            pids.push(pid);
            console.log(`🔍 Найден процесс мониторинга: PID ${pid}`);
          }
        }
      }
    } catch (e) {
      // Если grep не нашел процессы, он возвращает ненулевой код выхода
      console.log(`🔍 Процессы мониторинга не найдены через ps`);
    }
    
    return pids;
  } catch (error) {
    console.error(`❌ Ошибка при поиске процессов:`, error.message);
    return [];
  }
}

/**
 * Проверка существования процесса по PID
 * @param {number} pid PID процесса для проверки
 * @returns {boolean} Существует ли процесс
 */
function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Остановка процесса по PID
 * @param {number} pid PID процесса для остановки
 * @returns {Promise<boolean>} Успешность операции
 */
async function stopProcess(pid) {
  try {
    console.log(`🔴 Остановка процесса с PID ${pid}...`);
    
    // Сначала отправляем SIGTERM
    process.kill(pid, 'SIGTERM');
    
    // Ждем немного, чтобы процесс мог корректно завершиться
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Проверяем, завершился ли процесс
    if (!isProcessRunning(pid)) {
      console.log(`✅ Процесс с PID ${pid} успешно остановлен`);
      return true;
    }
    
    // Если процесс все еще работает, отправляем SIGKILL
    console.log(`⚠️ Процесс с PID ${pid} не завершился, отправляем SIGKILL...`);
    process.kill(pid, 'SIGKILL');
    
    // Еще раз ждем немного
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Окончательная проверка
    if (!isProcessRunning(pid)) {
      console.log(`✅ Процесс с PID ${pid} успешно остановлен (SIGKILL)`);
      return true;
    } else {
      console.error(`❌ Не удалось остановить процесс с PID ${pid}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Ошибка при остановке процесса с PID ${pid}:`, error.message);
    return false;
  }
}

/**
 * Остановка сервиса мониторинга
 */
async function stopMonitoringService() {
  console.log(`🛑 Остановка усовершенствованного сервиса мониторинга...`);
  
  let success = false;
  let pidsFromFile = [];
  
  // Пытаемся получить PID из файла
  try {
    if (fs.existsSync(CONFIG.pidFile)) {
      const pid = parseInt(fs.readFileSync(CONFIG.pidFile, 'utf8').trim());
      if (!isNaN(pid)) {
        pidsFromFile.push(pid);
        console.log(`📄 Найден PID в файле: ${pid}`);
      } else {
        console.log(`⚠️ Неверный формат PID в файле`);
      }
    } else {
      console.log(`⚠️ PID файл не найден: ${CONFIG.pidFile}`);
    }
  } catch (error) {
    console.error(`❌ Ошибка при чтении PID файла:`, error.message);
  }
  
  // Ищем процессы мониторинга по имени
  const pidsFromSearch = await findMonitoringProcesses();
  
  // Объединяем все найденные PID (без дубликатов)
  const allPids = [...new Set([...pidsFromFile, ...pidsFromSearch])];
  
  if (allPids.length === 0) {
    console.log(`ℹ️ Не найдены запущенные процессы мониторинга`);
  } else {
    console.log(`🔍 Найдено процессов для остановки: ${allPids.length}`);
    
    // Останавливаем все найденные процессы
    for (const pid of allPids) {
      if (isProcessRunning(pid)) {
        const stopped = await stopProcess(pid);
        success = success || stopped;
      } else {
        console.log(`ℹ️ Процесс с PID ${pid} не запущен`);
      }
    }
  }
  
  // Удаляем PID файл в любом случае
  try {
    if (fs.existsSync(CONFIG.pidFile)) {
      fs.unlinkSync(CONFIG.pidFile);
      console.log(`🗑️ PID файл удален: ${CONFIG.pidFile}`);
    }
  } catch (error) {
    console.error(`❌ Ошибка при удалении PID файла:`, error.message);
  }
  
  // Удаляем файл статуса, если он существует
  try {
    if (fs.existsSync(CONFIG.statusFile)) {
      fs.unlinkSync(CONFIG.statusFile);
      console.log(`🗑️ Файл статуса удален: ${CONFIG.statusFile}`);
    }
  } catch (error) {
    console.error(`❌ Ошибка при удалении файла статуса:`, error.message);
  }
  
  if (success) {
    console.log(`✅ Служба мониторинга успешно остановлена`);
  } else if (allPids.length > 0) {
    console.log(`⚠️ Не удалось остановить некоторые процессы мониторинга`);
  } else {
    console.log(`ℹ️ Служба мониторинга не была запущена`);
  }
}

// Запуск остановки сервиса
stopMonitoringService();