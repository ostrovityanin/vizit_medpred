import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Основная таблица для хранения всех записей (для админки)
export const adminRecordings = pgTable("admin_recordings", {
  id: serial("id").primaryKey(),
  filename: text("filename"),  // Может быть null для начатых, но не завершенных записей
  duration: integer("duration").notNull(),
  timestamp: text("timestamp").notNull(),
  targetUsername: text("target_username").notNull(),
  sent: boolean("sent").notNull().default(false),
  senderUsername: text("sender_username"),  // Имя отправителя
  fileSize: integer("file_size"),  // Размер файла в байтах
  transcription: text("transcription"),  // Распознанный текст из аудио
  transcriptionCost: text("transcription_cost"),  // Стоимость распознавания
  tokensProcessed: integer("tokens_processed"),  // Количество обработанных токенов
  status: text("status").notNull().default('started'),  // Статус записи: 'started', 'completed', 'error'
});

// Таблица для хранения записей пользователей (для бота)
export const userRecordings = pgTable("user_recordings", {
  id: serial("id").primaryKey(),
  adminRecordingId: integer("admin_recording_id"), // Связь с основной записью, может быть null при прямой записи
  username: text("username").notNull(),  // Имя пользователя, которому принадлежит запись
  duration: integer("duration").notNull(),
  timestamp: text("timestamp").notNull(),
  sent: boolean("sent").notNull().default(false),
});

// Схемы для вставки записей
export const insertAdminRecordingSchema = createInsertSchema(adminRecordings).pick({
  filename: true,
  duration: true,
  timestamp: true,
  targetUsername: true,
  senderUsername: true,
  fileSize: true,
  transcription: true,
  transcriptionCost: true,
  tokensProcessed: true,
  status: true,
});

export const insertUserRecordingSchema = createInsertSchema(userRecordings).pick({
  adminRecordingId: true,
  username: true,
  duration: true,
  timestamp: true,
});

// Типы для использования в приложении
export type InsertAdminRecording = z.infer<typeof insertAdminRecordingSchema>;
export type AdminRecording = typeof adminRecordings.$inferSelect;

export type InsertUserRecording = z.infer<typeof insertUserRecordingSchema>;
export type UserRecording = typeof userRecordings.$inferSelect;

// Для обратной совместимости
export const recordings = adminRecordings;
export const insertRecordingSchema = insertAdminRecordingSchema;
export type InsertRecording = InsertAdminRecording;
export type Recording = AdminRecording;
