import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  PanResponder,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

interface Reaction {
  emoji: string;
  userIds: string[];
}

interface Message {
  id: string;
  userId: string;
  username: string;
  avatarColor: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio";
  timestamp: number;
  reactions: Reaction[];
  deletedForEveryone?: boolean;
  deletedBy?: string[];
}

interface SeenByUser {
  username: string;
  avatarColor: string;
}

interface Props {
  message: Message;
  isOwn: boolean;
  seenBy?: SeenByUser[];
  searchQuery?: string;
  onLongPress?: (messageId: string) => void;
  onReactionPress?: (emoji: string) => void;
  onAvatarPress?: (userId: string, username: string) => void;
  onSwipeReply?: (message: Message) => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function HighlightedText({
  text,
  query,
  baseStyle,
}: {
  text: string;
  query: string;
  baseStyle: object;
}) {
  const q = query.trim();
  if (!q) return <Text style={baseStyle}>{text}</Text>;

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  const lowerQ = q.toLowerCase();

  return (
    <Text style={baseStyle}>
      {parts.map((part, i) =>
        part.toLowerCase() === lowerQ ? (
          <Text key={i} style={styles.highlight}>{part}</Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

function Avatar({
  username,
  color,
  size = 28,
  onPress,
}: {
  username: string;
  color: string;
  size?: number;
  onPress?: () => void;
}) {
  const inner = (
    <View
      style={[
        styles.avatar,
        { backgroundColor: color, width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.43 }]}>
        {username.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

function AudioWave() {
  const bars = [8, 14, 20, 16, 24, 12, 18, 22, 10, 16, 20, 14];
  return (
    <View style={styles.audioWave}>
      <Feather name="play" size={18} color="#8696a0" style={{ marginRight: 8 }} />
      <View style={styles.waveBars}>
        {bars.map((h, i) => (
          <View key={i} style={[styles.waveBar, { height: h, opacity: i < 6 ? 0.9 : 0.4 }]} />
        ))}
      </View>
      <Text style={styles.audioDuration}>0:30</Text>
    </View>
  );
}

function SeenByRow({ users }: { users: SeenByUser[] }) {
  if (users.length === 0) return null;
  const shown = users.slice(0, 4);
  const overflow = users.length - shown.length;
  const names = users.map((u) => u.username).join(", ");
  return (
    <View style={styles.seenByRow}>
      <View style={styles.seenAvatars}>
        {shown.map((u, i) => (
          <View
            key={u.username}
            style={[styles.seenAvatarWrap, { zIndex: shown.length - i, marginLeft: i === 0 ? 0 : -5 }]}
          >
            <Avatar username={u.username} color={u.avatarColor} size={14} />
          </View>
        ))}
        {overflow > 0 && (
          <View style={[styles.seenAvatarWrap, { marginLeft: -5, zIndex: 0 }]}>
            <View style={styles.seenOverflow}>
              <Text style={styles.seenOverflowText}>+{overflow}</Text>
            </View>
          </View>
        )}
      </View>
      <Text style={styles.seenByText} numberOfLines={1}>
        {users.length === 1 ? `Seen by ${names}` : `Seen by ${users.length}`}
      </Text>
    </View>
  );
}

export function ChatBubble({
  message,
  isOwn,
  seenBy,
  searchQuery = "",
  onLongPress,
  onReactionPress,
  onAvatarPress,
  onSwipeReply,
}: Props) {
  const colors = useColors();
  const panX = useRef(new Animated.Value(0)).current;
  const replyTriggered = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dy) < 20,
      onPanResponderGrant: () => {
        replyTriggered.current = false;
      },
      onPanResponderMove: (_, g) => {
        if (g.dx > 0) {
          const clamped = Math.min(g.dx * 0.5, 72);
          panX.setValue(clamped);
          if (g.dx > 70 && !replyTriggered.current) {
            replyTriggered.current = true;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }
      },
      onPanResponderRelease: () => {
        if (replyTriggered.current) {
          onSwipeReply?.(message);
        }
        replyTriggered.current = false;
        Animated.spring(panX, { toValue: 0, useNativeDriver: true, friction: 6 }).start();
      },
      onPanResponderTerminate: () => {
        replyTriggered.current = false;
        Animated.spring(panX, { toValue: 0, useNativeDriver: true, friction: 6 }).start();
      },
    })
  ).current;

  const isDeleted = message.deletedForEveryone === true;

  const bubbleStyle = [
    styles.bubble,
    isOwn ? { backgroundColor: "#005c4b" } : { backgroundColor: colors.card },
    isOwn ? styles.bubbleOwn : styles.bubbleOther,
    isDeleted && styles.bubbleDeleted,
  ];

  const textStyle = { color: "#e9edef", fontSize: 15, lineHeight: 20 } as const;

  const replyIconOpacity = panX.interpolate({
    inputRange: [0, 36, 72],
    outputRange: [0, 0.5, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      {/* Swipe-to-reply arrow (visible on swipe) */}
      {!isDeleted && onSwipeReply && (
        <Animated.View
          style={[
            styles.replyArrow,
            isOwn ? styles.replyArrowOwn : styles.replyArrowOther,
            { opacity: replyIconOpacity },
          ]}
        >
          <Feather name="corner-up-left" size={18} color="#00a884" />
        </Animated.View>
      )}

      {!isOwn && (
        <Avatar
          username={message.username}
          color={message.avatarColor}
          onPress={onAvatarPress ? () => onAvatarPress(message.userId, message.username) : undefined}
        />
      )}

      <Animated.View
        style={[
          styles.contentWrapper,
          isOwn ? styles.wrapperOwn : styles.wrapperOther,
          { transform: [{ translateX: panX }] },
        ]}
        {...(isDeleted ? {} : panResponder.panHandlers)}
      >
        {!isOwn && (
          <TouchableOpacity
            onPress={onAvatarPress ? () => onAvatarPress(message.userId, message.username) : undefined}
            activeOpacity={onAvatarPress ? 0.7 : 1}
          >
            <Text style={[styles.username, { color: message.avatarColor }]}>
              {message.username}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onLongPress={isDeleted ? undefined : () => onLongPress?.(message.id)}
          delayLongPress={400}
          activeOpacity={isDeleted ? 1 : 0.85}
          style={bubbleStyle}
        >
          {isDeleted ? (
            <View style={styles.deletedRow}>
              <Feather name="slash" size={13} color="#8696a0" style={{ marginRight: 6 }} />
              <Text style={styles.deletedText}>This message was deleted</Text>
            </View>
          ) : message.mediaType === "image" && message.mediaUrl ? (
            <View>
              <Image source={{ uri: message.mediaUrl }} style={styles.mediaImage} resizeMode="cover" />
              {message.text ? (
                <HighlightedText
                  text={message.text}
                  query={searchQuery}
                  baseStyle={{ ...textStyle, marginTop: 4 }}
                />
              ) : null}
            </View>
          ) : message.mediaType === "video" ? (
            <View style={styles.videoPlaceholder}>
              <Feather name="video" size={28} color="#8696a0" />
              <Text style={styles.videoText}>Video</Text>
            </View>
          ) : message.mediaType === "audio" ? (
            <AudioWave />
          ) : (
            <HighlightedText
              text={message.text ?? ""}
              query={searchQuery}
              baseStyle={textStyle}
            />
          )}

          <View style={styles.metaRow}>
            <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
            {isOwn && !isDeleted && (
              <Feather
                name={seenBy && seenBy.length > 0 ? "check-circle" : "check"}
                size={11}
                color={seenBy && seenBy.length > 0 ? "#53bdeb" : "#8696a0"}
                style={{ marginLeft: 3 }}
              />
            )}
          </View>
        </TouchableOpacity>

        {isOwn && seenBy && seenBy.length > 0 && !isDeleted && <SeenByRow users={seenBy} />}

        {!isDeleted && message.reactions.length > 0 && (
          <View style={[styles.reactionsRow, isOwn ? styles.reactionsOwn : styles.reactionsOther]}>
            {message.reactions.map((r) => (
              <TouchableOpacity
                key={r.emoji}
                onPress={() => onReactionPress?.(r.emoji)}
                style={[styles.reactionChip, { borderColor: colors.border }]}
              >
                <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                {r.userIds.length > 1 && (
                  <Text style={styles.reactionCount}>{r.userIds.length}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginVertical: 3,
    paddingHorizontal: 12,
    alignItems: "flex-end",
  },
  rowOwn: { justifyContent: "flex-end" },
  rowOther: { justifyContent: "flex-start" },
  replyArrow: {
    position: "absolute",
    zIndex: 1,
    bottom: 12,
  },
  replyArrowOther: { left: 46 },
  replyArrowOwn: { right: 4 },
  avatar: { alignItems: "center", justifyContent: "center", marginRight: 6, marginBottom: 2 },
  avatarText: { color: "#fff", fontWeight: "700" },
  contentWrapper: { maxWidth: "78%" },
  wrapperOwn: { alignItems: "flex-end" },
  wrapperOther: { alignItems: "flex-start" },
  username: { fontSize: 12, fontWeight: "600", marginBottom: 2, marginLeft: 4 },
  bubble: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 4,
    minWidth: 60,
  },
  bubbleOwn: { borderBottomRightRadius: 3 },
  bubbleOther: { borderBottomLeftRadius: 3 },
  bubbleDeleted: { opacity: 0.7 },
  deletedRow: { flexDirection: "row", alignItems: "center", paddingVertical: 2 },
  deletedText: { color: "#8696a0", fontSize: 13, fontStyle: "italic" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 2,
  },
  timestamp: { fontSize: 10, color: "#8696a0" },
  mediaImage: { width: 220, height: 180, borderRadius: 6 },
  videoPlaceholder: {
    width: 220,
    height: 130,
    backgroundColor: "#2a3942",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  videoText: { color: "#8696a0", fontSize: 13 },
  audioWave: { flexDirection: "row", alignItems: "center", width: 200, paddingVertical: 4 },
  waveBars: { flexDirection: "row", alignItems: "center", flex: 1, gap: 2 },
  waveBar: { width: 3, backgroundColor: "#8696a0", borderRadius: 2 },
  audioDuration: { color: "#8696a0", fontSize: 12, marginLeft: 8 },
  reactionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  reactionsOwn: { justifyContent: "flex-end" },
  reactionsOther: { justifyContent: "flex-start" },
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2c34",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { color: "#8696a0", fontSize: 11 },
  seenByRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    marginRight: 4,
    gap: 5,
  },
  seenAvatars: { flexDirection: "row", alignItems: "center" },
  seenAvatarWrap: { borderWidth: 1, borderColor: "#0b141a", borderRadius: 8 },
  seenOverflow: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#2a3942",
    alignItems: "center",
    justifyContent: "center",
  },
  seenOverflowText: { color: "#8696a0", fontSize: 7, fontWeight: "700" },
  seenByText: { color: "#53bdeb", fontSize: 11 },
  highlight: {
    backgroundColor: "#f0e040",
    color: "#0b141a",
    fontWeight: "700",
    borderRadius: 2,
  },
});
