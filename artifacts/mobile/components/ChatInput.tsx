import React, { useState, useRef, useCallback } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Platform,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export interface ReplyTo {
  id: string;
  username: string;
  text?: string;
  mediaType?: string;
}

interface Props {
  onSend: (text: string) => void;
  onSendMedia: (uri: string, type: "image" | "video" | "audio") => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  replyTo?: ReplyTo | null;
  onCancelReply?: () => void;
}

const TYPING_DEBOUNCE_MS = 1500;

export function ChatInput({
  onSend,
  onSendMedia,
  onTypingStart,
  onTypingStop,
  replyTo,
  onCancelReply,
}: Props) {
  const [text, setText] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const fireTypingStop = useCallback(() => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop?.();
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, [onTypingStop]);

  const handleTextChange = useCallback(
    (value: string) => {
      setText(value);

      if (!value.trim()) {
        fireTypingStop();
        return;
      }

      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTypingStart?.();
      }

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        fireTypingStop();
      }, TYPING_DEBOUNCE_MS);
    },
    [onTypingStart, fireTypingStop]
  );

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    fireTypingStop();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(trimmed);
    setText("");
    setShowExtra(false);
    onCancelReply?.();
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant photo library access.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
        base64: true,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSendMedia(uri, "image");
        setShowExtra(false);
      }
    } catch {
      Alert.alert("Error", "Could not open photo library");
    }
  };

  const pickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant photo library access.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.6,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSendMedia(uri, "video");
        setShowExtra(false);
      }
    } catch {
      Alert.alert("Error", "Could not open video library");
    }
  };

  const sendAudioSimulated = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSendMedia("audio_simulated", "audio");
    setShowExtra(false);
  };

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const replyPreview = replyTo?.text
    ? replyTo.text.length > 60
      ? replyTo.text.slice(0, 60) + "…"
      : replyTo.text
    : replyTo?.mediaType
    ? `📎 ${replyTo.mediaType}`
    : "";

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPad }]}>
      {/* ── Reply preview banner ── */}
      {replyTo && (
        <View style={styles.replyBanner}>
          <View style={styles.replyAccent} />
          <View style={styles.replyContent}>
            <Text style={styles.replyUsername}>{replyTo.username}</Text>
            <Text style={styles.replyPreview} numberOfLines={1}>{replyPreview}</Text>
          </View>
          <TouchableOpacity
            onPress={onCancelReply}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.replyClose}
          >
            <Feather name="x" size={16} color="#8696a0" />
          </TouchableOpacity>
        </View>
      )}

      {showExtra && (
        <View style={styles.extraRow}>
          <TouchableOpacity style={styles.extraBtn} onPress={pickImage}>
            <Feather name="image" size={22} color="#00a884" />
            <Text style={styles.extraLabel}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.extraBtn} onPress={pickVideo}>
            <Feather name="video" size={22} color="#00a884" />
            <Text style={styles.extraLabel}>Video</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.extraBtn} onPress={sendAudioSimulated}>
            <Feather name="music" size={22} color="#00a884" />
            <Text style={styles.extraLabel}>Audio</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.row}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setShowExtra((v) => !v)}
        >
          <Feather name={showExtra ? "x" : "plus"} size={22} color="#8696a0" />
        </TouchableOpacity>

        <View
          style={[
            styles.inputContainer,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={handleTextChange}
            placeholder="Message"
            placeholderTextColor="#8696a0"
            multiline
            maxLength={2000}
            returnKeyType="default"
          />
        </View>

        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: "#00a884" }]}
          onPress={text.trim() ? handleSend : sendAudioSimulated}
        >
          <Feather name={text.trim() ? "send" : "mic"} size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#0b141a",
    borderTopWidth: 1,
    borderTopColor: "#2a3942",
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2c34",
    marginHorizontal: 10,
    marginTop: 8,
    borderRadius: 10,
    overflow: "hidden",
  },
  replyAccent: {
    width: 3,
    alignSelf: "stretch",
    backgroundColor: "#00a884",
  },
  replyContent: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  replyUsername: {
    color: "#00a884",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  replyPreview: {
    color: "#8696a0",
    fontSize: 12,
  },
  replyClose: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  extraRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 20,
  },
  extraBtn: { alignItems: "center", gap: 4 },
  extraLabel: { color: "#8696a0", fontSize: 11 },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  inputContainer: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    maxHeight: 120,
  },
  input: {
    color: "#e9edef",
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
