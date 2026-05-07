import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

const WEB_PAD = Platform.OS === "web" ? 67 : 0;
const TAB_H = Platform.OS === "ios" ? 88 : 62;

function CommunityCard({
  icon,
  title,
  desc,
  color,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  desc: string;
  color: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: color }]}
      activeOpacity={0.75}
      onPress={() =>
        Alert.alert("Coming Soon", `${title} community features are on the way!`, [{ text: "OK" }])
      }
    >
      <View style={[styles.cardIcon, { backgroundColor: color + "22" }]}>
        <Feather name={icon} size={22} color={color} />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{desc}</Text>
      </View>
      <Feather name="chevron-right" size={16} color="#2a3942" />
    </TouchableOpacity>
  );
}

export default function CommunitiesScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: WEB_PAD + 20, paddingBottom: insets.bottom + TAB_H + 12 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero ── */}
      <View style={styles.hero}>
        <View style={styles.heroIconWrap}>
          <Feather name="users" size={40} color="#00a884" />
        </View>
        <Text style={styles.heroTitle}>Communities</Text>
        <Text style={styles.heroSub}>
          Bring groups together under one community. Organise conversations, share updates, and stay connected.
        </Text>
        <TouchableOpacity
          style={styles.createBtn}
          activeOpacity={0.85}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert("Coming Soon", "Community creation is on the way!", [{ text: "OK" }]);
          }}
        >
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.createBtnText}>New Community</Text>
        </TouchableOpacity>
      </View>

      {/* ── Feature cards ── */}
      <Text style={styles.sectionHeader}>Features</Text>
      <View style={styles.cardList}>
        <CommunityCard
          icon="message-square"
          title="Announcement Channels"
          desc="Broadcast important updates to all members"
          color="#00a884"
        />
        <View style={styles.cardDivider} />
        <CommunityCard
          icon="users"
          title="Sub-groups"
          desc="Create smaller groups within your community"
          color="#45B7D1"
        />
        <View style={styles.cardDivider} />
        <CommunityCard
          icon="shield"
          title="Admin Controls"
          desc="Manage members, permissions and moderation"
          color="#BB8FCE"
        />
        <View style={styles.cardDivider} />
        <CommunityCard
          icon="link"
          title="Invite Links"
          desc="Share a link to grow your community"
          color="#F7DC6F"
        />
      </View>

      {/* ── Coming soon banner ── */}
      <View style={styles.comingSoonCard}>
        <Feather name="zap" size={20} color="#F7DC6F" />
        <View style={styles.comingSoonText}>
          <Text style={styles.comingSoonTitle}>Launching Soon</Text>
          <Text style={styles.comingSoonSub}>Communities are currently in development. Check back soon!</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b141a" },
  content: { paddingHorizontal: 0 },

  hero: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  heroIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(0,168,132,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroTitle: { color: "#e9edef", fontSize: 22, fontWeight: "700", marginBottom: 10 },
  heroSub: { color: "#8696a0", fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#00a884",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  createBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  sectionHeader: {
    color: "#8696a0",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    marginTop: 28,
    marginBottom: 8,
  },

  cardList: {
    backgroundColor: "#1f2c34",
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: "hidden",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    borderLeftWidth: 3,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#2a3942",
    marginLeft: 62,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1 },
  cardTitle: { color: "#e9edef", fontSize: 15, fontWeight: "600", marginBottom: 2 },
  cardDesc: { color: "#8696a0", fontSize: 12 },

  comingSoonCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1f2c34",
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F7DC6F33",
  },
  comingSoonText: { flex: 1 },
  comingSoonTitle: { color: "#F7DC6F", fontSize: 14, fontWeight: "700", marginBottom: 2 },
  comingSoonSub: { color: "#8696a0", fontSize: 12, lineHeight: 17 },
});
