import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";

const WEB_PAD = Platform.OS === "web" ? 67 : 0;
const TAB_H = Platform.OS === "ios" ? 88 : 62;

interface SettingRow {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  sub: string;
  onPress?: () => void;
}

function SettingItem({ item }: { item: SettingRow }) {
  return (
    <TouchableOpacity
      style={styles.settingRow}
      activeOpacity={item.onPress ? 0.7 : 1}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        item.onPress?.();
      }}
    >
      <View style={[styles.settingIcon, { backgroundColor: item.iconBg }]}>
        <Feather name={item.icon} size={17} color={item.iconColor} />
      </View>
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{item.label}</Text>
        <Text style={styles.settingSub} numberOfLines={1}>{item.sub}</Text>
      </View>
      <Feather name="chevron-right" size={16} color="#2a3942" />
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [bio, setBio] = useState("Hey there! I am using Nexus Aura.");
  const [bioEditing, setBioEditing] = useState(false);
  const bioRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!user?.id) return;
    AsyncStorage.getItem(`nexus_bio_${user.id}`).then((val) => {
      if (val) setBio(val);
    });
  }, [user?.id]);

  const saveBio = useCallback(async (text: string) => {
    if (!user?.id) return;
    const trimmed = text.trim() || "Hey there! I am using Nexus Aura.";
    setBio(trimmed);
    setBioEditing(false);
    await AsyncStorage.setItem(`nexus_bio_${user.id}`, trimmed);
  }, [user?.id]);

  const handleLogout = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Log out",
      "Are you sure you want to log out of Nexus Aura?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Log out", style: "destructive", onPress: logout },
      ]
    );
  }, [logout]);

  const comingSoon = useCallback((name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Coming Soon", `${name} settings will be available in a future update.`, [{ text: "OK" }]);
  }, []);

  const accountRows: SettingRow[] = [
    {
      icon: "key",
      iconColor: "#00a884",
      iconBg: "rgba(0,168,132,0.15)",
      label: "Account",
      sub: "Privacy, security, change number",
      onPress: () => comingSoon("Account"),
    },
    {
      icon: "lock",
      iconColor: "#45B7D1",
      iconBg: "rgba(69,183,209,0.15)",
      label: "Privacy",
      sub: "Last seen, profile photo, status",
      onPress: () => comingSoon("Privacy"),
    },
    {
      icon: "smartphone",
      iconColor: "#BB8FCE",
      iconBg: "rgba(187,143,206,0.15)",
      label: "Linked Devices",
      sub: "Link a device for multi-device use",
      onPress: () => comingSoon("Linked Devices"),
    },
  ];

  const chatRows: SettingRow[] = [
    {
      icon: "message-circle",
      iconColor: "#00a884",
      iconBg: "rgba(0,168,132,0.15)",
      label: "Chats",
      sub: "Theme, wallpapers, chat history",
      onPress: () => comingSoon("Chats"),
    },
    {
      icon: "bell",
      iconColor: "#F7DC6F",
      iconBg: "rgba(247,220,111,0.15)",
      label: "Notifications",
      sub: "Message, group and call tones",
      onPress: () => comingSoon("Notifications"),
    },
    {
      icon: "database",
      iconColor: "#96CEB4",
      iconBg: "rgba(150,206,180,0.15)",
      label: "Storage and Data",
      sub: "Network usage, auto-download",
      onPress: () => comingSoon("Storage and Data"),
    },
  ];

  const helpRows: SettingRow[] = [
    {
      icon: "help-circle",
      iconColor: "#45B7D1",
      iconBg: "rgba(69,183,209,0.15)",
      label: "Help",
      sub: "Help center, contact us, privacy",
      onPress: () => comingSoon("Help"),
    },
    {
      icon: "share-2",
      iconColor: "#BB8FCE",
      iconBg: "rgba(187,143,206,0.15)",
      label: "Tell a Friend",
      sub: "Share Nexus Aura with friends",
      onPress: () => comingSoon("Tell a Friend"),
    },
  ];

  const initials = user?.username?.charAt(0).toUpperCase() ?? "?";
  const bottomPad = insets.bottom + TAB_H + 8;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad, paddingTop: WEB_PAD }]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        style={styles.profileCard}
        activeOpacity={0.8}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setBioEditing(true);
          setTimeout(() => bioRef.current?.focus(), 80);
        }}
      >
        <View style={[styles.avatar, { backgroundColor: user?.avatarColor ?? "#00a884" }]}>
          <Text style={styles.avatarText}>{initials}</Text>
          <View style={styles.avatarEditBtn}>
            <Feather name="camera" size={13} color="#fff" />
          </View>
        </View>

        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.username ?? "User"}</Text>

          {bioEditing ? (
            <TextInput
              ref={bioRef}
              style={styles.bioInput}
              value={bio}
              onChangeText={setBio}
              onBlur={() => saveBio(bio)}
              onSubmitEditing={() => saveBio(bio)}
              returnKeyType="done"
              maxLength={120}
              multiline={false}
              autoCorrect={false}
            />
          ) : (
            <Text style={styles.bioText} numberOfLines={1}>{bio}</Text>
          )}

          <Text style={styles.profileEmail}>{user?.email ?? ""}</Text>
        </View>

        <Feather name="chevron-right" size={18} color="#2a3942" />
      </TouchableOpacity>

      <Text style={styles.sectionHeader}>Account</Text>
      <View style={styles.section}>
        {accountRows.map((row, i) => (
          <React.Fragment key={row.label}>
            <SettingItem item={row} />
            {i < accountRows.length - 1 && <View style={styles.rowDivider} />}
          </React.Fragment>
        ))}
      </View>

      <Text style={styles.sectionHeader}>App Settings</Text>
      <View style={styles.section}>
        {chatRows.map((row, i) => (
          <React.Fragment key={row.label}>
            <SettingItem item={row} />
            {i < chatRows.length - 1 && <View style={styles.rowDivider} />}
          </React.Fragment>
        ))}
      </View>

      <Text style={styles.sectionHeader}>Support</Text>
      <View style={styles.section}>
        {helpRows.map((row, i) => (
          <React.Fragment key={row.label}>
            <SettingItem item={row} />
            {i < helpRows.length - 1 && <View style={styles.rowDivider} />}
          </React.Fragment>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Feather name="log-out" size={19} color="#ef4444" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Nexus Aura · Version 1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b141a" },
  content: { paddingHorizontal: 0 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2c34",
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 4,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "800" },
  avatarEditBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#00a884",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#1f2c34",
  },
  profileInfo: { flex: 1 },
  profileName: { color: "#e9edef", fontSize: 18, fontWeight: "700", marginBottom: 3 },
  bioText: { color: "#8696a0", fontSize: 14, marginBottom: 3 },
  bioInput: {
    color: "#00a884",
    fontSize: 14,
    marginBottom: 3,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#00a884",
  },
  profileEmail: { color: "#2a3942", fontSize: 12 },
  sectionHeader: {
    color: "#8696a0",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginLeft: 16,
    marginTop: 24,
    marginBottom: 6,
  },
  section: {
    backgroundColor: "#1f2c34",
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: "hidden",
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#2a3942",
    marginLeft: 58,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  settingText: { flex: 1 },
  settingLabel: { color: "#e9edef", fontSize: 15, fontWeight: "500" },
  settingSub: { color: "#8696a0", fontSize: 12, marginTop: 1 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#1f2c34",
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 15,
  },
  logoutText: { color: "#ef4444", fontSize: 16, fontWeight: "600" },
  version: {
    color: "#2a3942",
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
  },
});
