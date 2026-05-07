import { pgTable, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  avatarColor: text("avatar_color").notNull(),
  text: text("text"),
  mediaUrl: text("media_url"),
  mediaType: text("media_type"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  reactions: jsonb("reactions").notNull().default([]),
  deletedForEveryone: boolean("deleted_for_everyone").notNull().default(false),
  deletedBy: text("deleted_by").array().notNull().default([]),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ timestamp: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
