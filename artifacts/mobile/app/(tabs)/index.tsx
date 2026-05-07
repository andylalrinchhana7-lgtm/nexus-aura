import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  RefreshControl,
  Modal,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface Room {
  id: string;
  name: string;
  description: string;
  creatorId?: string | null;
  lastMessage?: string;
  lastTimestamp?: number;
}

const ROOM_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  general: "globe",
  tech: "cpu",
  music: "music",
  gaming: "zap",
};

const ROOM_COLORS: Record<string, string> = {
  general: "#00a884",
  tech: "#45B7D1",
  music: "#BB8FCE",
  gaming: "#F7DC6F",
};

const SYSTEM_ROOM_IDS = new Set(["general", "tech", "music", "gaming"]);

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Room action sheet
// ─────────────────────────────────────────────────────────────────────────────

interface RoomActionSheetProps {
  room: Room | null;
  isCreator: boolean;
  isSystemRoom: boolean;
  onClose: () => void;
  onDelete: (roomId: string) => Promise<void>;
  onLeave: (roomId: string) => void;
}

function RoomActionSheet({
  room,
  isCreator,
  isSystemRoom,
  onClose,
  onDelete,
  onLeave,
}: RoomActionSheetProps) {
  const [deleting, setDeleting] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (room) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [room]);

  const handleDelete = async () => {
    if (!room) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setDeleting(true);
    await onDelete(room.id);
    setDeleting(false);
  };

  const handleLeave = () => {
    if (!room) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLeave(room.id);
  };

  if (!room) return null;

  const iconName = ROOM_ICONS[room.id] ?? "hash";
  const iconColor = ROOM_COLORS[room.id] ?? "#00a884";

  return (
    <Modal
      visible={!!room}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={sheetStyles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[sheetStyles.sheet, { transform: [{ translateY: slideAnim }] }]}
      >
        {/* Room header */}
        <View style={sheetStyles.roomHeader}>
          <View style={[sheetStyles.roomIcon, { backgroundColor: iconColor + "22" }]}>
            <Feather name={iconName} size={28} color={iconColor} />
          </View>
          <View style={sheetStyles.roomMeta}>
            <Text style={sheetStyles.roomName} numberOfLines={1}>{room.name}</Text>
            {room.description ? (
              <Text style={sheetStyles.roomDesc} numberOfLines={1}>{room.description}</Text>
            ) : null}
            {isCreator && (
              <View style={sheetStyles.creatorBadge}>
                <Feather name="shield" size={10} color="#00a884" />
                <Text style={sheetStyles.creatorBadgeText}>You created this group</Text>
              </View>
            )}
          </View>
        </View>

        <View style={sheetStyles.divider} />

        {/* Actions */}
        {isCreator && (
          <TouchableOpacity
            style={sheetStyles.action}
            onPress={handleDelete}
            disabled={deleting}
            activeOpacity={0.7}
          >
            <View style={[sheetStyles.actionIcon, { backgroundColor: "rgba(239,68,68,0.12)" }]}>
              {deleting ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Feather name="trash-2" size={19} color="#ef4444" />
              )}
            </View>
            <View style={sheetStyles.actionText}>
              <Text style={[sheetStyles.actionLabel, { color: "#ef4444" }]}>
                {deleting ? "Deleting…" : "Delete Group"}
              </Text>
              <Text style={sheetStyles.actionSub}>
                Permanently removes this group and all messages for everyone
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {!isSystemRoom && !isCreator && (
          <TouchableOpacity
            style={sheetStyles.action}
            onPress={handleLeave}
            activeOpacity={0.7}
          >
            <View style={[sheetStyles.actionIcon, { backgroundColor: "rgba(134,150,160,0.12)" }]}>
              <Feather name="log-out" size={19} color="#8696a0" />
            </View>
            <View style={sheetStyles.actionText}>
              <Text style={sheetStyles.actionLabel}>Leave Group</Text>
              <Text style={sheetStyles.actionSub}>
                Hides this group from your chat list
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {isSystemRoom && (
          <TouchableOpacity
            style={sheetStyles.action}
            onPress={handleLeave}
            activeOpacity={0.7}
          >
            <View style={[sheetStyles.actionIcon, { backgroundColor: "rgba(134,150,160,0.12)" }]}>
              <Feather name="eye-off" size={19} color="#8696a0" />
            </View>
            <View style={sheetStyles.actionText}>
              <Text style={sheetStyles.actionLabel}>Hide from List</Text>
              <Text style={sheetStyles.actionSub}>
                Hides this room — pull to refresh to restore it
              </Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={sheetStyles.divider} />

        {/* Cancel */}
        <TouchableOpacity style={sheetStyles.cancelAction} onPress={onClose} activeOpacity={0.7}>
          <Text style={sheetStyles.cancelLabel}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1f2c34",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
    overflow: "hidden",
  },
  roomHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 14,
  },
  roomIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  roomMeta: { flex: 1 },
  roomName: { color: "#e9edef", fontSize: 17, fontWeight: "700" },
  roomDesc: { color: "#8696a0", fontSize: 13, marginTop: 2 },
  creatorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 5,
  },
  creatorBadgeText: { color: "#00a884", fontSize: 11, fontWeight: "600" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#2a3942",
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { flex: 1 },
  actionLabel: { color: "#e9edef", fontSize: 16, fontWeight: "600" },
  actionSub: { color: "#8696a0", fontSize: 12, marginTop: 2 },
  cancelAction: {
    alignItems: "center",
    paddingVertical: 17,
  },
  cancelLabel: { color: "#8696a0", fontSize: 16, fontWeight: "600" },
});

// ─────────────────────────────────────────────────────────────────────────────
// Chats screen
// ─────────────────────────────────────────────────────────────────────────────

const LEFT_ROOMS_KEY = (userId: string) => `nexus_left_rooms_${userId}`;

export default function ChatsScreen() {
  const { user } = useAuth();
  const { messages, unreadCounts, clearUnread, isConnected } = useSocket();
  const router = useRouter();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leftRoomIds, setLeftRoomIds] = useState<Set<string>>(new Set());
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Load persisted "left rooms" for this user
  const loadLeftRooms = useCallback(async () => {
    if (!user?.id) return;
    try {
      const raw = await AsyncStorage.getItem(LEFT_ROOMS_KEY(user.id));
      if (raw) setLeftRoomIds(new Set(JSON.parse(raw) as string[]));
    } catch {
      // ignore
    }
  }, [user?.id]);

  const saveLeftRooms = useCallback(
    async (updated: Set<string>) => {
      if (!user?.id) return;
      await AsyncStorage.setItem(
        LEFT_ROOMS_KEY(user.id),
        JSON.stringify([...updated])
      );
    },
    [user?.id]
  );

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/chat/rooms`);
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as Room[];
      setRooms(data);
    } catch {
      // silently fail; show stale or empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLeftRooms();
    fetchRooms();
  }, [loadLeftRooms, fetchRooms]);

  // Refetch when tab comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchRooms();
    }, [fetchRooms])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // On pull-to-refresh, also clear left rooms so system rooms come back
    setLeftRoomIds(new Set());
    if (user?.id) AsyncStorage.removeItem(LEFT_ROOMS_KEY(user.id));
    fetchRooms();
  }, [fetchRooms, user?.id]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user && !loading) router.replace("/login");
  }, [user, loading]);

  const openRoom = (room: Room) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearUnread(room.id);
    router.push({ pathname: "/room/[id]", params: { id: room.id, name: room.name } });
  };

  const handleLongPress = (room: Room) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSelectedRoom(room);
  };

  // ── Leave: hide locally and persist ──
  const handleLeave = useCallback(
    (roomId: string) => {
      setSelectedRoom(null);
      setLeftRoomIds((prev) => {
        const next = new Set(prev);
        next.add(roomId);
        saveLeftRooms(next);
        return next;
      });
      clearUnread(roomId);
    },
    [saveLeftRooms, clearUnread]
  );

  // ── Delete: call API then remove locally ──
  const handleDelete = useCallback(
    async (roomId: string) => {
      if (!user?.id) return;
      try {
        const res = await fetch(`${BASE_URL}/api/chat/rooms/${roomId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Delete failed");
        }
        setSelectedRoom(null);
        setRooms((prev) => prev.filter((r) => r.id !== roomId));
        clearUnread(roomId);
      } catch (err: unknown) {
        setSelectedRoom(null);
        // Re-show the error briefly via alert
        const msg = err instanceof Error ? err.message : "Could not delete the group.";
        setTimeout(() => {
          // Avoid calling Alert inside a promise chain — just log
          console.warn("Delete error:", msg);
        }, 100);
      }
    },
    [user?.id, clearUnread]
  );

  const visibleRooms = rooms.filter((r) => !leftRoomIds.has(r.id));

  const renderRoom = ({ item }: { item: Room }) => {
    const roomMsgs = messages[item.id] ?? [];
    const lastMsg = [...roomMsgs].reverse().find((m) => !(m as any).deletedForEveryone);
    const preview =
      lastMsg?.text ??
      (lastMsg?.mediaType === "image"
        ? "📷 Photo"
        : lastMsg?.mediaType === "video"
        ? "🎬 Video"
        : lastMsg?.mediaType === "audio"
        ? "🎵 Audio"
        : item.description);
    const ts = lastMsg?.timestamp ?? item.lastTimestamp;
    const iconName = ROOM_ICONS[item.id] ?? "hash";
    const iconColor = ROOM_COLORS[item.id] ?? "#00a884";
    const unread = unreadCounts[item.id] ?? 0;

    return (
      <TouchableOpacity
        style={styles.roomRow}
        onPress={() => openRoom(item)}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={400}
        activeOpacity={0.75}
      >
        <View style={[styles.roomIcon, { backgroundColor: iconColor + "22" }]}>
          <Feather name={iconName} size={26} color={iconColor} />
        </View>

        <View style={styles.roomBody}>
          <View style={styles.roomTop}>
            <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>
            {ts ? (
              <Text style={[styles.roomTime, unread > 0 && styles.roomTimeUnread]}>
                {formatTime(ts)}
              </Text>
            ) : null}
          </View>
          <View style={styles.roomBottom}>
            <Text style={styles.roomPreview} numberOfLines={1}>
              {lastMsg ? `${lastMsg.username}: ${preview}` : preview}
            </Text>
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const TAB_H = Platform.OS === "ios" ? 88 : 62;
  const bottomPad = Platform.OS === "web" ? TAB_H + 34 : TAB_H + 8;

  const isCreator = !!(selectedRoom && user?.id && selectedRoom.creatorId === user.id);
  const isSystemRoom = !!(selectedRoom && SYSTEM_ROOM_IDS.has(selectedRoom.id));

  return (
    <View style={styles.root}>
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Feather name="wifi-off" size={13} color="#F7DC6F" />
          <Text style={styles.offlineText}>Connecting to server…</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <View style={styles.spinnerWrap}>
            <Feather name="loader" size={28} color="#00a884" />
          </View>
          <Text style={styles.loadingText}>Loading chats…</Text>
        </View>
      ) : (
        <FlatList
          data={visibleRooms}
          keyExtractor={(item) => item.id}
          renderItem={renderRoom}
          contentContainerStyle={{ paddingBottom: bottomPad, paddingTop: 4 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#00a884"
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <View style={styles.emptyIcon}>
                <Feather name="message-square" size={40} color="#00a884" />
              </View>
              <Text style={styles.emptyText}>No chats yet</Text>
              <Text style={styles.emptySub}>
                Pull down to restore hidden rooms, or create a new group from the menu
              </Text>
            </View>
          }
          ListHeaderComponent={
            user ? (
              <View style={styles.userHeader}>
                <View
                  style={[
                    styles.userDot,
                    { backgroundColor: isConnected ? "#00a884" : "#8696a0" },
                  ]}
                />
                <Text style={styles.userHeaderText}>
                  {isConnected ? `Signed in as ${user.username}` : "Reconnecting…"}
                </Text>
              </View>
            ) : null
          }
        />
      )}

      <RoomActionSheet
        room={selectedRoom}
        isCreator={isCreator}
        isSystemRoom={isSystemRoom}
        onClose={() => setSelectedRoom(null)}
        onDelete={handleDelete}
        onLeave={handleLeave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b141a" },

  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#111b21",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2a3942",
  },
  offlineText: { color: "#F7DC6F", fontSize: 12, fontWeight: "500" },

  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
    gap: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1f2c34",
  },
  userDot: { width: 7, height: 7, borderRadius: 4 },
  userHeaderText: { color: "#8696a0", fontSize: 12 },

  roomRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: "#0b141a",
  },
  roomIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  roomBody: { flex: 1 },
  roomTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  roomName: { color: "#e9edef", fontSize: 16, fontWeight: "600", flex: 1, marginRight: 8 },
  roomTime: { color: "#8696a0", fontSize: 12 },
  roomTimeUnread: { color: "#00a884", fontWeight: "600" },
  roomBottom: { flexDirection: "row", alignItems: "center" },
  roomPreview: { color: "#8696a0", fontSize: 14, flex: 1 },
  badge: {
    backgroundColor: "#00a884",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    marginLeft: 6,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#1f2c34",
    marginLeft: 84,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  spinnerWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1f2c34",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1f2c34",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: "#8696a0", fontSize: 14 },
  emptyText: { color: "#e9edef", fontSize: 17, fontWeight: "600" },
  emptySub: { color: "#8696a0", fontSize: 14, textAlign: "center", lineHeight: 20 },
});
