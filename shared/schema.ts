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
});

export const insertRecordingSchema = createInsertSchema(recordings).pick({
  filename: true,
  duration: true,
  timestamp: true,
  targetUsername: true,
});

export type InsertRecording = z.infer<typeof insertRecordingSchema>;
export type Recording = typeof recordings.$inferSelect;
