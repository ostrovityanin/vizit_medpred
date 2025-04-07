/**
 * Скрипт для остановки всех компонентов мониторинга
 * Версия 1.0 - С проверкой состояния и очисткой всех PID-файлов
 */
import { execSync } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Инициализация для ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Конфигурация
const CONFIG = {
  pidFiles: [
    'enhanced-monitoring.pid',
    'monitoring-service.pid',
    'monitoring-all.pid',
    'diarization-service.pid',
    'gpt4o-service.pid',
    'simplified-diarization-service.pid'
  ],
  stopScripts: [
    './stop-enhanced-monitoring.js',
    './stop-monitoring-service.js',
    './stop-diarization-service.js',
    './stop-gpt4o-service.js',
    './stop-simplified-diarization-service.js'
  ],
  processNames: [
    'enhanced-monitor.mjs',
    'simple-monitor.mjs',
    'file-monitor.cjs',
    'diarization-service',
    'gpt4o-service'
  ],
  logFile: 'monitoring-stop.log'
};

// Логирование в файл и консоль
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
  console.log(logMessage);
  
  try {
    fs.appendFileSync(CONFIG.logFile, logMessage + '\n');
  } catch (error) {
    console.error(`Ошибка записи в лог: ${error.message}`);
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
 * Выполнение скрипта остановки
 * @param {string} script Путь к скрипту остановки
 * @returns {boolean} Успешность выполнения
 */
function runStopScript(script) {
  try {
    log(`Выполнение скрипта остановки: ${script}`, 'INFO');
    execSync(`node ${script}`, { stdio: 'inherit' });
    log(`Скрипт ${script} выполнен успешно`, 'INFO');
    return true;
  } catch (error) {
    log(`Ошибка выполнения скрипта ${script}: ${error.message}`, 'ERROR');
    return false;
  }
}

/**
 * Проверка и остановка процессов по PID-файлам
 * @returns {Array<{pid: number, file: string, stopped: boolean}>} Результаты остановки
 */
function stopProcessesFromPidFiles() {
  const results = [];
  
  log('Поиск и остановка процессов по PID-файлам...', 'INFO');
  
  for (const pidFile of CONFIG.pidFiles) {
    try {
      if (fs.existsSync(pidFile)) {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
        
        if (!isNaN(pid)) {
          log(`Найден PID-файл: ${pidFile} (PID: ${pid})`, 'INFO');
          
          if (isProcessRunning(pid)) {
            try {
              log(`Остановка процесса с PID ${pid}...`, 'INFO');
              
              // Сначала отправляем SIGTERM
              process.kill(pid, 'SIGTERM');
              
              // Ждем немного
              setTimeout(() => {
                if (isProcessRunning(pid)) {
                  log(`Процесс с PID ${pid} не завершился, отправляем SIGKILL...`, 'WARN');
                  process.kill(pid, 'SIGKILL');
                }
              }, 2000);
              
              results.push({
                pid: pid,
                file: pidFile,
                stopped: true
              });
            } catch (killError) {
              log(`Ошибка при остановке процесса с PID ${pid}: ${killError.message}`, 'ERROR');
              results.push({
                pid: pid,
                file: pidFile,
                stopped: false,
                error: killError.message
              });
            }
          } else {
            log(`Процесс с PID ${pid} не найден`, 'WARN');
          }
        } else {
          log(`Неверный формат PID в файле ${pidFile}`, 'WARN');
        }
        
        // Удаляем PID-файл
        try {
          fs.unlinkSync(pidFile);
          log(`PID-файл удален: ${pidFile}`, 'INFO');
        } catch (unlinkError) {
          log(`Ошибка удаления PID-файла ${pidFile}: ${unlinkError.message}`, 'ERROR');
        }
      }
    } catch (error) {
      log(`Ошибка при обработке PID-файла ${pidFile}: ${error.message}`, 'ERROR');
      results.push({
        file: pidFile,
        stopped: false,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Поиск и остановка процессов по именам
 * @returns {Array<{pid: number, name: string, stopped: boolean}>} Результаты остановки
 */
function findAndStopProcessesByName() {
  const results = [];
  
  log('Поиск и остановка процессов по именам...', 'INFO');
  
  for (const processName of CONFIG.processNames) {
    try {
      log(`Поиск процессов с именем: ${processName}`, 'INFO');
      
      try {
        const output = execSync(`ps aux | grep "${processName}" | grep -v grep`).toString();
        const lines = output.split('\n').filter(Boolean);
        
        if (lines.length > 0) {
          log(`Найдено процессов с именем ${processName}: ${lines.length}`, 'INFO');
          
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length > 1) {
              const pid = parseInt(parts[1]);
              
              if (!isNaN(pid)) {
                log(`Остановка процесса ${processName} (PID: ${pid})...`, 'INFO');
                
                try {
                  // Сначала отправляем SIGTERM
                  process.kill(pid, 'SIGTERM');
                  
                  // Ждем немного и проверяем
                  setTimeout(() => {
                    if (isProcessRunning(pid)) {
                      log(`Процесс с PID ${pid} не завершился, отправляем SIGKILL...`, 'WARN');
                      process.kill(pid, 'SIGKILL');
                    }
                  }, 2000);
                  
                  results.push({
                    pid: pid,
                    name: processName,
                    stopped: true
                  });
                } catch (killError) {
                  log(`Ошибка при остановке процесса ${processName} (PID: ${pid}): ${killError.message}`, 'ERROR');
                  results.push({
                    pid: pid,
                    name: processName,
                    stopped: false,
                    error: killError.message
                  });
                }
              }
            }
          }
        } else {
          log(`Процессы с именем ${processName} не найдены`, 'INFO');
        }
      } catch (grepError) {
        // Если процессы не найдены, grep возвращает ненулевой код выхода
        log(`Процессы с именем ${processName} не найдены через grep`, 'INFO');
      }
    } catch (error) {
      log(`Ошибка при поиске процессов с именем ${processName}: ${error.message}`, 'ERROR');
    }
  }
  
  return results;
}

/**
 * Главная функция остановки всех компонентов
 */
async function stopAllComponents() {
  log('\n=================================================', 'INFO');
  log('ОСТАНОВКА ВСЕХ КОМПОНЕНТОВ МОНИТОРИНГА', 'INFO');
  log('=================================================\n', 'INFO');
  
  // Выполняем скрипты остановки
  log('Шаг 1: Выполнение специализированных скриптов остановки', 'INFO');
  const scriptResults = [];
  
  for (const script of CONFIG.stopScripts) {
    if (fs.existsSync(script)) {
      const success = runStopScript(script);
      scriptResults.push({
        script: script,
        success: success
      });
    } else {
      log(`Скрипт ${script} не найден`, 'WARN');
    }
  }
  
  // Проверяем и останавливаем процессы по PID-файлам
  log('\nШаг 2: Остановка процессов по PID-файлам', 'INFO');
  const pidResults = stopProcessesFromPidFiles();
  
  // Находим и останавливаем процессы по именам
  log('\nШаг 3: Поиск и остановка процессов по именам', 'INFO');
  const nameResults = findAndStopProcessesByName();
  
  // Выводим сводку результатов
  log('\n=== РЕЗУЛЬТАТЫ ОСТАНОВКИ ===', 'INFO');
  
  if (scriptResults.length > 0) {
    log('\nВыполнение скриптов остановки:', 'INFO');
    for (const result of scriptResults) {
      log(`${result.success ? '✅' : '❌'} ${result.script}`, 'INFO');
    }
  }
  
  if (pidResults.length > 0) {
    log('\nОстановка процессов по PID-файлам:', 'INFO');
    for (const result of pidResults) {
      log(`${result.stopped ? '✅' : '❌'} ${result.file} (PID: ${result.pid})`, 'INFO');
    }
  } else {
    log('PID-файлы не найдены', 'INFO');
  }
  
  if (nameResults.length > 0) {
    log('\nОстановка процессов по именам:', 'INFO');
    for (const result of nameResults) {
      log(`${result.stopped ? '✅' : '❌'} ${result.name} (PID: ${result.pid})`, 'INFO');
    }
  } else {
    log('Процессы по именам не найдены', 'INFO');
  }
  
  // Финальная проверка
  log('\nФинальная проверка наличия процессов мониторинга...', 'INFO');
  
  let foundProcesses = false;
  
  try {
    for (const processName of CONFIG.processNames) {
      try {
        const output = execSync(`ps aux | grep "${processName}" | grep -v grep`).toString();
        const lines = output.split('\n').filter(Boolean);
        
        if (lines.length > 0) {
          foundProcesses = true;
          log(`⚠️ Обнаружены оставшиеся процессы ${processName}: ${lines.length}`, 'WARN');
          
          for (const line of lines) {
            log(`- ${line}`, 'WARN');
          }
        }
      } catch (e) {
        // Процессы не найдены
      }
    }
  } catch (error) {
    log(`Ошибка при финальной проверке: ${error.message}`, 'ERROR');
  }
  
  if (!foundProcesses) {
    log('✅ Все процессы мониторинга успешно остановлены', 'INFO');
  } else {
    log('⚠️ Некоторые процессы мониторинга всё еще активны!', 'WARN');
    log('Возможно, потребуется ручное вмешательство для их остановки.', 'INFO');
  }
  
  log('\nПроцесс остановки всех компонентов завершен.', 'INFO');
}

// Запуск
stopAllComponents().catch(error => {
  log(`Необработанная ошибка: ${error.message}`, 'ERROR');
  process.exit(1);
});