import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Switch,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

const MUTE_KEY = (userId: string, roomId: string) => `nexus_mute_${userId}_${roomId}`;
const LEFT_ROOMS_KEY = (userId: string) => `nexus_left_rooms_${userId}`;

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

interface Member {
  userId: string;
  username: string;
  avatarColor: string;
}

interface RoomDetail {
  id: string;
  name: string;
  description: string;
  creatorId: string | null;
  createdAt: string;
  members: Member[];
  messageCount: number;
}

function Avatar({ username, color, size = 44 }: { username: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontSize: size * 0.4, fontWeight: "700" }}>
        {username.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export default function GroupInfoScreen() {
  const { id, name: nameParam } = useLocalSearchParams<{ id: string; name: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit description state
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);

  // Mute toggle
  const [muted, setMuted] = useState(false);

  // Fade-in animation for content
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isCreator = !!(room && user?.id && room.creatorId === user.id);
  const isSystemRoom = !!(room && SYSTEM_ROOM_IDS.has(room.id));

  const iconName = id ? (ROOM_ICONS[id] ?? "hash") : "hash";
  const iconColor = id ? (ROOM_COLORS[id] ?? "#00a884") : "#00a884";

  // ── Load room detail ──
  const fetchRoom = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/chat/rooms/${id}`);
      if (!res.ok) throw new Error("Room not found");
      const data = (await res.json()) as RoomDetail;
      setRoom(data);
      setDescDraft(data.description);
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // ── Load mute preference ──
  useEffect(() => {
    if (!user?.id || !id) return;
    AsyncStorage.getItem(MUTE_KEY(user.id, id)).then((val) => {
      if (val === "true") setMuted(true);
    });
  }, [user?.id, id]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  const handleMuteToggle = useCallback(
    async (val: boolean) => {
      if (!user?.id || !id) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setMuted(val);
      await AsyncStorage.setItem(MUTE_KEY(user.id, id), val ? "true" : "false");
    },
    [user?.id, id]
  );

  // ── Save description ──
  const handleSaveDesc = useCallback(async () => {
    if (!room || !user?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSavingDesc(true);
    try {
      const res = await fetch(`${BASE_URL}/api/chat/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, description: descDraft }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Save failed");
      }
      const updated = (await res.json()) as { description: string };
      setRoom((prev) => (prev ? { ...prev, description: updated.description } : prev));
      setDescDraft(updated.description);
      setEditingDesc(false);
    } catch {
      // silently keep editing open
    } finally {
      setSavingDesc(false);
    }
  }, [room, user?.id, descDraft]);

  // ── Leave group ──
  const handleLeave = useCallback(async () => {
    if (!user?.id || !id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const raw = await AsyncStorage.getItem(LEFT_ROOMS_KEY(user.id));
      const existing: string[] = raw ? (JSON.parse(raw) as string[]) : [];
      if (!existing.includes(id)) {
        await AsyncStorage.setItem(LEFT_ROOMS_KEY(user.id), JSON.stringify([...existing, id]));
      }
    } catch {
      // ignore
    }
    router.replace("/(tabs)");
  }, [user?.id, id, router]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 10);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.root, styles.center]}>
          <ActivityIndicator size="large" color="#00a884" />
          <Text style={styles.loadingText}>Loading group info…</Text>
        </View>
      </>
    );
  }

  if (error || !room) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.root, styles.center]}>
          <Feather name="alert-circle" size={40} color="#ef4444" />
          <Text style={styles.errorText}>{error ?? "Room not found"}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchRoom}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: topPad }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="arrow-left" size={22} color="#e9edef" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Group Info</Text>
          </View>
        </View>

        <Animated.ScrollView
          style={{ opacity: fadeAnim }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ── */}
          <View style={styles.hero}>
            <View style={[styles.heroIcon, { backgroundColor: iconColor + "22" }]}>
              <Feather name={iconName} size={52} color={iconColor} />
            </View>
            <Text style={styles.heroName}>{room.name}</Text>
            <Text style={styles.heroMeta}>
              Group · {room.members.length} {room.members.length === 1 ? "participant" : "participants"}
            </Text>
            {room.createdAt && (
              <Text style={styles.heroDate}>
                Created {new Date(room.createdAt).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
              </Text>
            )}
          </View>

          {/* ── Description card ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardLabelRow}>
                <Feather name="align-left" size={14} color="#8696a0" />
                <Text style={styles.cardLabel}>Description</Text>
              </View>
              {isCreator && !editingDesc && (
                <TouchableOpacity
                  onPress={() => { setEditingDesc(true); setDescDraft(room.description); }}
                  style={styles.editBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="edit-2" size={15} color="#00a884" />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {editingDesc ? (
              <View style={styles.editingWrap}>
                <TextInput
                  style={styles.descInput}
                  value={descDraft}
                  onChangeText={setDescDraft}
                  placeholder="Add a group description…"
                  placeholderTextColor="#8696a0"
                  multiline
                  maxLength={200}
                  autoFocus
                />
                <Text style={styles.charCount}>{descDraft.length}/200</Text>
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={styles.cancelEditBtn}
                    onPress={() => { setEditingDesc(false); setDescDraft(room.description); }}
                  >
                    <Text style={styles.cancelEditBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, savingDesc && styles.saveBtnDisabled]}
                    onPress={handleSaveDesc}
                    disabled={savingDesc}
                  >
                    {savingDesc ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveBtnText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={[styles.descText, !room.description && styles.descPlaceholder]}>
                {room.description || (isCreator ? "Tap Edit to add a description" : "No description")}
              </Text>
            )}
          </View>

          {/* ── Creator card ── */}
          {room.creatorId && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardLabelRow}>
                  <Feather name="shield" size={14} color="#8696a0" />
                  <Text style={styles.cardLabel}>Group Creator</Text>
                </View>
              </View>
              {(() => {
                const creator = room.members.find((m) => m.userId === room.creatorId);
                if (!creator) return (
                  <Text style={styles.descPlaceholder}>Creator hasn't sent a message yet</Text>
                );
                return (
                  <View style={styles.creatorRow}>
                    <Avatar username={creator.username} color={creator.avatarColor} size={40} />
                    <View style={styles.creatorMeta}>
                      <Text style={styles.memberName}>{creator.username}</Text>
                      {creator.userId === user?.id && (
                        <Text style={styles.youBadge}>You</Text>
                      )}
                    </View>
                    <View style={styles.creatorBadge}>
                      <Feather name="shield" size={12} color="#00a884" />
                      <Text style={styles.creatorBadgeText}>Creator</Text>
                    </View>
                  </View>
                );
              })()}
            </View>
          )}

          {/* ── Quick Actions ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardLabelRow}>
                <Feather name="sliders" size={14} color="#8696a0" />
                <Text style={styles.cardLabel}>Quick Actions</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <View style={styles.actionRowLeft}>
                <View style={[styles.actionRowIcon, { backgroundColor: muted ? "rgba(239,68,68,0.12)" : "rgba(0,168,132,0.12)" }]}>
                  <Feather name={muted ? "bell-off" : "bell"} size={18} color={muted ? "#ef4444" : "#00a884"} />
                </View>
                <View>
                  <Text style={styles.actionRowLabel}>Mute Notifications</Text>
                  <Text style={styles.actionRowSub}>{muted ? "Notifications silenced" : "You'll get all notifications"}</Text>
                </View>
              </View>
              <Switch
                value={muted}
                onValueChange={handleMuteToggle}
                trackColor={{ false: "#2a3942", true: "#ef444466" }}
                thumbColor={muted ? "#ef4444" : "#8696a0"}
                ios_backgroundColor="#2a3942"
              />
            </View>
          </View>

          {/* ── Members card ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardLabelRow}>
                <Feather name="users" size={14} color="#8696a0" />
                <Text style={styles.cardLabel}>
                  {room.members.length} {room.members.length === 1 ? "Participant" : "Participants"}
                </Text>
              </View>
            </View>

            {room.members.length === 0 ? (
              <Text style={styles.descPlaceholder}>No messages yet — participants will appear here</Text>
            ) : (
              room.members.map((member, i) => {
                const isMe = member.userId === user?.id;
                const isGroupCreator = member.userId === room.creatorId;
                return (
                  <View
                    key={member.userId}
                    style={[
                      styles.memberRow,
                      i < room.members.length - 1 && styles.memberRowBorder,
                    ]}
                  >
                    <Avatar username={member.username} color={member.avatarColor} size={44} />
                    <View style={styles.memberMeta}>
                      <Text style={styles.memberName}>
                        {member.username}
                        {isMe ? " (You)" : ""}
                      </Text>
                      {isGroupCreator && (
                        <View style={styles.roleBadge}>
                          <Feather name="shield" size={10} color="#00a884" />
                          <Text style={styles.roleBadgeText}>Creator</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* ── Stats card ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardLabelRow}>
                <Feather name="bar-chart-2" size={14} color="#8696a0" />
                <Text style={styles.cardLabel}>Stats</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{room.messageCount}</Text>
                <Text style={styles.statLabel}>Messages</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{room.members.length}</Text>
                <Text style={styles.statLabel}>Participants</Text>
              </View>
            </View>
          </View>

          {/* ── Danger zone ── */}
          {!isSystemRoom && (
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.dangerAction}
                onPress={handleLeave}
                activeOpacity={0.75}
              >
                <View style={[styles.dangerIcon, { backgroundColor: "rgba(239,68,68,0.12)" }]}>
                  <Feather name="log-out" size={18} color="#ef4444" />
                </View>
                <Text style={styles.dangerLabel}>
                  {isCreator ? "Leave Group (others keep access)" : "Leave Group"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b141a" },
  center: { alignItems: "center", justifyContent: "center", gap: 16 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2c34",
    paddingBottom: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2a3942",
  },
  backBtn: { padding: 8 },
  headerInfo: { flex: 1, paddingHorizontal: 8 },
  headerTitle: { color: "#e9edef", fontSize: 16, fontWeight: "700" },

  hero: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 24, gap: 8 },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroName: { color: "#e9edef", fontSize: 24, fontWeight: "700", textAlign: "center" },
  heroMeta: { color: "#8696a0", fontSize: 14 },
  heroDate: { color: "#8696a0", fontSize: 12, marginTop: 2 },

  card: {
    backgroundColor: "#1f2c34",
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 14,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardLabel: { color: "#8696a0", fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  editBtnText: { color: "#00a884", fontSize: 14, fontWeight: "600" },

  descText: { color: "#e9edef", fontSize: 15, lineHeight: 22 },
  descPlaceholder: { color: "#8696a0", fontSize: 14, fontStyle: "italic" },

  editingWrap: { gap: 10 },
  descInput: {
    backgroundColor: "#0b141a",
    borderRadius: 10,
    padding: 12,
    color: "#e9edef",
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: "top",
  },
  charCount: { color: "#8696a0", fontSize: 12, textAlign: "right" },
  editActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  cancelEditBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#2a3942",
  },
  cancelEditBtnText: { color: "#8696a0", fontSize: 14, fontWeight: "600" },
  saveBtn: {
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#00a884",
    minWidth: 72,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  creatorRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  creatorMeta: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  youBadge: { color: "#8696a0", fontSize: 12 },
  creatorBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,168,132,0.12)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  creatorBadgeText: { color: "#00a884", fontSize: 11, fontWeight: "600" },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionRowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  actionRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRowLabel: { color: "#e9edef", fontSize: 15, fontWeight: "500" },
  actionRowSub: { color: "#8696a0", fontSize: 12, marginTop: 1 },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  memberRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2a3942",
  },
  memberMeta: { flex: 1 },
  memberName: { color: "#e9edef", fontSize: 15, fontWeight: "500" },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  roleBadgeText: { color: "#00a884", fontSize: 11, fontWeight: "600" },

  statsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: 4 },
  statItem: { alignItems: "center", flex: 1, gap: 3 },
  statNum: { color: "#e9edef", fontSize: 24, fontWeight: "700" },
  statLabel: { color: "#8696a0", fontSize: 12 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 40, backgroundColor: "#2a3942" },

  dangerAction: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 4 },
  dangerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  dangerLabel: { color: "#ef4444", fontSize: 15, fontWeight: "600" },

  loadingText: { color: "#8696a0", fontSize: 14 },
  errorText: { color: "#ef4444", fontSize: 15, textAlign: "center" },
  retryBtn: { backgroundColor: "#1f2c34", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  retryBtnText: { color: "#00a884", fontSize: 14, fontWeight: "600" },
});
