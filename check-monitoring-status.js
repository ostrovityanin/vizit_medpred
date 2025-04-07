/**
 * Проверка состояния мониторинга и вывод детальной информации
 * Версия 3.0 - С расширенной диагностикой и аналитикой
 */
import fs from 'fs';
import { execSync } from 'child_process';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Инициализация для ESM
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Конфигурация
const CONFIG = {
  pidFile: 'enhanced-monitoring.pid',
  logFile: 'enhanced-monitoring.log',
  serviceUrl: 'http://localhost:5000/health',
  maxLogLines: 20,
  telegramConfigRequired: true
};

/**
 * Форматирование времени аптайма
 */
function formatUptime(seconds) {
  if (isNaN(seconds)) return 'Н/Д';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  let formatted = '';
  if (days > 0) formatted += `${days}д `;
  if (hours > 0 || days > 0) formatted += `${hours}ч `;
  if (minutes > 0 || hours > 0 || days > 0) formatted += `${minutes}м `;
  formatted += `${remainingSeconds}с`;
  
  return formatted;
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
 * Поиск процессов мониторинга по имени
 * @returns {Array<{pid: number, cmd: string, memory: string, cpu: string}>} Информация о процессах
 */
function findMonitoringProcesses() {
  try {
    const processName = 'enhanced-monitor.mjs';
    let processes = [];
    
    // Используем команду ps для поиска процессов по имени с детальной информацией
    try {
      const output = execSync(`ps aux | grep "${processName}" | grep -v grep`).toString();
      const lines = output.split('\n').filter(Boolean);
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length > 10) {
          const pid = parseInt(parts[1]);
          if (!isNaN(pid)) {
            processes.push({
              pid: pid,
              user: parts[0],
              cpu: parts[2] + '%',
              memory: parts[3] + '%',
              startTime: parts[8],
              runtime: parts[9],
              cmd: parts.slice(10).join(' ')
            });
          }
        }
      }
    } catch (e) {
      // Если grep не нашел процессы, он возвращает ненулевой код выхода
      console.log(`🔍 Процессы мониторинга не найдены через ps`);
    }
    
    return processes;
  } catch (error) {
    console.error(`❌ Ошибка при поиске процессов:`, error.message);
    return [];
  }
}

/**
 * Получение последних строк из лог-файла
 * @returns {Array<string>} Массив строк лога
 */
function getRecentLogs() {
  try {
    if (!fs.existsSync(CONFIG.logFile)) {
      return [`❌ Лог-файл не найден: ${CONFIG.logFile}`];
    }
    
    const logContent = fs.readFileSync(CONFIG.logFile, 'utf8');
    const logLines = logContent.split('\n').filter(Boolean);
    
    // Возвращаем последние N строк
    return logLines.slice(-CONFIG.maxLogLines);
  } catch (error) {
    return [`❌ Ошибка при чтении лог-файла: ${error.message}`];
  }
}

/**
 * Проверка конфигурации Telegram
 * @returns {{configured: boolean, token: boolean, chatId: boolean, errorMsg: string|null}} Статус конфигурации
 */
function checkTelegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  const result = {
    configured: !!(token && chatId),
    token: !!token,
    chatId: !!chatId,
    errorMsg: null
  };
  
  if (!token && !chatId) {
    result.errorMsg = "Не настроены TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID";
  } else if (!token) {
    result.errorMsg = "Не настроен TELEGRAM_BOT_TOKEN";
  } else if (!chatId) {
    result.errorMsg = "Не настроен TELEGRAM_CHAT_ID";
  }
  
  return result;
}

/**
 * Проверка доступности основного сервиса
 * @returns {Promise<Object>} Результат проверки
 */
async function checkServiceHealth() {
  try {
    const startTime = Date.now();
    const response = await axios.get(CONFIG.serviceUrl, { timeout: 5000 });
    const responseTime = Date.now() - startTime;
    
    return {
      available: true,
      status: response.data.status,
      responseTime: responseTime,
      uptime: response.data.uptime,
      memory: response.data.memory,
      error: null
    };
  } catch (error) {
    return {
      available: false,
      status: 'error',
      responseTime: null,
      uptime: null,
      memory: null,
      error: error.message
    };
  }
}

/**
 * Получение информации о процессе из файла и системы
 * @returns {Promise<Object>} Информация о состоянии мониторинга
 */
