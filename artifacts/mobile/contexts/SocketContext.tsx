import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  avatarColor: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio";
  timestamp: number;
  reactions: { emoji: string; userIds: string[] }[];
  deletedForEveryone: boolean;
  deletedBy: string[];
}

export interface ReadReceipt {
  username: string;
  avatarColor: string;
  lastMessageId: string;
}

export interface TypingUser {
  userId: string;
  username: string;
  avatarColor: string;
}

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  activeRoomId: string | null;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (data: {
    roomId: string;
    text?: string;
    mediaUrl?: string;
    mediaType?: "image" | "video" | "audio";
  }) => void;
  addReaction: (messageId: string, roomId: string, emoji: string) => void;
  deleteMessage: (messageId: string, roomId: string, deleteType: "everyone" | "me") => void;
  markRead: (roomId: string, messageId: string) => void;
  startTyping: (roomId: string) => void;
  stopTyping: (roomId: string) => void;
  messages: Record<string, Message[]>;
  memberCounts: Record<string, number>;
  unreadCounts: Record<string, number>;
  readReceipts: Record<string, Record<string, ReadReceipt>>;
  typingUsers: Record<string, TypingUser[]>;
  clearUnread: (roomId: string) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [readReceipts, setReadReceipts] = useState<Record<string, Record<string, ReadReceipt>>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingUser[]>>({});
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const activeRoomRef = useRef<string | null>(null);

  useEffect(() => {
    activeRoomRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const socket = io(BASE_URL, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("authenticate", { userId: user.id });
    });

    socket.on("disconnect", () => setIsConnected(false));

    socket.on("room-history", (history: Message[]) => {
      if (history.length === 0) return;
      const roomId = history[0]?.roomId;
      if (!roomId) return;
      setMessages((prev) => ({ ...prev, [roomId]: history }));
    });

    socket.on("new-message", (message: Message) => {
      setMessages((prev) => {
        const existing = prev[message.roomId] ?? [];
        return { ...prev, [message.roomId]: [...existing, message] };
      });
      if (activeRoomRef.current !== message.roomId) {
        setUnreadCounts((prev) => ({
          ...prev,
          [message.roomId]: (prev[message.roomId] ?? 0) + 1,
        }));
      }
    });

    socket.on(
      "reaction-updated",
      ({ messageId, reactions }: { messageId: string; reactions: Message["reactions"] }) => {
        setMessages((prev) => {
          const updated = { ...prev };
          for (const roomId of Object.keys(updated)) {
            updated[roomId] = (updated[roomId] ?? []).map((m) =>
              m.id === messageId ? { ...m, reactions } : m
            );
          }
          return updated;
        });
      }
    );

    socket.on(
      "message-deleted",
      ({
        messageId,
        roomId,
        deletedForEveryone,
        deletedBy,
      }: {
        messageId: string;
        roomId: string;
        deletedForEveryone: boolean;
        deletedBy: string[];
      }) => {
        setMessages((prev) => {
          const roomMsgs = prev[roomId] ?? [];
          return {
            ...prev,
            [roomId]: roomMsgs.map((m) =>
              m.id === messageId ? { ...m, deletedForEveryone, deletedBy } : m
            ),
          };
        });
      }
    );

    socket.on("room-members", ({ roomId, count }: { roomId: string; count: number }) => {
      setMemberCounts((prev) => ({ ...prev, [roomId]: count }));
    });

    socket.on(
      "receipts-snapshot",
      ({ roomId, receipts }: { roomId: string; receipts: Record<string, ReadReceipt> }) => {
        setReadReceipts((prev) => ({ ...prev, [roomId]: receipts }));
      }
    );

    socket.on(
      "receipts-updated",
      ({ roomId, receipts }: { roomId: string; receipts: Record<string, ReadReceipt> }) => {
        setReadReceipts((prev) => ({ ...prev, [roomId]: receipts }));
      }
    );

    socket.on(
      "typing-update",
      ({ roomId, typers }: { roomId: string; typers: TypingUser[] }) => {
        const others = typers.filter((t) => t.userId !== user.id);
        setTypingUsers((prev) => ({ ...prev, [roomId]: others }));
      }
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const joinRoom = useCallback(
    (roomId: string) => {
      if (!socketRef.current || !user) return;
      setActiveRoomId(roomId);
      activeRoomRef.current = roomId;
      socketRef.current.emit("join-room", { roomId, userId: user.id });
    },
    [user]
  );

  const leaveRoom = useCallback((roomId: string) => {
    if (!socketRef.current) return;
    setActiveRoomId(null);
    activeRoomRef.current = null;
    socketRef.current.emit("leave-room", { roomId });
  }, []);

  const sendMessage = useCallback(
    (data: {
      roomId: string;
      text?: string;
      mediaUrl?: string;
      mediaType?: "image" | "video" | "audio";
    }) => {
      if (!socketRef.current) return;
      socketRef.current.emit("send-message", data);
    },
    []
  );

  const addReaction = useCallback((messageId: string, roomId: string, emoji: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit("add-reaction", { messageId, roomId, emoji });
  }, []);

  const deleteMessage = useCallback(
    (messageId: string, roomId: string, deleteType: "everyone" | "me") => {
      if (!socketRef.current) return;
      socketRef.current.emit("delete-message", { messageId, roomId, deleteType });
    },
    []
  );

  const markRead = useCallback((roomId: string, messageId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit("mark-read", { roomId, messageId });
  }, []);

  const startTyping = useCallback((roomId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit("typing-start", { roomId });
  }, []);

  const stopTyping = useCallback((roomId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit("typing-stop", { roomId });
  }, []);

  const clearUnread = useCallback((roomId: string) => {
    setUnreadCounts((prev) => ({ ...prev, [roomId]: 0 }));
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        activeRoomId,
        joinRoom,
        leaveRoom,
        sendMessage,
        addReaction,
        deleteMessage,
        markRead,
        startTyping,
        stopTyping,
        messages,
        memberCounts,
        unreadCounts,
        readReceipts,
        typingUsers,
        clearUnread,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}
