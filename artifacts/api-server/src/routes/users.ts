import { Router, type IRouter } from "express";
import { db, usersTable, messagesTable, roomsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const router: IRouter = Router();

// GET /users/:userId
router.get("/users/:userId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  if (!rawId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, rawId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Find rooms this user has sent messages in
  const userMessages = await db
    .select({ roomId: messagesTable.roomId })
    .from(messagesTable)
    .where(eq(messagesTable.userId, rawId))
    .groupBy(messagesTable.roomId);

  const roomIds = [...new Set(userMessages.map((m) => m.roomId))];
  const activeRooms =
    roomIds.length > 0
      ? await db.select().from(roomsTable).where(inArray(roomsTable.id, roomIds))
      : [];

  res.json({
    id: user.id,
    username: user.username,
    avatarColor: user.avatarColor,
    joinedAt: user.createdAt.getTime(),
    activeRooms: activeRooms.map((r) => ({ id: r.id, name: r.name })),
  });
});

export default router;
