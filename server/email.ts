import nodemailer from 'nodemailer';
import { log } from './vite';
import fs from 'fs';

// Создаем транспорт для отправки через сервис Gmail
// Для других сервисов параметры могут отличаться
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASSWORD || '',
  }
});

/**
 * Отправляет аудиофайл на указанный email
 */
export async function sendAudioToEmail(
  filePath: string,
  email: string,
  subject: string = 'Запись с таймера визита',
  text: string = 'Вложена аудиозапись с таймера визита'
): Promise<boolean> {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    log('No email credentials provided', 'email');
    return false;
  }

  try {
    log(`Sending audio to email: ${email}`, 'email');
    
    // Проверяем существует ли файл
    if (!fs.existsSync(filePath)) {
      log(`File not found: ${filePath}`, 'email');
      return false;
    }

    // Создаем опции для отправки письма
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      text: text,
      attachments: [
        {
          filename: 'recording.wav',
          path: filePath,
          contentType: 'audio/wav'
        }
      ]
    };

    // Отправляем письмо
    const info = await transporter.sendMail(mailOptions);
    log(`Email sent: ${info.messageId}`, 'email');
    return true;
  } catch (error) {
    log(`Error sending email: ${error}`, 'email');
    return false;
  }
}