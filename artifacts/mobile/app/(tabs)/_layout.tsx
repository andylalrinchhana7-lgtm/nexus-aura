import { BlurView } from "expo-blur";
import { Tabs, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useState, useRef } from "react";
import {
  Platform,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  useColorScheme,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useSocket } from "@/contexts/SocketContext";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

function ChatTabIcon({ color }: { color: string }) {
  const { unreadCounts } = useSocket();
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
  return (
    <View>
      <Feather name="message-circle" size={22} color={color} />
      {totalUnread > 0 && (
        <View style={iconStyles.badge}>
          <Text style={iconStyles.badgeText}>{totalUnread > 99 ? "99+" : totalUnread}</Text>
        </View>
      )}
    </View>
  );
}

const iconStyles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -7,
    backgroundColor: "#00a884",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
});

// ─────────────────────────────────────────────────────────────────────────────
// New Group Modal
// ─────────────────────────────────────────────────────────────────────────────

interface NewGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (id: string, name: string) => void;
}

function NewGroupModal({ visible, onClose, onCreated }: NewGroupModalProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const descRef = useRef<TextInput>(null);

  const reset = () => {
    setName("");
    setDescription("");
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a group name.");
      return;
    }
    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BASE_URL}/api/chat/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, description: description.trim(), userId }),
      });

      const data = (await res.json()) as { id?: string; name?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Failed to create group.");
        setLoading(false);
        return;
      }

      reset();
      onCreated(data.id!, data.name!);
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={modalStyles.backdrop} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={modalStyles.sheetWrapper}
        pointerEvents="box-none"
      >
        <View style={[modalStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {/* Handle */}
          <View style={modalStyles.handle} />

          {/* Header */}
          <View style={modalStyles.sheetHeader}>
            <TouchableOpacity onPress={handleClose} hitSlop={10} style={modalStyles.cancelBtn}>
              <Text style={modalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={modalStyles.sheetTitle}>New Group</Text>
            <TouchableOpacity
              onPress={handleCreate}
              hitSlop={10}
              style={[modalStyles.createBtn, loading && { opacity: 0.5 }]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#00a884" />
              ) : (
                <Text style={modalStyles.createText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Icon preview */}
          <View style={modalStyles.iconPreviewRow}>
            <View style={modalStyles.iconPreview}>
              <Feather name="users" size={32} color="#00a884" />
            </View>
            <Text style={modalStyles.iconPreviewLabel}>
              {name.trim() || "Group Name"}
            </Text>
          </View>

          {/* Fields */}
          <View style={modalStyles.fields}>
            <View style={modalStyles.fieldRow}>
              <Feather name="users" size={18} color="#8696a0" style={modalStyles.fieldIcon} />
              <TextInput
                style={modalStyles.fieldInput}
                placeholder="Group name (required)"
                placeholderTextColor="#8696a0"
                value={name}
                onChangeText={(t) => { setName(t); setError(null); }}
                maxLength={50}
                returnKeyType="next"
                onSubmitEditing={() => descRef.current?.focus()}
                autoFocus
              />
            </View>
            <View style={modalStyles.fieldDivider} />
            <View style={modalStyles.fieldRow}>
              <Feather name="info" size={18} color="#8696a0" style={modalStyles.fieldIcon} />
              <TextInput
                ref={descRef}
                style={modalStyles.fieldInput}
                placeholder="Description (optional)"
                placeholderTextColor="#8696a0"
                value={description}
                onChangeText={setDescription}
                maxLength={200}
                returnKeyType="done"
                onSubmitEditing={handleCreate}
              />
            </View>
          </View>

          {/* Character count */}
          <Text style={modalStyles.charCount}>{name.length}/50</Text>

          {/* Error */}
          {error ? (
            <View style={modalStyles.errorRow}>
              <Feather name="alert-circle" size={14} color="#ef4444" />
              <Text style={modalStyles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Hint */}
          <Text style={modalStyles.hint}>
            Anyone in the app will be able to join this group.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheetWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1f2c34",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2a3942",
    alignSelf: "center",
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  sheetTitle: {
    color: "#e9edef",
    fontSize: 17,
    fontWeight: "700",
  },
  cancelBtn: { padding: 4, minWidth: 60 },
  cancelText: { color: "#8696a0", fontSize: 15 },
  createBtn: { padding: 4, minWidth: 60, alignItems: "flex-end" },
  createText: { color: "#00a884", fontSize: 15, fontWeight: "700" },

  iconPreviewRow: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 10,
  },
  iconPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0,168,132,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(0,168,132,0.3)",
  },
  iconPreviewLabel: {
    color: "#e9edef",
    fontSize: 16,
    fontWeight: "600",
    opacity: 0.8,
  },

  fields: {
    backgroundColor: "#0b141a",
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 4,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  fieldIcon: { marginRight: 10 },
  fieldInput: {
    flex: 1,
    color: "#e9edef",
    fontSize: 16,
    paddingVertical: 14,
  },
  fieldDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#2a3942",
    marginLeft: 46,
  },

  charCount: {
    color: "#2a3942",
    fontSize: 12,
    textAlign: "right",
    marginTop: 6,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: { color: "#ef4444", fontSize: 13, flex: 1 },

  hint: {
    color: "#8696a0",
    fontSize: 13,
    textAlign: "center",
    marginTop: 14,
    lineHeight: 18,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Three-dot menu
// ─────────────────────────────────────────────────────────────────────────────

interface MenuItem {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}

function ThreeDotMenu() {
  const [open, setOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const comingSoon = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpen(false);
    setTimeout(() => {
      Alert.alert("Coming Soon", `${name} is on the way!`, [{ text: "OK" }]);
    }, 150);
  };

  const handleNewGroup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOpen(false);
    setTimeout(() => setNewGroupOpen(true), 200);
  };

  const handleGroupCreated = (id: string, name: string) => {
    setNewGroupOpen(false);
    setTimeout(() => {
      router.push({ pathname: "/room/[id]", params: { id, name } });
    }, 100);
  };

  const items: MenuItem[] = [
    {
      icon: "users",
      label: "New Group",
      onPress: handleNewGroup,
    },
    {
      icon: "globe",
      label: "Communities",
      onPress: () => {
        setOpen(false);
        setTimeout(() => router.push("/(tabs)/communities"), 150);
      },
    },
    {
      icon: "list",
      label: "Lists",
      onPress: () => comingSoon("Lists"),
    },
    {
      icon: "smartphone",
      label: "Linked Devices",
      onPress: () => comingSoon("Linked Devices"),
    },
    {
      icon: "star",
      label: "Starred",
      onPress: () => comingSoon("Starred Messages"),
    },
    {
      icon: "settings",
      label: "Settings",
      onPress: () => {
        setOpen(false);
        setTimeout(() => router.push("/(tabs)/settings"), 150);
      },
    },
  ];

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setOpen(true);
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ marginRight: 8 }}
      >
        <Feather name="more-vertical" size={22} color="#8696a0" />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={menuStyles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={[menuStyles.menu, { top: insets.top + (Platform.OS === "web" ? 67 : 0) + 52 }]}>
          {items.map((item, i) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity
                style={menuStyles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <Feather name={item.icon} size={17} color="#8696a0" />
                <Text style={menuStyles.menuLabel}>{item.label}</Text>
              </TouchableOpacity>
              {i < items.length - 1 && <View style={menuStyles.menuDivider} />}
            </React.Fragment>
          ))}
        </View>
      </Modal>

      <NewGroupModal
        visible={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        onCreated={handleGroupCreated}
      />
    </>
  );
}

const menuStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  menu: {
    position: "absolute",
    right: 12,
    backgroundColor: "#1f2c34",
    borderRadius: 12,
    minWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 16,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  menuLabel: {
    color: "#e9edef",
    fontSize: 15,
    fontWeight: "500",
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#2a3942",
    marginLeft: 48,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Tab layout
// ─────────────────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        headerStyle: {
          backgroundColor: "#1f2c34",
        },
        headerTintColor: "#e9edef",
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 18,
        },
        headerShadowVisible: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Chats",
          headerRight: () => <ThreeDotMenu />,
          tabBarIcon: ({ color }) => <ChatTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="updates"
        options={{
          title: "Updates",
          tabBarIcon: ({ color }) => (
            <Feather name="circle" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="communities"
        options={{
          title: "Communities",
          tabBarIcon: ({ color }) => (
            <Feather name="users" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: "Calls",
          tabBarIcon: ({ color }) => (
            <Feather name="phone" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <Feather name="settings" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
