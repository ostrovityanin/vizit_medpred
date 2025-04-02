require('dotenv').config();

module.exports = {
  port: process.env.GPT4O_SERVICE_PORT || 3003,
  openaiApiKey: process.env.OPENAI_API_KEY,
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Конфигурация для GPT-4o Audio Preview
  gpt4o: {
    audioModel: 'gpt-4o',
    maxAudioSizeBytes: 25 * 1024 * 1024, // 25MB - максимальный размер файла для GPT-4o
    defaultPrompt: 'Расшифруй аудио и выдели различных говорящих. Верни текст в формате с указанием говорящих.'
  }
};