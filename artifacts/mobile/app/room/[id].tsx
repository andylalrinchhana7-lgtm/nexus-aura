import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { ChatBubble } from "@/components/ChatBubble";
import { ChatInput, type ReplyTo } from "@/components/ChatInput";
import { TypingIndicator } from "@/components/TypingIndicator";
import { ProfileModal } from "@/components/ProfileModal";
import { MessageActionSheet } from "@/components/MessageActionSheet";

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

export default function RoomScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { user } = useAuth();
  const {
    messages,
    memberCounts,
    readReceipts,
    typingUsers,
    joinRoom,
    leaveRoom,
    sendMessage,
    addReaction,
    deleteMessage,
    markRead,
    startTyping,
    stopTyping,
    clearUnread,
    isConnected,
  } = useSocket();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const searchInputRef = useRef<TextInput>(null);

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);

  const roomMessages: Message[] = (messages[id ?? ""] ?? []) as Message[];
  const currentTypers = typingUsers[id ?? ""] ?? [];

  const visibleMessages = useMemo(() => {
    if (!user) return roomMessages;
    return roomMessages.filter((m) => !(m.deletedBy ?? []).includes(user.id));
  }, [roomMessages, user]);

  const displayMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!searchActive || !q) return visibleMessages;
    return visibleMessages.filter(
      (m) =>
        !m.deletedForEveryone &&
        ((m.text && m.text.toLowerCase().includes(q)) ||
          m.username.toLowerCase().includes(q))
    );
  }, [visibleMessages, searchActive, searchQuery]);

  const matchCount = searchActive && searchQuery.trim() ? displayMessages.length : 0;

  const seenByMap = useMemo(() => {
    if (!user || !id) return {} as Record<string, { username: string; avatarColor: string }[]>;
    const receipts = readReceipts[id] ?? {};
    const result: Record<string, { username: string; avatarColor: string }[]> = {};
    for (const [uid, receipt] of Object.entries(receipts)) {
      if (uid === user.id) continue;
      const seenIdx = visibleMessages.findIndex((m) => m.id === receipt.lastMessageId);
      if (seenIdx === -1) continue;
      let pinMessageId: string | null = null;
      for (let i = seenIdx; i >= 0; i--) {
        if (visibleMessages[i]?.userId === user.id) { pinMessageId = visibleMessages[i]!.id; break; }
      }
      if (pinMessageId) {
        result[pinMessageId] = result[pinMessageId] ?? [];
        result[pinMessageId]!.push({ username: receipt.username, avatarColor: receipt.avatarColor });
      }
    }
    return result;
  }, [readReceipts, visibleMessages, id, user]);

  useEffect(() => {
    if (id && user) { joinRoom(id); clearUnread(id); }
    return () => { if (id) { stopTyping(id); leaveRoom(id); } };
  }, [id, user]);

  useEffect(() => {
    if (!id || visibleMessages.length === 0) return;
    const last = visibleMessages[visibleMessages.length - 1];
    if (last) markRead(id, last.id);
  }, [id, visibleMessages.length]);

  const handleSend = useCallback(
    (text: string) => { if (id) sendMessage({ roomId: id, text }); },
    [id, sendMessage]
  );

  const handleSendMedia = useCallback(
    (uri: string, type: "image" | "video" | "audio") => {
      if (id) sendMessage({ roomId: id, mediaUrl: uri, mediaType: type });
    },
    [id, sendMessage]
  );

  const handleTypingStart = useCallback(() => { if (id) startTyping(id); }, [id, startTyping]);
  const handleTypingStop  = useCallback(() => { if (id) stopTyping(id); },  [id, stopTyping]);

  const handleLongPress = useCallback((messageId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const msg = roomMessages.find((m) => m.id === messageId);
    if (msg) setSelectedMessage(msg);
  }, [roomMessages]);

  const handleSwipeReply = useCallback((message: Message) => {
    setReplyTo({
      id: message.id,
      username: message.username,
      text: message.text,
      mediaType: message.mediaType,
    });
  }, []);

  const handleSheetReply = useCallback(() => {
    if (!selectedMessage) return;
    setReplyTo({
      id: selectedMessage.id,
      username: selectedMessage.username,
      text: selectedMessage.text,
      mediaType: selectedMessage.mediaType,
    });
    setSelectedMessage(null);
  }, [selectedMessage]);

  const handleSheetReaction = useCallback(
    (emoji: string) => {
      if (!selectedMessage || !id) return;
      addReaction(selectedMessage.id, id, emoji);
      setSelectedMessage(null);
    },
    [selectedMessage, id, addReaction]
  );

  const handleDeleteForEveryone = useCallback(() => {
    if (!selectedMessage || !id) return;
    Alert.alert(
      "Delete for everyone?",
      "This message will be permanently removed for all participants.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteMessage(selectedMessage.id, id, "everyone");
            setSelectedMessage(null);
          },
        },
      ]
    );
  }, [selectedMessage, id, deleteMessage]);

  const handleDeleteForMe = useCallback(() => {
    if (!selectedMessage || !id) return;
    deleteMessage(selectedMessage.id, id, "me");
    setSelectedMessage(null);
  }, [selectedMessage, id, deleteMessage]);

  const handleBubbleReaction = useCallback(
    (messageId: string, emoji: string) => { if (id) addReaction(messageId, id, emoji); },
    [id, addReaction]
  );

  const handleAvatarPress = useCallback((userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProfileUserId(userId);
  }, []);

  const handleProfileRoomPress = useCallback(
    (roomId: string, roomName: string) => {
      router.replace({ pathname: "/room/[id]", params: { id: roomId, name: roomName } });
    },
    [router]
  );

  const handleCameraPress = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant camera access to take photos.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        base64: true,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        handleSendMedia(uri, "image");
      }
    } catch {
      Alert.alert("Error", "Could not open the camera.");
    }
  }, [handleSendMedia]);

  const handleCallPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Coming Soon",
      "Voice and video calls are on the way in a future update!",
      [{ text: "OK", style: "default" }]
    );
  }, []);

  const openSearch = useCallback(() => {
    setSearchActive(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchActive(false);
    setSearchQuery("");
  }, []);

  const memberCount = memberCounts[id ?? ""] ?? 0;
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 10);

  const isSelectedOwn = selectedMessage?.userId === user?.id;

  const renderItem = ({ item }: { item: Message }) => (
    <ChatBubble
      message={item}
      isOwn={item.userId === user?.id}
      seenBy={seenByMap[item.id]}
      searchQuery={searchActive ? searchQuery : ""}
      onLongPress={handleLongPress}
      onReactionPress={(emoji) => handleBubbleReaction(item.id, emoji)}
      onAvatarPress={handleAvatarPress}
      onSwipeReply={handleSwipeReply}
    />
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: topPad }]}>
          <TouchableOpacity
            onPress={searchActive ? closeSearch : () => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="arrow-left" size={22} color="#e9edef" />
          </TouchableOpacity>

          {searchActive ? (
            <View style={styles.searchBarWrap}>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search messages…"
                placeholderTextColor="#8696a0"
                returnKeyType="search"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearBtn}>
                  <Feather name="x-circle" size={17} color="#8696a0" />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.headerInfo}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: "/group-info/[id]",
                  params: { id: id ?? "", name: name ?? "" },
                })
              }
            >
              <Text style={styles.headerTitle} numberOfLines={1}>{name ?? id}</Text>
              <Text style={styles.headerSub}>
                {currentTypers.length > 0
                  ? currentTypers.length === 1
                    ? `${currentTypers[0]!.username} is typing…`
                    : "Several people are typing…"
                  : !isConnected
                  ? "offline"
                  : memberCount > 0
                  ? `${memberCount} ${memberCount === 1 ? "member" : "members"} online`
                  : "connecting…"}
              </Text>
            </TouchableOpacity>
          )}

          {!searchActive && (
            <TouchableOpacity style={styles.headerBtn} onPress={openSearch}>
              <Feather name="search" size={20} color="#8696a0" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerBtn} onPress={handleCameraPress}>
            <Feather name="camera" size={20} color="#8696a0" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleCallPress}>
            <Feather name="phone" size={20} color="#8696a0" />
          </TouchableOpacity>
        </View>

        {searchActive && searchQuery.trim().length > 0 && (
          <View style={styles.searchResultsBanner}>
            <Feather
              name={matchCount === 0 ? "alert-circle" : "check-circle"}
              size={13}
              color={matchCount === 0 ? "#8696a0" : "#00a884"}
            />
            <Text style={[styles.searchResultsText, { color: matchCount === 0 ? "#8696a0" : "#00a884" }]}>
              {matchCount === 0
                ? "No messages found"
                : `${matchCount} ${matchCount === 1 ? "result" : "results"}`}
            </Text>
          </View>
        )}

        <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={0}>
          {displayMessages.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather
                  name={searchActive && searchQuery.trim() ? "search" : "message-circle"}
                  size={36}
                  color="#00a884"
                />
              </View>
              <Text style={styles.emptyText}>
                {searchActive && searchQuery.trim() ? "No results" : "No messages yet"}
              </Text>
              <Text style={styles.emptySub}>
                {searchActive && searchQuery.trim()
                  ? `Nothing matched "${searchQuery}"`
                  : "Be the first to say something!"}
              </Text>
            </View>
          ) : (
            <FlatList
              data={[...displayMessages].reverse()}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              inverted
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                !searchActive && currentTypers.length > 0
                  ? <TypingIndicator typers={currentTypers} />
                  : null
              }
            />
          )}

          {!searchActive && (
            <ChatInput
              onSend={handleSend}
              onSendMedia={handleSendMedia}
              onTypingStart={handleTypingStart}
              onTypingStop={handleTypingStop}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
            />
          )}
        </KeyboardAvoidingView>

        <MessageActionSheet
          visible={selectedMessage !== null}
          message={selectedMessage}
          isOwn={isSelectedOwn ?? false}
          onDeleteForEveryone={handleDeleteForEveryone}
          onDeleteForMe={handleDeleteForMe}
          onReaction={handleSheetReaction}
          onReply={handleSheetReply}
          onClose={() => setSelectedMessage(null)}
        />

        <ProfileModal
          userId={profileUserId}
          onClose={() => setProfileUserId(null)}
          onRoomPress={handleProfileRoomPress}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b141a" },
  flex: { flex: 1 },
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
  headerSub: { color: "#8696a0", fontSize: 12, marginTop: 1 },
  headerBtn: { padding: 8 },
  searchBarWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0b141a",
    borderRadius: 20,
    paddingHorizontal: 12,
    marginHorizontal: 6,
    height: 38,
  },
  searchInput: {
    flex: 1,
    color: "#e9edef",
    fontSize: 15,
    paddingVertical: 0,
  },
  clearBtn: { padding: 3 },
  searchResultsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#111b21",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2a3942",
  },
  searchResultsText: { fontSize: 13, fontWeight: "600" },
  listContent: { paddingTop: 12, paddingBottom: 8 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1f2c34",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { color: "#e9edef", fontSize: 17, fontWeight: "600" },
  emptySub: { color: "#8696a0", fontSize: 13, textAlign: "center", paddingHorizontal: 32 },
});
