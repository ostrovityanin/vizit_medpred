FROM node:18-slim

# Создаем директорию приложения
WORKDIR /app

# Копируем package.json и package-lock.json для установки зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Устанавливаем wget для healthcheck
RUN apt-get update && apt-get install -y wget && apt-get clean

# Копируем исходный код приложения
COPY . .

# Создаем директории для логов и статусов
RUN mkdir -p logs status_logs

# Делаем скрипты исполняемыми
RUN chmod +x *.sh

# Порт, который будет прослушивать приложение
EXPOSE 3006

# Устанавливаем время начала работы сервиса
ENV SERVICE_START_TIME=$SERVICE_START_TIME

# Запускаем приложение
CMD ["node", "src/index.js"]

# Проверка работоспособности
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --spider -q http://localhost:3006/health || exit 1