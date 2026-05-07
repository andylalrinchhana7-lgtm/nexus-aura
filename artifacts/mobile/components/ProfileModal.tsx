import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ActiveRoom {
  id: string;
  name: string;
}

interface UserProfile {
  id: string;
  username: string;
  avatarColor: string;
  joinedAt: number;
  activeRooms: ActiveRoom[];
}

interface Props {
  userId: string | null;
  onClose: () => void;
  onRoomPress?: (roomId: string, roomName: string) => void;
}

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

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

function formatJoinDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ProfileModal({ userId, onClose, onRoomPress }: Props) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const slideAnim = useRef(new Animated.Value(500)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const visible = userId !== null;

  useEffect(() => {
    if (!visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 500, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
      return;
    }

    setProfile(null);
    setError(false);
    setLoading(true);

    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    fetch(`${BASE_URL}/api/users/${userId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json() as Promise<UserProfile>;
      })
      .then(setProfile)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [userId, visible]);

  if (!visible) return null;

  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom + 12;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: bottomPad, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.handle} />

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={20} color="#8696a0" />
        </TouchableOpacity>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color="#00a884" size="large" />
            <Text style={styles.loadingText}>Loading profile…</Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.center}>
            <Feather name="alert-circle" size={36} color="#8696a0" />
            <Text style={styles.loadingText}>Could not load profile</Text>
          </View>
        )}

        {profile && !loading && (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Avatar */}
            <View style={styles.avatarSection}>
              <View style={[styles.bigAvatar, { backgroundColor: profile.avatarColor }]}>
                <Text style={styles.bigAvatarText}>
                  {profile.username.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.profileName}>{profile.username}</Text>
              <Text style={styles.joinedText}>
                Joined {formatJoinDate(profile.joinedAt)}
              </Text>
            </View>

            {/* Rooms */}
            {profile.activeRooms.length > 0 && (
              <View style={styles.roomsSection}>
                <Text style={styles.sectionLabel}>Active in</Text>
                {profile.activeRooms.map((room, i) => {
                  const iconKey = Object.keys(ROOM_ICONS).find((k) =>
                    room.id.toLowerCase().includes(k)
                  );
                  const icon = iconKey ? ROOM_ICONS[iconKey]! : "hash";
                  const color = iconKey ? ROOM_COLORS[iconKey]! : "#8696a0";
                  return (
                    <React.Fragment key={room.id}>
                      <TouchableOpacity
                        style={styles.roomRow}
                        onPress={() => {
                          onRoomPress?.(room.id, room.name);
                          onClose();
                        }}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.roomIcon, { backgroundColor: color + "22" }]}>
                          <Feather name={icon} size={18} color={color} />
                        </View>
                        <Text style={styles.roomName}>{room.name}</Text>
                        <Feather name="chevron-right" size={14} color="#2a3942" />
                      </TouchableOpacity>
                      {i < profile.activeRooms.length - 1 && (
                        <View style={styles.divider} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1f2c34",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 280,
    maxHeight: "75%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    backgroundColor: "#2a3942",
    borderRadius: 2,
    marginTop: 12,
    marginBottom: 4,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0b141a",
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: { color: "#8696a0", fontSize: 14 },
  avatarSection: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 20,
  },
  bigAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  bigAvatarText: { color: "#fff", fontSize: 32, fontWeight: "800" },
  profileName: { color: "#e9edef", fontSize: 20, fontWeight: "700", marginBottom: 4 },
  joinedText: { color: "#8696a0", fontSize: 13 },
  roomsSection: {
    backgroundColor: "#0b141a",
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
  },
  sectionLabel: {
    color: "#8696a0",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  roomRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  roomIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  roomName: { flex: 1, color: "#e9edef", fontSize: 15, fontWeight: "500" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#2a3942",
    marginLeft: 62,
  },
});
