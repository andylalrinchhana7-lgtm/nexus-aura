import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { db, pushTokensTable } from "@workspace/db";
import { ne } from "drizzle-orm";
import { logger } from "./logger";

const expo = new Expo();

export interface PushPayload {
  senderId: string;
  roomId: string;
  roomName: string;
  senderName: string;
  messageText?: string;
  mediaType?: string;
  /** userIds currently viewing this room — skip them */
  activeViewers: Set<string>;
}

export async function sendMessagePushNotifications(payload: PushPayload): Promise<void> {
  const { senderId, roomId, roomName, senderName, messageText, mediaType, activeViewers } = payload;

  try {
    // Fetch all tokens except the sender's
    const tokens = await db
      .select()
      .from(pushTokensTable)
      .where(ne(pushTokensTable.userId, senderId));

    if (tokens.length === 0) return;

    // Build body preview
    let body: string;
    if (messageText) {
      body = messageText.length > 80 ? messageText.slice(0, 80) + "…" : messageText;
    } else if (mediaType === "image") {
      body = "📷 Photo";
    } else if (mediaType === "video") {
      body = "🎬 Video";
    } else if (mediaType === "audio") {
      body = "🎵 Audio message";
    } else {
      body = "New message";
    }

    // Filter tokens: skip users actively viewing this room
    const messages: ExpoPushMessage[] = [];
    for (const row of tokens) {
      if (activeViewers.has(row.userId)) continue;
      if (!Expo.isExpoPushToken(row.token)) {
        logger.warn({ token: row.token }, "Invalid Expo push token, skipping");
        continue;
      }
      messages.push({
        to: row.token,
        title: `${senderName} · ${roomName}`,
        body,
        data: { roomId, roomName, senderId },
        sound: "default",
        badge: 1,
        priority: "high",
        channelId: "messages",
      });
    }

    if (messages.length === 0) return;

    // Expo recommends chunking large batches
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        for (const ticket of tickets) {
          if (ticket.status === "error") {
            logger.warn({ ticket }, "Push notification error ticket");
          }
        }
      } catch (err) {
        logger.error({ err }, "Failed to send push notification chunk");
      }
    }
  } catch (err) {
    logger.error({ err }, "sendMessagePushNotifications failed");
  }
}
