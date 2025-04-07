/**
 * Скрипт для запуска всех компонентов мониторинга одной командой
 * Версия 1.0 - С проверкой окружения и настройками логирования
 */
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Инициализация для ESM
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Конфигурация
const CONFIG = {
  pidFile: 'monitoring-all.pid',
  logFile: 'monitoring-all.log',
  components: [
    {
      name: 'Расширенный мониторинг',
      script: './start-enhanced-monitoring.js',
      enabled: true
    },
    {
      name: 'API диаризации',
      script: './start-diarization-service.js',
      enabled: true
    },
    {
      name: 'GPT-4o сервис',
      script: './start-gpt4o-service.js',
      enabled: true
    }
  ],
  checkDelay: 5000 // 5 секунд между запуском компонентов
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
 * Проверка, запущен ли скрипт
 */
function isScriptRunning() {
  try {
    if (!fs.existsSync(CONFIG.pidFile)) {
      return false;
    }
    
    const pid = parseInt(fs.readFileSync(CONFIG.pidFile, 'utf8').trim());
    
    // Проверяем, существует ли процесс
    try {
      process.kill(pid, 0);
      log(`Обнаружен запущенный процесс (PID: ${pid})`, 'WARN');
      return true;
    } catch (e) {
      log(`PID-файл существует, но процесс недоступен. Удаляем старый PID-файл...`, 'WARN');
      fs.unlinkSync(CONFIG.pidFile);
      return false;
    }
  } catch (error) {
    log(`Ошибка при проверке состояния: ${error.message}`, 'ERROR');
    return false;
  }
}

/**
 * Проверка необходимых зависимостей
 */
function checkDependencies() {
  log('Проверка установленных зависимостей...', 'INFO');
  
  const requiredDeps = ['axios', 'node-telegram-bot-api', 'cron', 'dotenv'];
  let missingDeps = [];
  
  for (const dep of requiredDeps) {
    try {
      execSync(`npm list ${dep}`);
    } catch (error) {
      missingDeps.push(dep);
      log(`Зависимость ${dep} не установлена`, 'WARN');
    }
  }
  
  if (missingDeps.length > 0) {
    log(`Отсутствуют необходимые зависимости: ${missingDeps.join(', ')}`, 'ERROR');
    log(`Установите их командой: npm install ${missingDeps.join(' ')}`, 'INFO');
    return false;
  }
  
  log('Все необходимые зависимости установлены', 'INFO');
  return true;
}

/**
 * Проверка конфигурации для Telegram
 */
function checkTelegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!token) {
    log(`ПРЕДУПРЕЖДЕНИЕ: Не настроен токен TELEGRAM_BOT_TOKEN`, 'WARN');
  }
  
  if (!chatId) {
    log(`ПРЕДУПРЕЖДЕНИЕ: Не настроен ID чата TELEGRAM_CHAT_ID`, 'WARN');
  }
  
  if (!token || !chatId) {
    log(`Уведомления в Telegram не будут отправляться!`, 'WARN');
    return false;
  }
  
  log(`Конфигурация Telegram настроена корректно`, 'INFO');
  return true;
}

/**
 * Очистка старых файлов PID
 */
function cleanupOldPids() {
  log('Очистка старых PID файлов...', 'INFO');
  
  const oldPids = [
    'enhanced-monitoring.pid',
    'monitoring-service.pid',
    'diarization-service.pid',
    'gpt4o-service.pid'
  ];
  
  for (const pidFile of oldPids) {
    try {
      if (fs.existsSync(pidFile)) {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
        
        try {
          process.kill(pid, 0);
          log(`Найден активный процесс ${pidFile} (PID: ${pid})`, 'WARN');
        } catch (e) {
          log(`Удаление недействительного PID файла: ${pidFile}`, 'INFO');
          fs.unlinkSync(pidFile);
        }
      }
    } catch (error) {
      log(`Ошибка при проверке ${pidFile}: ${error.message}`, 'ERROR');
    }
  }
}

/**
 * Запуск компонента мониторинга
 */
