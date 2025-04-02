FROM node:18-alpine

# Создаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем исходный код
COPY . .

# Создаем директорию для логов
RUN mkdir -p logs

# Экспортируем порт
EXPOSE 3006

# Команда запуска
CMD ["node", "src/index.js"]