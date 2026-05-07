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

const SAMPLE_CALLS = [
  { id: "1", name: "General Chat", type: "missed", dir: "in", icon: "globe" as const, color: "#00a884", time: "Today, 10:24 AM" },
  { id: "2", name: "Tech Talk", type: "incoming", dir: "in", icon: "cpu" as const, color: "#45B7D1", time: "Today, 9:11 AM" },
  { id: "3", name: "Music Vibes", type: "outgoing", dir: "out", icon: "music" as const, color: "#BB8FCE", time: "Yesterday" },
];

function CallRow({ item }: { item: typeof SAMPLE_CALLS[0] }) {
  const isMissed = item.type === "missed";
  return (
    <TouchableOpacity
      style={styles.callRow}
      activeOpacity={0.75}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert("Coming Soon", "Voice and video calls are on the way!", [{ text: "OK" }]);
      }}
    >
      <View style={[styles.callIcon, { backgroundColor: item.color + "22" }]}>
        <Feather name={item.icon} size={22} color={item.color} />
      </View>
      <View style={styles.callBody}>
        <Text style={[styles.callName, isMissed && styles.callNameMissed]}>{item.name}</Text>
        <View style={styles.callMeta}>
          <Feather
            name={item.dir === "in" ? "phone-incoming" : "phone-outgoing"}
            size={12}
            color={isMissed ? "#ef4444" : "#8696a0"}
          />
          <Text style={[styles.callType, isMissed && styles.callTypeMissed]}>
            {item.type.charAt(0).toUpperCase() + item.type.slice(1)} · {item.time}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => Alert.alert("Coming Soon", "Call back feature is on the way!", [{ text: "OK" }])}
      >
        <Feather name="phone" size={20} color="#00a884" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function CallsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: WEB_PAD, paddingBottom: insets.bottom + TAB_H + 12 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionHeader}>Recent</Text>
      <View style={styles.callsList}>
        {SAMPLE_CALLS.map((call, i) => (
          <React.Fragment key={call.id}>
            <CallRow item={call} />
            {i < SAMPLE_CALLS.length - 1 && <View style={styles.separator} />}
          </React.Fragment>
        ))}
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroIconRing}>
          <View style={styles.heroIcon}>
            <Feather name="phone" size={36} color="#00a884" />
          </View>
        </View>
        <Text style={styles.heroTitle}>Voice & Video Calls</Text>
        <Text style={styles.heroSub}>
          End-to-end encrypted calls are coming in a future update. Stay tuned!
        </Text>

        <View style={styles.featureRow}>
          {[
            { icon: "phone-call" as const, label: "Voice Calls" },
            { icon: "video" as const, label: "Video Calls" },
            { icon: "monitor" as const, label: "Screen Share" },
          ].map((f) => (
            <View key={f.label} style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Feather name={f.icon} size={18} color="#00a884" />
              </View>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b141a" },
  content: { paddingHorizontal: 0 },
  sectionHeader: {
    color: "#8696a0",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  callsList: {
    backgroundColor: "#1f2c34",
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: "hidden",
  },
  callRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  callIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  callBody: { flex: 1 },
  callName: { color: "#e9edef", fontSize: 15, fontWeight: "600", marginBottom: 4 },
  callNameMissed: { color: "#ef4444" },
  callMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  callType: { color: "#8696a0", fontSize: 12 },
  callTypeMissed: { color: "#ef4444" },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#2a3942",
    marginLeft: 76,
  },
  heroCard: {
    alignItems: "center",
    backgroundColor: "#1f2c34",
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 10,
  },
  heroIconRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: "#00a88433",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  heroIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#0b141a",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: "#e9edef", fontSize: 20, fontWeight: "700" },
  heroSub: { color: "#8696a0", fontSize: 13, textAlign: "center", lineHeight: 19 },
  featureRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  featureItem: { alignItems: "center", gap: 8, flex: 1 },
  featureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,168,132,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureLabel: { color: "#8696a0", fontSize: 11, fontWeight: "600", textAlign: "center" },
});
