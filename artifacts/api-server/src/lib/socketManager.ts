import type { Server as HTTPServer } from "node:http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { db, messagesTable, roomsTable, readReceiptsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { logger } from "./logger";
import { sendMessagePushNotifications } from "./pushNotifications";

// ──────────────────────────────────────────────
// In-memory state
// ──────────────────────────────────────────────

// userId → socketId
const userSockets = new Map<string, string>();
// socketId → { userId, username, avatarColor }
const socketUsers = new Map<string, { userId: string; username: string; avatarColor: string }>();
// roomId → Map<socketId, { userId, username, avatarColor }>
const roomMembers = new Map<string, Map<string, { userId: string; username: string; avatarColor: string }>>();
// roomId → Map<userId, { userId, username, avatarColor }>
const typingUsers = new Map<string, Map<string, { userId: string; username: string; avatarColor: string }>>();
// roomId → Map<userId, { username, avatarColor, lastMessageId }>
const readReceiptsCache = new Map<string, Map<string, { username: string; avatarColor: string; lastMessageId: string }>>();

function getRoomMembers(roomId: string) {
  if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Map());
  return roomMembers.get(roomId)!;
}

function getTypingUsers(roomId: string) {
  if (!typingUsers.has(roomId)) typingUsers.set(roomId, new Map());
  return typingUsers.get(roomId)!;
}

function getReadReceipts(roomId: string) {
  if (!readReceiptsCache.has(roomId)) readReceiptsCache.set(roomId, new Map());
  return readReceiptsCache.get(roomId)!;
}

function getActiveViewersForRoom(roomId: string): Set<string> {
  const members = getRoomMembers(roomId);
  const viewers = new Set<string>();
  for (const info of members.values()) {
    viewers.add(info.userId);
  }
  return viewers;
}

// ──────────────────────────────────────────────
// Reaction helpers
// ──────────────────────────────────────────────

interface Reaction {
  emoji: string;
  userIds: string[];
}

function toggleReaction(reactions: Reaction[], emoji: string, userId: string): Reaction[] {
  const existing = reactions.find((r) => r.emoji === emoji);
  if (existing) {
    const hasUser = existing.userIds.includes(userId);
    if (hasUser) {
      const newUserIds = existing.userIds.filter((id) => id !== userId);
      if (newUserIds.length === 0) {
        return reactions.filter((r) => r.emoji !== emoji);
      }
      return reactions.map((r) => (r.emoji === emoji ? { ...r, userIds: newUserIds } : r));
    } else {
      return reactions.map((r) =>
        r.emoji === emoji ? { ...r, userIds: [...r.userIds, userId] } : r
      );
    }
  }
  return [...reactions, { emoji, userIds: [userId] }];
}

// ──────────────────────────────────────────────
// Seed default rooms
// ──────────────────────────────────────────────

export async function seedDefaultRooms(): Promise<void> {
  const defaults = [
    { id: "general", name: "General", description: "Open chat for everyone" },
    { id: "tech", name: "Tech Talk", description: "Discuss technology & dev" },
    { id: "music", name: "Music Vibes", description: "Share your music taste" },
    { id: "gaming", name: "Gaming", description: "Gamers unite!" },
  ];
  for (const room of defaults) {
    const existing = await db.select().from(roomsTable).where(eq(roomsTable.id, room.id));
    if (existing.length === 0) {
      await db.insert(roomsTable).values(room);
      logger.info({ roomId: room.id }, "Seeded default room");
    }
  }
}

// ──────────────────────────────────────────────
// Socket manager setup
// ──────────────────────────────────────────────

