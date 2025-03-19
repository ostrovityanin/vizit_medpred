import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const recordings = pgTable("recordings", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  duration: integer("duration").notNull(),
  timestamp: text("timestamp").notNull(),
  targetUsername: text("target_username").notNull(),
  sent: boolean("sent").notNull().default(false),
  senderUsername: text("sender_username"),  // Добавляем поле для имени отправителя
  fileSize: integer("file_size"),  // Размер файла в байтах
  transcription: text("transcription"),  // Распознанный текст из аудио
});

export const insertRecordingSchema = createInsertSchema(recordings).pick({
  filename: true,
  duration: true,
  timestamp: true,
  targetUsername: true,
  senderUsername: true,
  fileSize: true,
});

export type InsertRecording = z.infer<typeof insertRecordingSchema>;
export type Recording = typeof recordings.$inferSelect;
