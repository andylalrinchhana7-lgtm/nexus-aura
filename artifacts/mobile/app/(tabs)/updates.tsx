import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Animated,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { StoryViewer, type StoryData } from "@/components/StoryViewer";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const { width: SCREEN_W } = Dimensions.get("window");
const IMAGE_H = Math.round(SCREEN_W * 0.58);
const WEB_PAD = Platform.OS === "web" ? 67 : 0;
const TAB_H = Platform.OS === "ios" ? 88 : 62;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Post {
  id: string;
  userId: string;
  username: string;
  avatarColor: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: string;
  createdAt: string;
  likes: number;
  comments: number;
  likedByMe: boolean;
}

interface Comment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  avatarColor: string;
  text: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Static stories data (kept as curated sample content)
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_STORIES: StoryData[] = [
  {
    id: "s1",
    username: "Alex Chen",
    avatarColor: "#45B7D1",
    timestamp: "2 min ago",
    slides: [
      { imageUrl: "https://images.unsplash.com/photo-1555099962-4199c345e5dd?w=800&q=80", caption: "Shipping code at 2am 🚀" },
      { imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80", caption: "The setup though 💻" },
    ],
  },
  {
    id: "s2",
    username: "Sarah K",
    avatarColor: "#BB8FCE",
    timestamp: "18 min ago",
    slides: [
      { imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80", caption: "Weekend vibes 🎵" },
      { imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80", caption: "Live music never gets old 🎶" },
    ],
  },
  {
    id: "s3", username: "Jordan Lee", avatarColor: "#F7DC6F", timestamp: "45 min ago",
    slides: [{ imageUrl: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&q=80", caption: "New RPG drop 🎮" }],
  },
  {
    id: "s4", username: "Morgan Smith", avatarColor: "#98D8C8", timestamp: "1 hr ago",
    slides: [{ imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80", caption: "Meal prep Sunday 🍱" }],
  },
  {
    id: "s5", username: "Chris Park", avatarColor: "#F39C12", timestamp: "2 hr ago",
    slides: [{ imageUrl: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80", caption: "Golden hour ☀️" }],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stories row
// ─────────────────────────────────────────────────────────────────────────────

function StoriesRow({
  currentUser,
  onStoryPress,
  seenIds,
  onAddStory,
}: {
  currentUser: { username: string; avatarColor: string } | null;
  onStoryPress: (index: number) => void;
  seenIds: Set<string>;
  onAddStory: () => void;
}) {
  const initials = currentUser?.username?.charAt(0).toUpperCase() ?? "?";
  const avatarColor = currentUser?.avatarColor ?? "#00a884";

  return (
    <View style={storyStyles.wrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={storyStyles.row}>
        <TouchableOpacity style={storyStyles.item} onPress={onAddStory} activeOpacity={0.8}>
          <View style={storyStyles.ringPlaceholder}>
            <View style={[storyStyles.avatarCircle, { backgroundColor: avatarColor }]}>
              <Text style={storyStyles.avatarText}>{initials}</Text>
              <View style={storyStyles.addBadge}><Feather name="plus" size={11} color="#fff" /></View>
            </View>
          </View>
          <Text style={storyStyles.label} numberOfLines={1}>Your Story</Text>
        </TouchableOpacity>
        {SAMPLE_STORIES.map((story, idx) => {
          const seen = seenIds.has(story.id);
          return (
            <TouchableOpacity key={story.id} style={storyStyles.item} onPress={() => onStoryPress(idx)} activeOpacity={0.8}>
              <View style={[storyStyles.ring, seen ? storyStyles.ringSeen : storyStyles.ringUnseen]}>
                <View style={[storyStyles.avatarCircle, { backgroundColor: story.avatarColor }]}>
                  <Text style={storyStyles.avatarText}>{story.username.charAt(0).toUpperCase()}</Text>
                </View>
              </View>
              <Text style={[storyStyles.label, seen && storyStyles.labelSeen]} numberOfLines={1}>
                {story.username.split(" ")[0]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const storyStyles = StyleSheet.create({
  wrapper: { backgroundColor: "#1f2c34", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#2a3942" },
  row: { paddingHorizontal: 12, gap: 16, alignItems: "flex-start" },
  item: { alignItems: "center", width: 66 },
  ringPlaceholder: { width: 66, height: 66, borderRadius: 33, padding: 2, alignItems: "center", justifyContent: "center" },
  ring: { width: 66, height: 66, borderRadius: 33, padding: 3, alignItems: "center", justifyContent: "center" },
  ringUnseen: { borderWidth: 2.5, borderColor: "#00a884" },
  ringSeen: { borderWidth: 2.5, borderColor: "#2a3942" },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", position: "relative" },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  addBadge: { position: "absolute", bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: "#00a884", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#1f2c34" },
  label: { color: "#e9edef", fontSize: 11.5, fontWeight: "600", marginTop: 6, textAlign: "center", width: 66 },
  labelSeen: { color: "#8696a0" },
});

// ─────────────────────────────────────────────────────────────────────────────
// Comment Sheet Modal
// ─────────────────────────────────────────────────────────────────────────────

function CommentSheet({
  postId,
  visible,
  currentUser,
  onClose,
}: {
  postId: string | null;
  visible: boolean;
  currentUser: { id: string; username: string; avatarColor: string } | null;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible && postId) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
      loadComments(postId);
    } else {
      Animated.timing(slideAnim, { toValue: 600, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible, postId]);

  const loadComments = async (id: string) => {
    setLoadingComments(true);
    try {
      const res = await fetch(`${BASE_URL}/api/posts/${id}/comments`);
      if (res.ok) setComments((await res.json()) as Comment[]);
    } catch { /* ignore */ }
    finally { setLoadingComments(false); }
  };

  const handlePost = async () => {
    if (!commentText.trim() || !postId || !currentUser) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPosting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          username: currentUser.username,
          avatarColor: currentUser.avatarColor,
          text: commentText.trim(),
        }),
      });
      if (res.ok) {
        const comment = (await res.json()) as Comment;
        setComments((prev) => [...prev, comment]);
        setCommentText("");
      }
    } catch { /* ignore */ }
    finally { setPosting(false); }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={commentStyles.backdrop} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView
        style={commentStyles.kvWrap}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Animated.View style={[commentStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Handle */}
          <View style={commentStyles.handle} />
          <View style={commentStyles.sheetHeader}>
            <Text style={commentStyles.sheetTitle}>Comments</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Feather name="x" size={20} color="#8696a0" />
            </TouchableOpacity>
          </View>

          {loadingComments ? (
            <View style={commentStyles.center}>
              <ActivityIndicator color="#00a884" />
            </View>
          ) : comments.length === 0 ? (
            <View style={commentStyles.center}>
              <Feather name="message-circle" size={32} color="#2a3942" />
              <Text style={commentStyles.emptyText}>No comments yet. Be the first!</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(c) => c.id}
              style={commentStyles.list}
              contentContainerStyle={{ paddingVertical: 8 }}
              renderItem={({ item }) => (
                <View style={commentStyles.commentRow}>
                  <View style={[commentStyles.avatar, { backgroundColor: item.avatarColor }]}>
                    <Text style={commentStyles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={commentStyles.commentBubble}>
                    <Text style={commentStyles.commentUsername}>{item.username}</Text>
                    <Text style={commentStyles.commentText}>{item.text}</Text>
                    <Text style={commentStyles.commentTime}>{formatRelativeTime(item.createdAt)}</Text>
                  </View>
                </View>
              )}
            />
          )}

          {/* Input */}
          <View style={commentStyles.inputRow}>
            {currentUser && (
              <View style={[commentStyles.inputAvatar, { backgroundColor: currentUser.avatarColor }]}>
                <Text style={commentStyles.avatarText}>{currentUser.username.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <TextInput
              style={commentStyles.input}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Write a comment…"
              placeholderTextColor="#8696a0"
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handlePost}
            />
            <TouchableOpacity
              onPress={handlePost}
              disabled={!commentText.trim() || posting}
              style={[commentStyles.sendBtn, (!commentText.trim() || posting) && commentStyles.sendBtnDisabled]}
            >
              {posting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="send" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const commentStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  kvWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: "#1f2c34", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%", minHeight: 300 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#2a3942", alignSelf: "center", marginTop: 10 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#2a3942" },
  sheetTitle: { color: "#e9edef", fontSize: 16, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  emptyText: { color: "#8696a0", fontSize: 14 },
  list: { flex: 1 },
  commentRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 8, gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  inputAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  commentBubble: { flex: 1, backgroundColor: "#0b141a", borderRadius: 12, padding: 10 },
  commentUsername: { color: "#00a884", fontSize: 13, fontWeight: "700", marginBottom: 2 },
  commentText: { color: "#e9edef", fontSize: 14, lineHeight: 20 },
  commentTime: { color: "#8696a0", fontSize: 11, marginTop: 4 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#2a3942", paddingBottom: Platform.OS === "ios" ? 28 : 12 },
  input: { flex: 1, backgroundColor: "#0b141a", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: "#e9edef", fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#00a884", alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { opacity: 0.4 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Create Post Modal
// ─────────────────────────────────────────────────────────────────────────────

function CreatePostModal({
  visible,
  currentUser,
  onClose,
  onCreated,
}: {
  visible: boolean;
  currentUser: { id: string; username: string; avatarColor: string } | null;
  onClose: () => void;
  onCreated: (post: Post) => void;
}) {
  const [text, setText] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const reset = () => { setText(""); setImageUri(null); };

  const handleClose = () => { reset(); onClose(); };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant photo library access.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.75,
      base64: true,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      setImageUri(uri);
    }
  };

  const handlePost = async () => {
    if (!currentUser || (!text.trim() && !imageUri)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPosting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          username: currentUser.username,
          avatarColor: currentUser.avatarColor,
          text: text.trim() || undefined,
          mediaUrl: imageUri || undefined,
          mediaType: imageUri ? "image" : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const post = (await res.json()) as Post;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCreated(post);
      reset();
      onClose();
    } catch {
      Alert.alert("Error", "Could not create post. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const canPost = !posting && (!!text.trim() || !!imageUri);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={createStyles.root}>
        {/* Header */}
        <View style={createStyles.header}>
          <TouchableOpacity onPress={handleClose} style={createStyles.headerBtn}>
            <Text style={createStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={createStyles.headerTitle}>New Post</Text>
          <TouchableOpacity
            onPress={handlePost}
            disabled={!canPost}
            style={[createStyles.postBtn, !canPost && createStyles.postBtnDisabled]}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={createStyles.postBtnText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={createStyles.body} keyboardShouldPersistTaps="handled">
          {/* Author row */}
          {currentUser && (
            <View style={createStyles.authorRow}>
              <View style={[createStyles.avatar, { backgroundColor: currentUser.avatarColor }]}>
                <Text style={createStyles.avatarText}>{currentUser.username.charAt(0).toUpperCase()}</Text>
              </View>
              <View>
                <Text style={createStyles.authorName}>{currentUser.username}</Text>
                <View style={createStyles.audienceBadge}>
                  <Feather name="globe" size={11} color="#00a884" />
                  <Text style={createStyles.audienceText}>Everyone</Text>
                </View>
              </View>
            </View>
          )}

          {/* Text input */}
          <TextInput
            style={createStyles.textInput}
            value={text}
            onChangeText={setText}
            placeholder="What's on your mind?"
            placeholderTextColor="#8696a0"
            multiline
            maxLength={1000}
            autoFocus
          />

          {/* Image preview */}
          {imageUri && (
            <View style={createStyles.imagePreviewWrap}>
              <Image source={{ uri: imageUri }} style={createStyles.imagePreview} resizeMode="cover" />
              <TouchableOpacity
                style={createStyles.removeImageBtn}
                onPress={() => setImageUri(null)}
                hitSlop={8}
              >
                <View style={createStyles.removeImageIcon}>
                  <Feather name="x" size={16} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Media toolbar */}
        <View style={createStyles.toolbar}>
          <Text style={createStyles.toolbarLabel}>Add to your post:</Text>
          <TouchableOpacity style={createStyles.toolbarBtn} onPress={pickImage}>
            <Feather name="image" size={22} color="#98D8C8" />
          </TouchableOpacity>
          <TouchableOpacity
            style={createStyles.toolbarBtn}
            onPress={() => Alert.alert("Coming Soon", "Camera posts coming soon!")}
          >
            <Feather name="camera" size={22} color="#45B7D1" />
          </TouchableOpacity>
          <TouchableOpacity
            style={createStyles.toolbarBtn}
            onPress={() => Alert.alert("Coming Soon", "Feeling/Activity coming soon!")}
          >
            <Feather name="smile" size={22} color="#F7DC6F" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b141a" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: Platform.OS === "ios" ? 56 : 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#2a3942", backgroundColor: "#1f2c34" },
  headerBtn: { minWidth: 64 },
  headerTitle: { color: "#e9edef", fontSize: 16, fontWeight: "700" },
  cancelText: { color: "#8696a0", fontSize: 15 },
  postBtn: { backgroundColor: "#00a884", paddingHorizontal: 18, paddingVertical: 7, borderRadius: 20, minWidth: 64, alignItems: "center" },
  postBtnDisabled: { opacity: 0.4 },
  postBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  body: { flex: 1, padding: 16 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  authorName: { color: "#e9edef", fontSize: 15, fontWeight: "700" },
  audienceBadge: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  audienceText: { color: "#00a884", fontSize: 12, fontWeight: "600" },
  textInput: { color: "#e9edef", fontSize: 17, lineHeight: 25, minHeight: 100, textAlignVertical: "top" },
  imagePreviewWrap: { marginTop: 12, borderRadius: 14, overflow: "hidden", position: "relative" },
  imagePreview: { width: "100%", height: 220, borderRadius: 14 },
  removeImageBtn: { position: "absolute", top: 10, right: 10 },
  removeImageIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  toolbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#2a3942", backgroundColor: "#1f2c34", paddingBottom: Platform.OS === "ios" ? 32 : 12, gap: 4 },
  toolbarLabel: { color: "#8696a0", fontSize: 13, fontWeight: "600", flex: 1 },
  toolbarBtn: { padding: 8 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Post Card
// ─────────────────────────────────────────────────────────────────────────────

function PostCard({
  post,
  currentUserId,
  onLike,
  onComment,
  onDelete,
}: {
  post: Post;
  currentUserId?: string;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onDelete: (postId: string) => void;
}) {
  const isOwn = post.userId === currentUserId;

  const handleMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const options: { text: string; style?: "default" | "destructive" | "cancel"; onPress?: () => void }[] = [];
    if (isOwn) {
      options.push({ text: "Delete Post", style: "destructive", onPress: () => onDelete(post.id) });
    }
    options.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Post Options", undefined, options);
  };

  return (
    <View style={postStyles.card}>
      {/* Header */}
      <View style={postStyles.cardHeader}>
        <View style={[postStyles.avatar, { backgroundColor: post.avatarColor }]}>
          <Text style={postStyles.avatarText}>{post.username.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={postStyles.headerMeta}>
          <Text style={postStyles.authorName}>{post.username}</Text>
          <Text style={postStyles.timestamp}>{formatRelativeTime(post.createdAt)}</Text>
        </View>
        <TouchableOpacity onPress={handleMenu} hitSlop={12} style={postStyles.menuBtn}>
          <Feather name="more-horizontal" size={20} color="#8696a0" />
        </TouchableOpacity>
      </View>

      {/* Text */}
      {post.text ? <Text style={postStyles.postText}>{post.text}</Text> : null}

      {/* Media */}
      {post.mediaUrl ? (
        <View style={postStyles.mediaWrap}>
          <Image source={{ uri: post.mediaUrl }} style={postStyles.mediaImage} resizeMode="cover" />
          {post.mediaType === "video" && (
            <View style={postStyles.playOverlay}>
              <View style={postStyles.playBtn}><Feather name="play" size={28} color="#fff" /></View>
            </View>
          )}
        </View>
      ) : null}

      {/* Stats */}
      <View style={postStyles.statsBar}>
        <View style={postStyles.statItem}>
          <Feather name="heart" size={13} color={post.likedByMe ? "#ef4444" : "#8696a0"} />
          <Text style={[postStyles.statText, post.likedByMe && postStyles.statTextLiked]}>
            {post.likes} {post.likes === 1 ? "like" : "likes"}
          </Text>
        </View>
        <TouchableOpacity onPress={() => onComment(post.id)} style={postStyles.statItem} hitSlop={8}>
          <Feather name="message-circle" size={13} color="#8696a0" />
          <Text style={postStyles.statText}>{post.comments} {post.comments === 1 ? "comment" : "comments"}</Text>
        </TouchableOpacity>
      </View>

      <View style={postStyles.divider} />

      {/* Actions */}
      <View style={postStyles.actionBar}>
        <TouchableOpacity
          style={postStyles.actionBtn}
          onPress={() => onLike(post.id)}
          activeOpacity={0.7}
        >
          <Feather name="heart" size={18} color={post.likedByMe ? "#ef4444" : "#8696a0"} />
          <Text style={[postStyles.actionLabel, post.likedByMe && postStyles.actionLabelLiked]}>Like</Text>
        </TouchableOpacity>
        <TouchableOpacity style={postStyles.actionBtn} onPress={() => onComment(post.id)} activeOpacity={0.7}>
          <Feather name="message-circle" size={18} color="#8696a0" />
          <Text style={postStyles.actionLabel}>Comment</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={postStyles.actionBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Alert.alert("Share", "Sharing is coming soon!"); }}
          activeOpacity={0.7}
        >
          <Feather name="share-2" size={18} color="#8696a0" />
          <Text style={postStyles.actionLabel}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const postStyles = StyleSheet.create({
  card: { backgroundColor: "#1f2c34" },
  cardHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  headerMeta: { flex: 1 },
  authorName: { color: "#e9edef", fontSize: 15, fontWeight: "700" },
  timestamp: { color: "#8696a0", fontSize: 12, marginTop: 1 },
  menuBtn: { padding: 4 },
  postText: { color: "#e9edef", fontSize: 15, lineHeight: 22, paddingHorizontal: 14, paddingBottom: 12 },
  mediaWrap: { width: SCREEN_W, height: IMAGE_H, position: "relative" },
  mediaImage: { width: "100%", height: "100%" },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.25)" },
  playBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", paddingLeft: 4 },
  statsBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 8 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { color: "#8696a0", fontSize: 12 },
  statTextLiked: { color: "#ef4444" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#2a3942", marginHorizontal: 14 },
  actionBar: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  actionLabel: { color: "#8696a0", fontSize: 13, fontWeight: "600" },
  actionLabelLiked: { color: "#ef4444" },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main UpdatesScreen
// ─────────────────────────────────────────────────────────────────────────────

export default function UpdatesScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  const [createVisible, setCreateVisible] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);

  // ── Fetch posts ──
  const fetchPosts = useCallback(async () => {
    try {
      const url = user?.id
        ? `${BASE_URL}/api/posts?userId=${encodeURIComponent(user.id)}`
        : `${BASE_URL}/api/posts`;
      const res = await fetch(url);
      if (res.ok) setPosts((await res.json()) as Post[]);
    } catch { /* silently fail */ }
    finally { setLoadingPosts(false); setRefreshing(false); }
  }, [user?.id]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  useFocusEffect(useCallback(() => { fetchPosts(); }, [fetchPosts]));

  const handleRefresh = () => { setRefreshing(true); fetchPosts(); };

  // ── Like toggle ──
  const handleLike = useCallback(async (postId: string) => {
    if (!user?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, likedByMe: !p.likedByMe, likes: p.likedByMe ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
    try {
      const res = await fetch(`${BASE_URL}/api/posts/${postId}/like`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        const { likedByMe, likes } = (await res.json()) as { likedByMe: boolean; likes: number };
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likedByMe, likes } : p)));
      }
    } catch {
      // Revert optimistic update on failure
      fetchPosts();
    }
  }, [user?.id, fetchPosts]);

  // ── Open comments ──
  const handleComment = useCallback((postId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCommentPostId(postId);
  }, []);

  // ── Increment comment count locally when comment posted ──
  const handleCommentPosted = useCallback((postId: string) => {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: p.comments + 1 } : p));
  }, []);

  // ── Delete post ──
  const handleDelete = useCallback(async (postId: string) => {
    if (!user?.id) return;
    Alert.alert("Delete Post", "This will permanently remove the post.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            const res = await fetch(`${BASE_URL}/api/posts/${postId}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: user.id }),
            });
            if (res.ok) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setPosts((prev) => prev.filter((p) => p.id !== postId));
            }
          } catch { /* ignore */ }
        },
      },
    ]);
  }, [user?.id]);

  // ── Post created ──
  const handlePostCreated = useCallback((post: Post) => {
    setPosts((prev) => [post, ...prev]);
  }, []);

  // ── Stories ──
  const openStory = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewerIndex(idx);
    setViewerVisible(true);
  };
  const closeViewer = () => {
    setSeenIds((prev) => new Set([...prev, SAMPLE_STORIES[viewerIndex]!.id]));
    setViewerVisible(false);
  };

  const initials = user?.username?.charAt(0).toUpperCase() ?? "?";
  const avatarColor = user?.avatarColor ?? "#00a884";

  return (
    <>
      <ScrollView
        style={rootStyles.root}
        contentContainerStyle={[rootStyles.content, { paddingTop: WEB_PAD, paddingBottom: insets.bottom + TAB_H + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#00a884" />}
      >
        {/* Stories */}
        <StoriesRow
          currentUser={user}
          onStoryPress={openStory}
          seenIds={seenIds}
          onAddStory={() => Alert.alert("Add Story", "Story creation is coming soon!")}
        />

        {/* Create Post bar */}
        <TouchableOpacity style={rootStyles.createCard} onPress={() => setCreateVisible(true)} activeOpacity={0.85}>
          <View style={[rootStyles.createAvatar, { backgroundColor: avatarColor }]}>
            <Text style={rootStyles.createAvatarText}>{initials}</Text>
          </View>
          <View style={rootStyles.createInputFake}>
            <Text style={rootStyles.createPlaceholder}>What's on your mind?</Text>
          </View>
        </TouchableOpacity>

        {/* Quick media shortcuts */}
        <View style={rootStyles.createActions}>
          <TouchableOpacity style={rootStyles.createAction} onPress={() => Alert.alert("Coming Soon", "Live video coming soon!")}>
            <Feather name="video" size={17} color="#BB8FCE" />
            <Text style={rootStyles.createActionLabel}>Live</Text>
          </TouchableOpacity>
          <View style={rootStyles.createActionDivider} />
          <TouchableOpacity style={rootStyles.createAction} onPress={() => setCreateVisible(true)}>
            <Feather name="image" size={17} color="#98D8C8" />
            <Text style={rootStyles.createActionLabel}>Photo</Text>
          </TouchableOpacity>
          <View style={rootStyles.createActionDivider} />
          <TouchableOpacity style={rootStyles.createAction} onPress={() => Alert.alert("Coming Soon", "Feelings coming soon!")}>
            <Feather name="smile" size={17} color="#F7DC6F" />
            <Text style={rootStyles.createActionLabel}>Feeling</Text>
          </TouchableOpacity>
        </View>

        <View style={rootStyles.feedSeparator} />

        {/* Feed */}
        {loadingPosts ? (
          <View style={rootStyles.center}>
            <ActivityIndicator size="large" color="#00a884" />
            <Text style={rootStyles.loadingText}>Loading posts…</Text>
          </View>
        ) : posts.length === 0 ? (
          <View style={rootStyles.center}>
            <View style={rootStyles.emptyIcon}>
              <Feather name="edit-3" size={36} color="#00a884" />
            </View>
            <Text style={rootStyles.emptyTitle}>No posts yet</Text>
            <Text style={rootStyles.emptySub}>Be the first to share something!</Text>
            <TouchableOpacity style={rootStyles.emptyBtn} onPress={() => setCreateVisible(true)}>
              <Text style={rootStyles.emptyBtnText}>Create Post</Text>
            </TouchableOpacity>
          </View>
        ) : (
          posts.map((post) => (
            <React.Fragment key={post.id}>
              <PostCard
                post={post}
                currentUserId={user?.id}
                onLike={handleLike}
                onComment={handleComment}
                onDelete={handleDelete}
              />
              <View style={rootStyles.feedSeparator} />
            </React.Fragment>
          ))
        )}
      </ScrollView>

      {/* Story Viewer */}
      <StoryViewer
        stories={SAMPLE_STORIES}
        initialIndex={viewerIndex}
        visible={viewerVisible}
        onClose={closeViewer}
      />

      {/* Create Post Modal */}
      <CreatePostModal
        visible={createVisible}
        currentUser={user}
        onClose={() => setCreateVisible(false)}
        onCreated={handlePostCreated}
      />

      {/* Comment Sheet */}
      <CommentSheet
        postId={commentPostId}
        visible={!!commentPostId}
        currentUser={user}
        onClose={() => setCommentPostId(null)}
      />
    </>
  );
}

const rootStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b141a" },
  content: { paddingHorizontal: 0 },
  createCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#1f2c34", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  createAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  createAvatarText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  createInputFake: { flex: 1, backgroundColor: "#2a3942", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10 },
  createPlaceholder: { color: "#8696a0", fontSize: 14 },
  createActions: { flexDirection: "row", alignItems: "center", backgroundColor: "#1f2c34", paddingVertical: 10, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#2a3942" },
  createAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 4 },
  createActionLabel: { color: "#8696a0", fontSize: 13, fontWeight: "600" },
  createActionDivider: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: "#2a3942" },
  feedSeparator: { height: 8, backgroundColor: "#0b141a" },
  center: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  loadingText: { color: "#8696a0", fontSize: 14 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#1f2c34", alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: "#e9edef", fontSize: 18, fontWeight: "700" },
  emptySub: { color: "#8696a0", fontSize: 14 },
  emptyBtn: { backgroundColor: "#00a884", paddingHorizontal: 24, paddingVertical: 11, borderRadius: 24, marginTop: 4 },
  emptyBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