export function createSocketServer(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    path: "/api/socket.io",
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    // ── authenticate ──
    socket.on("authenticate", async (data: { userId: string }) => {
      const { userId } = data;
      if (!userId) return;

      // Fetch user info from DB
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
      if (!user) {
        logger.warn({ userId }, "authenticate: user not found");
        return;
      }

      // Track socket ↔ user mapping
      userSockets.set(userId, socket.id);
      socketUsers.set(socket.id, { userId, username: user.username, avatarColor: user.avatarColor });
      logger.info({ userId, username: user.username }, "Socket authenticated");
    });

    // ── join-room ──
    socket.on("join-room", async (data: { roomId: string; userId: string }) => {
      const { roomId } = data;
      const userInfo = socketUsers.get(socket.id);
      if (!userInfo) return;

      await socket.join(roomId);
      getRoomMembers(roomId).set(socket.id, userInfo);

      // Send member count
      const count = getRoomMembers(roomId).size;
      io.to(roomId).emit("room-members", { roomId, count });

      // Send message history (last 100)
      const history = await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.roomId, roomId))
        .orderBy(messagesTable.timestamp)
        .limit(100);

      socket.emit("room-history", history.map(normalizeMessage));

      // Load & cache read receipts from DB for this room
      const receiptsFromDb = await db
        .select()
        .from(readReceiptsTable)
        .where(eq(readReceiptsTable.roomId, roomId));

      const roomReceipts = getReadReceipts(roomId);
      for (const r of receiptsFromDb) {
        roomReceipts.set(r.userId, {
          username: r.username,
          avatarColor: r.avatarColor,
          lastMessageId: r.lastMessageId,
        });
      }

      socket.emit("receipts-snapshot", { roomId, receipts: Object.fromEntries(roomReceipts) });
    });

    // ── leave-room ──
    socket.on("leave-room", (data: { roomId: string }) => {
      const { roomId } = data;
      socket.leave(roomId);
      getRoomMembers(roomId).delete(socket.id);
      getTypingUsers(roomId).delete(socketUsers.get(socket.id)?.userId ?? "");

      const count = getRoomMembers(roomId).size;
      io.to(roomId).emit("room-members", { roomId, count });

      // Broadcast typing update
      io.to(roomId).emit("typing-update", {
        roomId,
        typers: Array.from(getTypingUsers(roomId).values()),
      });
    });

    // ── send-message ──
    socket.on(
      "send-message",
      async (data: {
        roomId: string;
        text?: string;
        mediaUrl?: string;
        mediaType?: string;
      }) => {
        const userInfo = socketUsers.get(socket.id);
        if (!userInfo) return;

        const { roomId, text, mediaUrl, mediaType } = data;
        if (!text && !mediaUrl) return;

        const id = randomUUID();
        const message = {
          id,
          roomId,
          userId: userInfo.userId,
          username: userInfo.username,
          avatarColor: userInfo.avatarColor,
          text: text ?? null,
          mediaUrl: mediaUrl ?? null,
          mediaType: mediaType ?? null,
          reactions: [] as Reaction[],
          deletedForEveryone: false,
          deletedBy: [] as string[],
        };

        // Persist to DB
        await db.insert(messagesTable).values({
          ...message,
          reactions: message.reactions,
          deletedBy: message.deletedBy,
        });

        // Broadcast to room
        const outMessage = normalizeMessage({
          ...message,
          timestamp: new Date(),
        });
        io.to(roomId).emit("new-message", outMessage);

        // Push notifications (fire-and-forget)
        const roomInfo = await db.select().from(roomsTable).where(eq(roomsTable.id, roomId));
        const roomName = roomInfo[0]?.name ?? roomId;
        sendMessagePushNotifications({
          senderId: userInfo.userId,
          roomId,
          roomName,
          senderName: userInfo.username,
          messageText: text,
          mediaType,
          activeViewers: getActiveViewersForRoom(roomId),
        }).catch((err) => logger.error({ err }, "push notification fire-and-forget failed"));
      }
    );

    // ── add-reaction ──
    socket.on("add-reaction", async (data: { messageId: string; roomId: string; emoji: string }) => {
      const userInfo = socketUsers.get(socket.id);
      if (!userInfo) return;

      const { messageId, roomId, emoji } = data;
      const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, messageId));
      if (!msg) return;

      const updated = toggleReaction((msg.reactions ?? []) as Reaction[], emoji, userInfo.userId);
      await db.update(messagesTable).set({ reactions: updated }).where(eq(messagesTable.id, messageId));

      io.to(roomId).emit("reaction-updated", { messageId, reactions: updated });
    });

    // ── delete-message ──
    socket.on(
      "delete-message",
      async (data: { messageId: string; roomId: string; deleteType: "everyone" | "me" }) => {
        const userInfo = socketUsers.get(socket.id);
        if (!userInfo) return;

        const { messageId, roomId, deleteType } = data;
        const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, messageId));
        if (!msg) return;

        if (deleteType === "everyone" && msg.userId === userInfo.userId) {
          await db
            .update(messagesTable)
            .set({ deletedForEveryone: true })
            .where(eq(messagesTable.id, messageId));

          io.to(roomId).emit("message-deleted", {
            messageId,
            roomId,
            deletedForEveryone: true,
            deletedBy: msg.deletedBy,
          });
        } else if (deleteType === "me") {
          const newDeletedBy = [...new Set([...msg.deletedBy, userInfo.userId])];
          await db
            .update(messagesTable)
            .set({ deletedBy: newDeletedBy })
            .where(eq(messagesTable.id, messageId));

          socket.emit("message-deleted", {
            messageId,
            roomId,
            deletedForEveryone: false,
            deletedBy: newDeletedBy,
          });
        }
      }
    );

    // ── mark-read ──
    socket.on("mark-read", async (data: { roomId: string; messageId: string }) => {
      const userInfo = socketUsers.get(socket.id);
      if (!userInfo) return;

      const { roomId, messageId } = data;
      const receipt = {
        username: userInfo.username,
        avatarColor: userInfo.avatarColor,
        lastMessageId: messageId,
      };

      getReadReceipts(roomId).set(userInfo.userId, receipt);

      // Upsert in DB
      const existing = await db
        .select()
        .from(readReceiptsTable)
        .where(
          and(eq(readReceiptsTable.userId, userInfo.userId), eq(readReceiptsTable.roomId, roomId))
        );

      if (existing.length > 0) {
        await db
          .update(readReceiptsTable)
          .set({ lastMessageId: messageId, updatedAt: new Date() })
          .where(
            and(eq(readReceiptsTable.userId, userInfo.userId), eq(readReceiptsTable.roomId, roomId))
          );
      } else {
        await db.insert(readReceiptsTable).values({
          id: randomUUID(),
          userId: userInfo.userId,
          roomId,
          username: userInfo.username,
          avatarColor: userInfo.avatarColor,
          lastMessageId: messageId,
        });
      }

      io.to(roomId).emit("receipts-updated", {
        roomId,
        receipts: Object.fromEntries(getReadReceipts(roomId)),
      });
    });

    // ── typing-start ──
    socket.on("typing-start", (data: { roomId: string }) => {
      const userInfo = socketUsers.get(socket.id);
      if (!userInfo) return;
      const { roomId } = data;
      getTypingUsers(roomId).set(userInfo.userId, userInfo);
      io.to(roomId).emit("typing-update", {
        roomId,
        typers: Array.from(getTypingUsers(roomId).values()),
      });
    });

    // ── typing-stop ──
    socket.on("typing-stop", (data: { roomId: string }) => {
      const userInfo = socketUsers.get(socket.id);
      if (!userInfo) return;
      const { roomId } = data;
      getTypingUsers(roomId).delete(userInfo.userId);
      io.to(roomId).emit("typing-update", {
        roomId,
        typers: Array.from(getTypingUsers(roomId).values()),
      });
    });

    // ── disconnect ──
    socket.on("disconnect", () => {
      const userInfo = socketUsers.get(socket.id);
      if (userInfo) {
        userSockets.delete(userInfo.userId);
        socketUsers.delete(socket.id);

        // Clean up room membership and typing
        for (const [roomId, members] of roomMembers.entries()) {
          if (members.has(socket.id)) {
            members.delete(socket.id);
            getTypingUsers(roomId).delete(userInfo.userId);

            io.to(roomId).emit("room-members", { roomId, count: members.size });
            io.to(roomId).emit("typing-update", {
              roomId,
              typers: Array.from(getTypingUsers(roomId).values()),
            });
          }
        }
      }
      logger.info({ socketId: socket.id }, "Socket disconnected");
    });
  });

  return io;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function normalizeMessage(msg: {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  avatarColor: string;
  text: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  timestamp: Date;
  reactions: unknown;
  deletedForEveryone: boolean;
  deletedBy: string[];
}) {
  return {
    id: msg.id,
    roomId: msg.roomId,
    userId: msg.userId,
    username: msg.username,
    avatarColor: msg.avatarColor,
    text: msg.text ?? undefined,
    mediaUrl: msg.mediaUrl ?? undefined,
    mediaType: msg.mediaType ?? undefined,
    timestamp: msg.timestamp.getTime(),
    reactions: (msg.reactions as { emoji: string; userIds: string[] }[]) ?? [],
    deletedForEveryone: msg.deletedForEveryone,
    deletedBy: msg.deletedBy ?? [],
  };
}
