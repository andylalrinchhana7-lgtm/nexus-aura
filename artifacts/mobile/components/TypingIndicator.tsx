import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import type { TypingUser } from "@/contexts/SocketContext";

interface Props {
  typers: TypingUser[];
}

function Dot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: -6, duration: 300, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(600 - delay),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);

  return (
    <Animated.View style={[styles.dot, { transform: [{ translateY: anim }] }]} />
  );
}

function typingLabel(typers: TypingUser[]): string {
  if (typers.length === 1) return `${typers[0]!.username} is typing`;
  if (typers.length === 2)
    return `${typers[0]!.username} and ${typers[1]!.username} are typing`;
  return "Several people are typing";
}

export function TypingIndicator({ typers }: Props) {
  if (typers.length === 0) return null;

  return (
    <View style={styles.row}>
      <View style={styles.avatars}>
        {typers.slice(0, 3).map((t, i) => (
          <View
            key={t.userId}
            style={[
              styles.avatar,
              { backgroundColor: t.avatarColor, marginLeft: i === 0 ? 0 : -6, zIndex: 3 - i },
            ]}
          >
            <Text style={styles.avatarText}>{t.username.charAt(0).toUpperCase()}</Text>
          </View>
        ))}
      </View>

      <View style={styles.bubble}>
        <Dot delay={0} />
        <Dot delay={160} />
        <Dot delay={320} />
      </View>

      <Text style={styles.label} numberOfLines={1}>
        {typingLabel(typers)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 5,
    gap: 8,
  },
  avatars: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#0b141a",
  },
  avatarText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2c34",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 4,
    minWidth: 48,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#8696a0",
  },
  label: {
    color: "#8696a0",
    fontSize: 12,
    fontStyle: "italic",
    flex: 1,
  },
});
