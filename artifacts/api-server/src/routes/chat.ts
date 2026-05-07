import { Router, type IRouter } from "express";
import { db, roomsTable, messagesTable, readReceiptsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const router: IRouter = Router();

// POST /chat/rooms — create a new room
router.post("/chat/rooms", async (req, res): Promise<void> => {
  const { name, description, userId } = req.body as {
    name?: string;
    description?: string;
    userId?: string;
  };

  if (!name?.trim()) {
    res.status(400).json({ error: "Room name is required" });
    return;
  }

  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 50) {
    res.status(400).json({ error: "Room name must be 2–50 characters" });
    return;
  }

  const slug = trimmedName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 32);

  const id = `${slug}-${randomUUID().slice(0, 8)}`;
  const trimmedDesc = description?.trim() || "";

  const [existing] = await db.select().from(roomsTable).where(eq(roomsTable.id, id));
  if (existing) {
    res.status(409).json({ error: "A room with that name already exists" });
    return;
  }

  const [room] = await db
    .insert(roomsTable)
    .values({ id, name: trimmedName, description: trimmedDesc, creatorId: userId ?? null })
    .returning();

  if (!room) {
    res.status(500).json({ error: "Failed to create room" });
    return;
  }

  req.log.info({ roomId: room.id }, "New room created");
  res.status(201).json({
    id: room.id,
    name: room.name,
    description: room.description,
    creatorId: room.creatorId ?? null,
  });
});

// GET /chat/rooms/:id — single room info + member list
router.get("/chat/rooms/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!rawId) {
    res.status(400).json({ error: "Room id is required" });
    return;
  }

  const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, rawId));
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  // Distinct members from messages (by userId)
  const allMsgs = await db
    .select({
      userId: messagesTable.userId,
      username: messagesTable.username,
      avatarColor: messagesTable.avatarColor,
    })
    .from(messagesTable)
    .where(eq(messagesTable.roomId, rawId));

  const seen = new Set<string>();
  const members: { userId: string; username: string; avatarColor: string }[] = [];
  for (const m of allMsgs) {
    if (!seen.has(m.userId)) {
      seen.add(m.userId);
      members.push(m);
    }
  }

  // Count total messages
  const msgCount = allMsgs.length;

  res.json({
    id: room.id,
    name: room.name,
    description: room.description,
    creatorId: room.creatorId ?? null,
    createdAt: room.createdAt.toISOString(),
    members,
    messageCount: msgCount,
  });
});

// PATCH /chat/rooms/:id — update description (creator only)
router.patch("/chat/rooms/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { userId, description } = req.body as { userId?: string; description?: string };

  if (!rawId) {
    res.status(400).json({ error: "Room id is required" });
    return;
  }
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }
  if (description === undefined) {
    res.status(400).json({ error: "description is required" });
    return;
  }

  const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, rawId));
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  if (room.creatorId !== userId) {
    res.status(403).json({ error: "Only the creator can edit this group" });
    return;
  }

  const trimmed = description.trim().slice(0, 200);
  const [updated] = await db
    .update(roomsTable)
    .set({ description: trimmed })
    .where(eq(roomsTable.id, rawId))
    .returning();

  req.log.info({ roomId: rawId, userId }, "Room description updated");
  res.json({ id: rawId, description: updated?.description ?? trimmed });
});

// DELETE /chat/rooms/:id — permanently delete a room (creator only)
router.delete("/chat/rooms/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { userId } = req.body as { userId?: string };

  if (!rawId) {
    res.status(400).json({ error: "Room id is required" });
    return;
  }
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, rawId));
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  if (room.creatorId !== userId) {
    res.status(403).json({ error: "Only the creator can delete this group" });
    return;
  }

  await db.delete(messagesTable).where(eq(messagesTable.roomId, rawId));
  await db.delete(readReceiptsTable).where(eq(readReceiptsTable.roomId, rawId));
  await db.delete(roomsTable).where(eq(roomsTable.id, rawId));

  req.log.info({ roomId: rawId, userId }, "Room deleted by creator");
  res.json({ success: true });
});

// GET /chat/rooms — list all rooms with last-message preview
router.get("/chat/rooms", async (req, res): Promise<void> => {
  const rooms = await db.select().from(roomsTable).orderBy(roomsTable.name);

  const enriched = await Promise.all(
    rooms.map(async (room) => {
      const [last] = await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.roomId, room.id))
        .orderBy(desc(messagesTable.timestamp))
        .limit(1);

      return {
        id: room.id,
        name: room.name,
        description: room.description,
        creatorId: room.creatorId ?? null,
        lastMessage: last?.text ?? undefined,
        lastTimestamp: last ? last.timestamp.getTime() : undefined,
      };
    })
  );

  res.json(enriched);
});

// GET /chat/rooms/:id/messages
router.get("/chat/rooms/:id/messages", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!rawId) {
    res.status(400).json({ error: "Room id is required" });
    return;
  }

  const limit = Math.min(Number(req.query.limit) || 100, 200);

  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.roomId, rawId))
    .orderBy(desc(messagesTable.timestamp))
    .limit(limit);

  res.json(
    msgs.reverse().map((m) => ({
      id: m.id,
      roomId: m.roomId,
      userId: m.userId,
      username: m.username,
      avatarColor: m.avatarColor,
      text: m.text ?? undefined,
      mediaUrl: m.mediaUrl ?? undefined,
      mediaType: m.mediaType ?? undefined,
      timestamp: m.timestamp.getTime(),
      reactions: (m.reactions ?? []) as { emoji: string; userIds: string[] }[],
      deletedForEveryone: m.deletedForEveryone,
      deletedBy: m.deletedBy ?? [],
    }))
  );
});

export default router;
