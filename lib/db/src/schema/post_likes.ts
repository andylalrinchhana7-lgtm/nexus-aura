import { pgTable, text, primaryKey, timestamp } from "drizzle-orm/pg-core";

export const postLikesTable = pgTable(
  "post_likes",
  {
    postId: text("post_id").notNull(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.postId, table.userId] })]
);

export type PostLike = typeof postLikesTable.$inferSelect;
