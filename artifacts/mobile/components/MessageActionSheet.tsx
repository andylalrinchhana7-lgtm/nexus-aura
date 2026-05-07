import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TouchableWithoutFeedback,
  Platform,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface MessageInfo {
  id: string;
  userId: string;
  text?: string;
  mediaType?: string;
}

interface Props {
  visible: boolean;
  message: MessageInfo | null;
  isOwn: boolean;
  onDeleteForEveryone: () => void;
  onDeleteForMe: () => void;
  onReaction: (emoji: string) => void;
  onReply?: () => void;
  onClose: () => void;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "😡"];

export function MessageActionSheet({
  visible,
  message,
  isOwn,
  onDeleteForEveryone,
  onDeleteForMe,
  onReaction,
  onReply,
  onClose,
}: Props) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 22, stiffness: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!message) return null;

  const preview = message.text
    ? message.text.length > 80
      ? message.text.slice(0, 80) + "…"
      : message.text
    : message.mediaType
    ? `📎 ${message.mediaType}`
    : "";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        pointerEvents="box-none"
      >
        <View style={styles.handleBar} />

        {preview.length > 0 && (
          <View style={styles.previewRow}>
            <View style={styles.previewAccent} />
            <Text style={styles.previewText} numberOfLines={2}>{preview}</Text>
          </View>
        )}

        {/* Quick emoji reactions */}
        <View style={styles.emojiSection}>
          <Text style={styles.sectionLabel}>React</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.emojiRow}
          >
            {QUICK_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.emojiBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onReaction(emoji);
                }}
                activeOpacity={0.65}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.divider} />

        {/* Reply action */}
        {onReply && (
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onReply();
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, styles.iconCircleAccent]}>
              <Feather name="corner-up-left" size={18} color="#00a884" />
            </View>
            <View style={styles.actionTexts}>
              <Text style={styles.actionTitle}>Reply</Text>
              <Text style={styles.actionSub}>Quote this message in your reply</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#2a3942" />
          </TouchableOpacity>
        )}

        {/* Delete for everyone — only own messages */}
        {isOwn && (
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              onDeleteForEveryone();
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, styles.iconCircleDanger]}>
              <Feather name="trash-2" size={18} color="#ef4444" />
            </View>
            <View style={styles.actionTexts}>
              <Text style={[styles.actionTitle, styles.dangerText]}>Delete for everyone</Text>
              <Text style={styles.actionSub}>Permanently removes for all participants</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#2a3942" />
          </TouchableOpacity>
        )}

        {/* Delete for me */}
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onDeleteForMe();
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.iconCircle, styles.iconCircleMuted]}>
            <Feather name="eye-off" size={18} color="#8696a0" />
          </View>
          <View style={styles.actionTexts}>
            <Text style={styles.actionTitle}>Delete for me</Text>
            <Text style={styles.actionSub}>Only hidden from your view</Text>
          </View>
          <Feather name="chevron-right" size={16} color="#2a3942" />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.cancelRow}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onClose();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelLabel}>Cancel</Text>
        </TouchableOpacity>

        {Platform.OS === "ios" && <View style={{ height: 20 }} />}
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
  },
  handleBar: {
    alignSelf: "center",
    width: 36,
    height: 4,
    backgroundColor: "#2a3942",
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 4,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginVertical: 12,
    backgroundColor: "#0b141a",
    borderRadius: 10,
    padding: 12,
  },
  previewAccent: {
    width: 3,
    height: "100%",
    minHeight: 16,
    backgroundColor: "#00a884",
    borderRadius: 2,
  },
  previewText: {
    flex: 1,
    color: "#8696a0",
    fontSize: 13,
    lineHeight: 19,
  },
  sectionLabel: {
    color: "#8696a0",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
    marginLeft: 20,
  },
  emojiSection: { paddingTop: 12, paddingBottom: 4 },
  emojiRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 4,
  },
  emojiBtn: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: "#0b141a",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2a3942",
  },
  emojiText: { fontSize: 24 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#2a3942",
    marginVertical: 4,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleAccent: { backgroundColor: "rgba(0,168,132,0.12)" },
  iconCircleDanger: { backgroundColor: "rgba(239,68,68,0.12)" },
  iconCircleMuted: { backgroundColor: "#0b141a" },
  actionTexts: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: "600", color: "#e9edef" },
  actionSub: { fontSize: 12, color: "#8696a0", marginTop: 2 },
  dangerText: { color: "#ef4444" },
  cancelRow: {
    alignItems: "center",
    paddingVertical: 16,
  },
  cancelLabel: {
    fontSize: 16,
    color: "#8696a0",
    fontWeight: "500",
  },
});