async function getMonitoringStatus() {
  const status = {
    monitoringActive: false,
    pid: null,
    processList: [],
    mainServiceAvailable: false,
    mainServiceData: null,
    telegramConfigured: false,
    telegramConfig: null,
    recentLogs: [],
    pidFileExists: false,
    logFileExists: false
  };
  
  // Проверяем существование PID файла
  try {
    status.pidFileExists = fs.existsSync(CONFIG.pidFile);
    if (status.pidFileExists) {
      status.pid = parseInt(fs.readFileSync(CONFIG.pidFile, 'utf8').trim());
      
      // Проверяем, запущен ли процесс
      if (!isNaN(status.pid)) {
        status.monitoringActive = isProcessRunning(status.pid);
      }
    }
  } catch (error) {
    console.error(`❌ Ошибка при проверке PID файла:`, error.message);
  }
  
  // Ищем процессы мониторинга в системе
  status.processList = findMonitoringProcesses();
  
  // Если нашли процессы, но по PID не определили активность
  if (!status.monitoringActive && status.processList.length > 0) {
    status.monitoringActive = true;
  }
  
  // Проверяем основной сервис
  status.mainServiceData = await checkServiceHealth();
  status.mainServiceAvailable = status.mainServiceData.available;
  
  // Проверяем Telegram конфигурацию
  status.telegramConfig = checkTelegramConfig();
  status.telegramConfigured = status.telegramConfig.configured;
  
  // Проверяем лог-файл
  status.logFileExists = fs.existsSync(CONFIG.logFile);
  if (status.logFileExists) {
    status.recentLogs = getRecentLogs();
  }
  
  return status;
}

/**
 * Вывод информации о мониторинге
 */
async function displayStatus() {
  console.log(`\n🔍 Проверка состояния мониторинга...\n`);
  
  const status = await getMonitoringStatus();
  
  // Основной статус
  console.log(`=== ОБЩИЙ СТАТУС ===`);
  console.log(`🤖 Мониторинг: ${status.monitoringActive ? '🟢 АКТИВЕН' : '🔴 НЕАКТИВЕН'}`);
  console.log(`🌐 Основной сервис: ${status.mainServiceAvailable ? '🟢 ДОСТУПЕН' : '🔴 НЕДОСТУПЕН'}`);
  console.log(`📱 Telegram уведомления: ${status.telegramConfigured ? '🟢 НАСТРОЕНЫ' : '🔴 НЕ НАСТРОЕНЫ'}`);
  console.log(`📄 PID файл: ${status.pidFileExists ? '✅ Существует' : '❌ Отсутствует'}`);
  console.log(`📝 Лог файл: ${status.logFileExists ? '✅ Существует' : '❌ Отсутствует'}\n`);
  
  // Проверка критичности отсутствия Telegram конфигурации
  if (CONFIG.telegramConfigRequired && !status.telegramConfigured) {
    console.log(`⚠️ ВНИМАНИЕ: ${status.telegramConfig.errorMsg}`);
    console.log(`⚠️ Уведомления не будут отправляться!\n`);
  }
  
  // Детали процессов
  console.log(`=== ДЕТАЛИ ПРОЦЕССОВ ===`);
  if (status.pid) {
    console.log(`📌 PID из файла: ${status.pid} (${isProcessRunning(status.pid) ? 'активен' : 'не существует'})`);
  }
  
  if (status.processList.length > 0) {
    console.log(`📊 Найдено процессов мониторинга: ${status.processList.length}`);
    status.processList.forEach((proc, idx) => {
      console.log(`\n🔹 Процесс #${idx + 1}:`);
      console.log(`   PID: ${proc.pid}`);
      console.log(`   CPU: ${proc.cpu}`);
      console.log(`   Память: ${proc.memory}`);
      console.log(`   Пользователь: ${proc.user}`);
      console.log(`   Время запуска: ${proc.startTime}`);
      console.log(`   Команда: ${proc.cmd}`);
    });
  } else {
    console.log(`ℹ️ Процессы мониторинга не найдены в системе`);
  }
  
  // Информация об основном сервисе
  console.log(`\n=== СТАТУС ОСНОВНОГО СЕРВИСА ===`);
  if (status.mainServiceAvailable) {
    const data = status.mainServiceData;
    console.log(`✅ Сервис работает нормально (${data.status})`);
    console.log(`⏱️ Время отклика: ${data.responseTime} мс`);
    console.log(`⏳ Аптайм: ${formatUptime(data.uptime)}`);
    
    if (data.memory) {
      console.log(`💾 Память: ${data.memory.heapUsed} / ${data.memory.heapTotal}`);
    }
  } else {
    console.log(`❌ Сервис недоступен: ${status.mainServiceData.error}`);
  }
  
  // Последние записи лога
  console.log(`\n=== ПОСЛЕДНИЕ ЗАПИСИ ЛОГА ===`);
  if (status.recentLogs.length > 0) {
    console.log(`📜 Последние ${status.recentLogs.length} записей из лога:`);
    status.recentLogs.forEach((line, idx) => {
      console.log(`${idx + 1}. ${line}`);
    });
  } else {
    console.log(`ℹ️ Лог-записи не найдены`);
  }
  
  console.log(`\n=== РЕКОМЕНДАЦИИ ===`);
  if (!status.monitoringActive) {
    console.log(`▶️ Мониторинг не запущен. Запустите его командой:`);
    console.log(`   node start-enhanced-monitoring.js`);
  } else if (!status.telegramConfigured && CONFIG.telegramConfigRequired) {
    console.log(`⚠️ Настройте переменные окружения для Telegram уведомлений:`);
    console.log(`   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID`);
  } else if (!status.mainServiceAvailable) {
    console.log(`🔄 Основной сервис недоступен. Попробуйте перезапустить его.`);
  } else {
    console.log(`✅ Все системы работают нормально!`);
  }
}

// Запуск проверки
displayStatus();