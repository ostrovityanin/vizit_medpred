/**
 * Скрипт для остановки сервиса мониторинга
 * Версия 2.0 - Улучшенный поиск процессов и обработка ошибок
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

// Промисификация exec для асинхронного использования
const execAsync = promisify(exec);

// Пути для ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Конфигурация
const CONFIG = {
  pidFile: 'monitoring-service.pid',
  logFile: 'monitoring-service.log',
  processName: 'simple-monitor.mjs'
};

/**
 * Поиск процессов мониторинга по имени
 * @returns {Promise<Array<number>>} Массив найденных PID
 */
async function findMonitoringProcesses() {
  try {
    const { stdout } = await execAsync(`ps -ef | grep "${CONFIG.processName}" | grep -v grep | awk '{print $2}'`);
    const pids = stdout.trim().split('\n').filter(Boolean).map(Number);
    return pids;
  } catch (error) {
    console.error(`❌ Ошибка при поиске процессов мониторинга:`, error.message);
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
    if (!isProcessRunning(pid)) {
      console.log(`⚠️ Процесс с PID ${pid} не существует`);
      return false;
    }
    
    console.log(`🛑 Отправляем сигнал SIGTERM процессу ${pid}...`);
    process.kill(pid, 'SIGTERM');
    
    // Даем время процессу на корректное завершение
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Проверяем, завершился ли процесс
    if (isProcessRunning(pid)) {
      console.log(`⚠️ Процесс ${pid} не завершился по SIGTERM, отправляем SIGKILL...`);
      process.kill(pid, 'SIGKILL');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (!isProcessRunning(pid)) {
      console.log(`✅ Процесс ${pid} успешно остановлен`);
      return true;
    } else {
      console.log(`❌ Не удалось остановить процесс ${pid}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Ошибка при остановке процесса ${pid}:`, error.message);
    return false;
  }
}

/**
 * Остановка сервиса мониторинга
 */
async function stopMonitoringService() {
  console.log(`🔍 Поиск запущенного сервиса мониторинга...`);
  
  try {
    // Проверяем, существует ли PID файл
    let foundPid = null;
    
    if (fs.existsSync(CONFIG.pidFile)) {
      foundPid = parseInt(fs.readFileSync(CONFIG.pidFile, 'utf8').trim());
      console.log(`🔍 Найден PID в файле: ${foundPid}`);
      
      if (isProcessRunning(foundPid)) {
        console.log(`✅ Процесс с PID ${foundPid} существует`);
      } else {
        console.log(`⚠️ Процесс с PID ${foundPid} не существует`);
        foundPid = null;
      }
    } else {
      console.log(`⚠️ PID файл не найден`);
    }
    
    // Ищем процессы по имени на случай, если PID файл не существует или процесс с указанным PID не запущен
    const foundPids = await findMonitoringProcesses();
    console.log(`🔍 Найдено процессов мониторинга: ${foundPids.length}`);
    
    if (foundPids.length === 0 && !foundPid) {
      console.log(`⚠️ Не найдено запущенных процессов мониторинга`);
      
      // Удаляем PID файл, если он существует, но процесса нет
      if (fs.existsSync(CONFIG.pidFile)) {
        fs.unlinkSync(CONFIG.pidFile);
        console.log(`🗑️ Удален неактуальный PID файл`);
      }
      
      return;
    }
    
    // Добавляем процесс из PID файла, если он не найден в списке процессов
    if (foundPid && !foundPids.includes(foundPid)) {
      foundPids.push(foundPid);
    }
    
    // Останавливаем все найденные процессы
    for (const pid of foundPids) {
      await stopProcess(pid);
    }
    
    // Удаляем PID файл после остановки всех процессов
    if (fs.existsSync(CONFIG.pidFile)) {
      fs.unlinkSync(CONFIG.pidFile);
      console.log(`🗑️ PID файл удален`);
    }
    
    // Записываем событие остановки в лог-файл
    fs.appendFileSync(CONFIG.logFile, `\n[${new Date().toISOString()}] Сервис мониторинга остановлен\n`);
    
    console.log(`✅ Сервис мониторинга успешно остановлен`);
  } catch (error) {
    console.error(`❌ Ошибка при остановке сервиса мониторинга:`, error.message);
  }
}

// Останавливаем сервис мониторинга
stopMonitoringService();