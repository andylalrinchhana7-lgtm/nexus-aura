import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const readReceiptsTable = pgTable("read_receipts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  roomId: text("room_id").notNull(),
  username: text("username").notNull(),
  avatarColor: text("avatar_color").notNull(),
  lastMessageId: text("last_message_id").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReadReceiptSchema = createInsertSchema(readReceiptsTable).omit({ updatedAt: true });
export type InsertReadReceipt = z.infer<typeof insertReadReceiptSchema>;
export type ReadReceipt = typeof readReceiptsTable.$inferSelect;
