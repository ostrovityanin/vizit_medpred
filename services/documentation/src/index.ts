import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs-extra';
import { marked } from 'marked';

// Инициализация Express
const app = express();
const PORT = process.env.PORT || 3004;

// Настройка CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'
}));

// Директории для статических файлов
const staticDir = path.join(__dirname, '../static');
const publicDir = path.join(__dirname, '../public');
const rootDir = path.join(__dirname, '../../..');

// Обеспечиваем существование директорий
fs.ensureDirSync(staticDir);
fs.ensureDirSync(publicDir);

// Middleware для логирования запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Маршрут для проверки статуса сервиса
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'documentation' });
});

// Обработка HTML документации
app.get('/docs/:docName?', async (req, res) => {
  try {
    const docName = req.params.docName || 'index';
    
    // Сначала ищем HTML файл в директории static
    const htmlPath = path.join(staticDir, `${docName}.html`);
    
    if (await fs.pathExists(htmlPath)) {
      res.sendFile(htmlPath);
      return;
    }
    
    // Затем проверяем в корневой директории
    const rootHtmlPath = path.join(rootDir, `${docName}.html`);
    
    if (await fs.pathExists(rootHtmlPath)) {
      res.sendFile(rootHtmlPath);
      return;
    }
    
    // Наконец, ищем MD файл и конвертируем его в HTML
    const mdPath = path.join(rootDir, `${docName}.md`);
    
    if (await fs.pathExists(mdPath)) {
      const mdContent = await fs.readFile(mdPath, 'utf-8');
      const htmlContent = marked.parse(mdContent);
      
      res.send(`
        <!DOCTYPE html>
        <html lang="ru">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${docName} - Документация</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            pre {
              background-color: #f5f5f5;
              padding: 15px;
              border-radius: 5px;
              overflow-x: auto;
            }
            code {
              background-color: #f5f5f5;
              padding: 2px 5px;
              border-radius: 3px;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            table, th, td {
              border: 1px solid #ddd;
            }
            th, td {
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f5f5f5;
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `);
      return;
    }
    
    // Если файл не найден, возвращаем 404
    res.status(404).send('Документация не найдена');
  } catch (error) {
    console.error('Ошибка при обработке документации:', error);
    res.status(500).send('Ошибка при обработке документации');
  }
});

// Обработка запросов файлов
app.get('/files/:filename?', async (req, res) => {
  try {
    // Если имя файла не указано, выводим список доступных файлов
    if (!req.params.filename) {
      const files = await listFiles(rootDir);
      
      res.send(`
        <!DOCTYPE html>
        <html lang="ru">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Список файлов</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            ul {
              list-style-type: none;
              padding: 0;
            }
            li {
              margin-bottom: 10px;
              padding: 10px;
              background-color: #f5f5f5;
              border-radius: 5px;
            }
            a {
              text-decoration: none;
              color: #0366d6;
            }
            a:hover {
              text-decoration: underline;
            }
            .file-size {
              color: #666;
              font-size: 0.8em;
            }
          </style>
        </head>
        <body>
          <h1>Список доступных файлов</h1>
          <ul>
            ${files.map(file => `
              <li>
                <a href="/files/${file.name}">${file.name}</a>
                <span class="file-size">(${formatFileSize(file.size)})</span>
              </li>
            `).join('')}
          </ul>
        </body>
        </html>
      `);
      return;
    }
    
    const filename = req.params.filename;
    const filePath = path.join(rootDir, filename);
    
    // Проверяем существование файла
    if (!(await fs.pathExists(filePath))) {
      res.status(404).send('Файл не найден');
      return;
    }
    
    // Определяем тип контента на основе расширения файла
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.html':
        contentType = 'text/html';
        break;
      case '.js':
        contentType = 'text/javascript';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      case '.json':
        contentType = 'application/json';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.svg':
        contentType = 'image/svg+xml';
        break;
      case '.md':
        contentType = 'text/markdown';
        break;
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.zip':
        contentType = 'application/zip';
        break;
      case '.zab':
        contentType = 'application/octet-stream';
        break;
      case '.deb':
        contentType = 'application/vnd.debian.binary-package';
        break;
    }
    
    // Устанавливаем правильные заголовки
    res.setHeader('Content-Type', contentType);
    
    // Для файлов, которые нужно скачивать, добавляем заголовок Content-Disposition
    if (contentType === 'application/octet-stream' || ext === '.zip' || ext === '.zab' || ext === '.deb') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }
    
    // Отправляем файл
    res.sendFile(filePath);
  } catch (error) {
    console.error('Ошибка при обработке файла:', error);
    res.status(500).send('Ошибка при обработке файла');
  }
});

// Функция для получения списка файлов
async function listFiles(dir: string): Promise<Array<{ name: string, size: number }>> {
  try {
    const items = await fs.readdir(dir);
    const files: Array<{ name: string, size: number }> = [];
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stats = await fs.stat(itemPath);
      
      // Исключаем директории, ноды_модули и скрытые файлы
      if (!stats.isDirectory() && !item.startsWith('.') && !item.includes('node_modules')) {
        files.push({
          name: item,
          size: stats.size
        });
      }
    }
    
    // Сортируем по имени файла
    return files.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Ошибка при получении списка файлов:', error);
    return [];
  }
}

// Функция для форматирования размера файла
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return bytes + ' bytes';
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  } else if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  } else {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }
}

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Documentation service running on port ${PORT}`);
});