async function startComponent(component) {
  log(`Запуск компонента: ${component.name} (${component.script})`, 'INFO');
  
  return new Promise((resolve, reject) => {
    try {
      const process = spawn('node', [component.script], {
        stdio: 'inherit'
      });
      
      // Устанавливаем таймаут для проверки успешного запуска
      const timeout = setTimeout(() => {
        log(`Компонент ${component.name} успешно запущен`, 'INFO');
        resolve(true);
      }, CONFIG.checkDelay);
      
      // Обработка ошибок запуска
      process.on('error', (error) => {
        clearTimeout(timeout);
        log(`Ошибка запуска ${component.name}: ${error.message}`, 'ERROR');
        resolve(false);
      });
      
      // Обработка преждевременного завершения
      process.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          log(`Компонент ${component.name} завершился с ошибкой (код ${code})`, 'ERROR');
          resolve(false);
        } else {
          // Нормальное завершение (для скриптов, которые запускают процесс и завершаются)
          log(`Компонент ${component.name} запущен и завершился нормально`, 'INFO');
          resolve(true);
        }
      });
    } catch (error) {
      log(`Исключение при запуске ${component.name}: ${error.message}`, 'ERROR');
      reject(error);
    }
  });
}

/**
 * Запуск всех компонентов мониторинга
 */
async function startAllComponents() {
  log('Запуск всех компонентов мониторинга...', 'INFO');
  
  // Записываем PID в файл для возможности остановки
  fs.writeFileSync(CONFIG.pidFile, `${process.pid}`);
  
  const results = [];
  
  for (const component of CONFIG.components) {
    if (component.enabled) {
      try {
        const success = await startComponent(component);
        results.push({
          name: component.name,
          success: success
        });
        
        // Пауза между запусками
        if (CONFIG.checkDelay > 0) {
          log(`Ожидание ${CONFIG.checkDelay}ms перед запуском следующего компонента...`, 'INFO');
          await new Promise(resolve => setTimeout(resolve, CONFIG.checkDelay));
        }
      } catch (error) {
        log(`Ошибка запуска компонента ${component.name}: ${error.message}`, 'ERROR');
        results.push({
          name: component.name,
          success: false,
          error: error.message
        });
      }
    } else {
      log(`Компонент "${component.name}" отключен в конфигурации`, 'INFO');
    }
  }
  
  // Печатаем сводку результатов
  log('\n=== РЕЗУЛЬТАТЫ ЗАПУСКА ===', 'INFO');
  let successCount = 0;
  
  for (const result of results) {
    if (result.success) {
      successCount++;
      log(`✅ ${result.name}: Успешно запущен`, 'INFO');
    } else {
      log(`❌ ${result.name}: Ошибка запуска${result.error ? ` (${result.error})` : ''}`, 'ERROR');
    }
  }
  
  log(`\nИтого: Успешно запущено ${successCount} из ${results.length} компонентов`, 'INFO');
  
  if (successCount < results.length) {
    log('⚠️ Некоторые компоненты не были запущены!', 'WARN');
    log('Проверьте логи для получения дополнительной информации.', 'INFO');
  } else {
    log('🚀 Все компоненты успешно запущены!', 'INFO');
  }
}

/**
 * Основная функция запуска
 */
async function main() {
  log('\n=================================================', 'INFO');
  log('ЗАПУСК ВСЕХ КОМПОНЕНТОВ МОНИТОРИНГА', 'INFO');
  log('=================================================\n', 'INFO');
  
  // Проверяем, запущен ли уже скрипт
  if (isScriptRunning()) {
    log('Процесс уже запущен! Для перезапуска сначала остановите его.', 'ERROR');
    process.exit(1);
  }
  
  // Проверяем зависимости
  if (!checkDependencies()) {
    log('Остановка из-за отсутствия необходимых зависимостей.', 'ERROR');
    process.exit(1);
  }
  
  // Проверяем Telegram конфигурацию
  checkTelegramConfig();
  
  // Очищаем старые PID файлы
  cleanupOldPids();
  
  // Запускаем все компоненты
  try {
    await startAllComponents();
    log('Процесс запуска всех компонентов завершен.', 'INFO');
  } catch (error) {
    log(`Критическая ошибка: ${error.message}`, 'ERROR');
    process.exit(1);
  }
}

// Запуск
main().catch(error => {
  log(`Необработанная ошибка: ${error.message}`, 'ERROR');
  process.exit(1);
});