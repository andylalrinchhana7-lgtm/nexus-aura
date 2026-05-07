import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "💯"];

export function EmojiPicker({ onSelect, onClose }: Props) {
  return (
    <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
      <View style={styles.container}>
        {QUICK_EMOJIS.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            style={styles.emojiBtn}
            onPress={() => {
              onSelect(emoji);
              onClose();
            }}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flexDirection: "row",
    backgroundColor: "#1f2c34",
    borderRadius: 28,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  emojiBtn: {
    padding: 6,
    borderRadius: 20,
  },
  emoji: { fontSize: 26 },
});
