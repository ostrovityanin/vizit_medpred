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

// Список всех доступных файлов
router.get('/', (req, res) => {
  try {
    const files = fs.readdirSync(clientPublicPath)
      .filter(file => 
        file.endsWith('.zab') || 
        file.endsWith('.deb') || 
        file.endsWith('.zip') || 
        file.endsWith('.md')
      )
      .map(filename => ({
        filename,
        url: `/api/files/${filename}`,
        type: path.extname(filename).substring(1).toUpperCase(),
        size: fs.statSync(path.join(clientPublicPath, filename)).size
      }));
    
    res.json({ files });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Ошибка при чтении списка файлов',
      message: error.message 
    });
  }
});

// Скачивание файла по имени
router.get('/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(clientPublicPath, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Файл не найден');
  }
  
  const ext = path.extname(filename).toLowerCase();
  
  // Устанавливаем соответствующие заголовки в зависимости от типа файла
  if (ext === '.md') {
    // Для Markdown файлов - отображаем текст
    res.setHeader('Content-Type', 'text/markdown');
    res.send(fs.readFileSync(filePath, 'utf8'));
  } else if (['.zab', '.deb', '.zip'].includes(ext)) {
    // Для бинарных файлов - предлагаем скачать
    res.download(filePath);
  } else {
    // Для других типов - просто отдаем файл с соответствующим Content-Type
    res.sendFile(filePath);
  }
});

export default router;