import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Таблица для записей от администраторов
export const adminRecordingsTable = pgTable("admin_recordings", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  username: text("username").notNull(),
  duration: integer("duration").default(0),
  transcription: text("transcription"),
  status: text("status").default("new"),
  sentTo: text("sent_to"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  size: integer("size").default(0),
  telegramChatId: text("telegram_chat_id"),
  zepp: boolean("zepp").default(false),
  zepp_device_id: text("zepp_device_id")
});

// Таблица для записей от пользователей
export const userRecordingsTable = pgTable("user_recordings", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  username: text("username").notNull(),
  duration: integer("duration").default(0),
  transcription: text("transcription"),
  status: text("status").default("new"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  size: integer("size").default(0),
  telegramChatId: text("telegram_chat_id"),
  zepp: boolean("zepp").default(false),
  zepp_device_id: text("zepp_device_id")
});

// Таблица для фрагментов записей
export const recordingFragmentsTable = pgTable("recording_fragments", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  recordingId: integer("recording_id"),
  sessionId: text("session_id").notNull(),
  index: integer("index").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  processed: boolean("processed").default(false),
  size: integer("size").default(0)
});

// Схемы для вставки
export const insertAdminRecordingSchema = createInsertSchema(adminRecordingsTable).omit({
  id: true,
  sentAt: true,
  createdAt: true,
  updatedAt: true
});

export const insertUserRecordingSchema = createInsertSchema(userRecordingsTable).omit({
  id: true,
  sentAt: true,
  createdAt: true,
  updatedAt: true
});

export const insertRecordingFragmentSchema = createInsertSchema(recordingFragmentsTable).omit({
  id: true,
  processed: true,
  timestamp: true
});

// Типы для вставки
export type InsertAdminRecording = z.infer<typeof insertAdminRecordingSchema>;
export type InsertUserRecording = z.infer<typeof insertUserRecordingSchema>;
export type InsertRecordingFragment = z.infer<typeof insertRecordingFragmentSchema>;

// Типы для выборки
export type AdminRecording = typeof adminRecordingsTable.$inferSelect;
export type UserRecording = typeof userRecordingsTable.$inferSelect;
export type RecordingFragment = typeof recordingFragmentsTable.$inferSelect;