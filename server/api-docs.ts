import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const clientPublicPath = path.resolve(__dirname, '../client/public');

// Главная страница API с документацией
router.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Документация API</title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    ul { padding-left: 20px; }
    li { margin-bottom: 10px; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .note { background-color: #f5f5f5; padding: 10px; border-radius: 5px; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>Документация API</h1>
  <ul>
    <li><a href="/api/docs/replit-guide" target="_blank">Руководство по Replit</a></li>
  </ul>
  <h2>Полезные ресурсы</h2>
  <ul>
    <li><a href="/api/docs/replit-guide" target="_blank">Руководство по работе с приложением</a></li>
  </ul>
  
  <h2>Заархивированные компоненты</h2>
  <ul>
    <li><a href="/archived/README.md" target="_blank">Информация о заархивированных компонентах</a></li>
    <li><a href="/archived/zepp_integration.tar.gz" download>Скачать архив интеграции с Zepp OS</a></li>
  </ul>
  
  <div class="note">
    Все эти файлы доступны по прямым ссылкам и через API.
    Заархивированные компоненты содержат раннюю версию интеграции с умными часами на Zepp OS.
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Маршрут для страницы документации Zepp OS отключен

// Маршрут для руководства по Replit
router.get('/replit-guide', (req, res) => {
  const filePath = path.join(clientPublicPath, 'replit-guide.html');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'text/html');
    res.send(fs.readFileSync(filePath, 'utf8'));
  } else {
    res.status(404).send('Файл руководства по Replit не найден');
  }
});

export default router;