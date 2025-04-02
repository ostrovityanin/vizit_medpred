/**
 * Генерация тестового аудиофайла для тестирования GPT-4o Audio
 * 
 * Этот скрипт использует OpenAI TTS API для создания тестового аудиофайла
 * с различными голосами, имитирующего диалог.
 */

import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

// Эмуляция __dirname в модуле ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем экземпляр API клиента с использованием ключа из переменных окружения
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Текст для генерации аудио (диалог двух людей)
const dialogText = `
Первый собеседник: Добрый день! Меня зовут Иван, я хотел бы узнать о возможностях использования искусственного интеллекта в медицине.

Второй собеседник: Здравствуйте, Иван! Рада вас слышать. Меня зовут Елена, я специалист по применению ИИ в здравоохранении. Искусственный интеллект сейчас активно внедряется в различные области медицины.

Первый собеседник: Это очень интересно! Не могли бы вы привести конкретные примеры? Особенно меня интересует диагностика заболеваний.

Второй собеседник: Конечно! Одним из самых успешных применений ИИ в медицине является анализ медицинских изображений. Например, нейронные сети могут обнаруживать признаки рака на рентгеновских снимках, МРТ и КТ с точностью, иногда превышающей возможности опытных радиологов.

Первый собеседник: Это впечатляет! А используется ли ИИ в повседневной практике врачей, или это скорее перспективная технология?

Второй собеседник: На самом деле, многие технологии уже внедрены в практику. Например, существуют системы поддержки принятия решений, которые помогают врачам ставить более точные диагнозы, выбирать оптимальное лечение и прогнозировать риски осложнений. В некоторых клиниках используются системы ИИ для мониторинга состояния пациентов в реальном времени.

Первый собеседник: Спасибо за подробное объяснение. А есть ли какие-то этические вопросы, связанные с использованием ИИ в медицине?

Второй собеседник: Отличный вопрос! Да, этические аспекты очень важны в этой области. Основные вопросы касаются конфиденциальности данных пациентов, ответственности за решения, принятые с помощью ИИ, и потенциального неравенства в доступе к технологиям. Важно разрабатывать не только технологии, но и этические стандарты их использования.
`;

// Разбиваем диалог на реплики
const replicas = dialogText.trim().split('\n\n');

// Функция для генерации аудио для одной реплики
async function generateAudioForReplica(text, voiceId, outputFilePath) {
  try {
    console.log(`Генерируем аудио для: ${text.substring(0, 50)}...`);
    
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voiceId,
      input: text.split(': ')[1] || text,  // Убираем префикс говорящего
      speed: 1.0,
    });
    
    // Преобразуем ответ в буфер
    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    // Записываем аудио в файл
    fs.writeFileSync(outputFilePath, buffer);
    
    console.log(`Аудио сохранено в файл: ${outputFilePath}`);
    return outputFilePath;
  } catch (error) {
    console.error(`Ошибка при генерации аудио: ${error}`);
    return null;
  }
}

// Функция для объединения аудиофайлов
async function combineAudioFiles(audioFiles, outputFilePath) {
  try {
    
    // Создаем временный файл со списком файлов для объединения
    const fileListPath = path.join(__dirname, 'filelist.txt');
    const fileListContent = audioFiles.map(file => `file '${file}'`).join('\n');
    fs.writeFileSync(fileListPath, fileListContent);
    
    // Команда для объединения файлов с помощью ffmpeg
    const command = `ffmpeg -f concat -safe 0 -i ${fileListPath} -c copy ${outputFilePath}`;
    
    console.log(`Объединяем аудиофайлы в: ${outputFilePath}`);
    
    // Выполняем команду
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Ошибка при объединении файлов: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`ffmpeg stderr: ${stderr}`);
      }
      
      console.log(`Аудиофайлы успешно объединены в: ${outputFilePath}`);
      
      // Удаляем временный файл со списком
      fs.unlinkSync(fileListPath);
      
      // Удаляем временные файлы отдельных реплик
      audioFiles.forEach(file => {
        try {
          fs.unlinkSync(file);
          console.log(`Удален временный файл: ${file}`);
        } catch (e) {
          console.warn(`Не удалось удалить файл ${file}: ${e.message}`);
        }
      });
    });
    
    return outputFilePath;
  } catch (error) {
    console.error(`Ошибка при объединении аудиофайлов: ${error}`);
    return null;
  }
}

// Основная функция
async function generateDialogAudio() {
  try {
    // Создаем директорию temp, если ее нет
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Пути для файлов
    const outputFile = path.join(__dirname, 'test_dialog.mp3');
    
    // Массив для хранения путей к временным файлам
    const tempAudioFiles = [];
    
    // Генерируем аудио для каждой реплики
    console.log(`Генерируем аудио для диалога из ${replicas.length} реплик...`);
    
    for (let i = 0; i < replicas.length; i++) {
      const replica = replicas[i];
      const isFirstSpeaker = replica.startsWith('Первый собеседник');
      
      // Выбираем разные голоса для разных говорящих
      const voiceId = isFirstSpeaker ? "echo" : "alloy";
      
      // Генерируем имя временного файла
      const tempFilePath = path.join(tempDir, `replica_${i+1}.mp3`);
      
      // Генерируем аудио для реплики
      const audioPath = await generateAudioForReplica(replica, voiceId, tempFilePath);
      
      if (audioPath) {
        tempAudioFiles.push(audioPath);
      }
    }
    
    // Объединяем все аудиофайлы в один
    if (tempAudioFiles.length > 0) {
      await combineAudioFiles(tempAudioFiles, outputFile);
      console.log(`Процесс создания тестового диалога завершен. Результат: ${outputFile}`);
    } else {
      console.error('Не удалось создать ни одного аудиофайла');
    }
  } catch (error) {
    console.error(`Необработанная ошибка: ${error}`);
  }
}

// Запускаем генерацию
generateDialogAudio();