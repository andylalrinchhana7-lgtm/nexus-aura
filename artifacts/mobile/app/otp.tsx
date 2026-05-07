import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";

export default function OTPScreen() {
  const { email, otp: simulatedOtp } = useLocalSearchParams<{
    email: string;
    otp: string;
  }>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { verifyOTP } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const handleVerify = async () => {
    if (code.length !== 6) {
      Alert.alert("Enter full code", "Please enter the 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      await verifyOTP(email, code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/");
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = err instanceof Error ? err.message : "Invalid code";
      Alert.alert("Wrong code", message);
    } finally {
      setLoading(false);
    }
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 20);

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Feather name="arrow-left" size={22} color="#8696a0" />
      </TouchableOpacity>

      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Feather name="shield" size={48} color="#00a884" />
        </View>

        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.sub}>
          We sent a code to{"\n"}
          <Text style={styles.email}>{email}</Text>
        </Text>

        <View style={styles.otpBox}>
          <Text style={styles.otpLabel}>Your simulated OTP code:</Text>
          <View style={styles.otpDisplay}>
            {(simulatedOtp ?? "------").split("").map((digit, i) => (
              <View key={i} style={styles.digitBox}>
                <Text style={styles.digitText}>{digit}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.otpNote}>
            (In a real app this would be sent to your email)
          </Text>
        </View>

        <Text style={styles.inputLabel}>Enter the code below:</Text>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
          placeholder="000000"
          placeholderTextColor="#8696a0"
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
          autoFocus
        />

        <TouchableOpacity
          style={[styles.btn, (loading || code.length !== 6) && { opacity: 0.6 }]}
          onPress={handleVerify}
          disabled={loading || code.length !== 6}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Verify & Enter Chat</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b141a" },
  back: { paddingHorizontal: 20, paddingVertical: 12 },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: "center",
    paddingTop: 20,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#1f2c34",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: { color: "#e9edef", fontSize: 24, fontWeight: "700", marginBottom: 10 },
  sub: { color: "#8696a0", fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 32 },
  email: { color: "#00a884", fontWeight: "600" },
  otpBox: {
    backgroundColor: "#1f2c34",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    alignItems: "center",
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "#2a3942",
  },
  otpLabel: { color: "#8696a0", fontSize: 12, marginBottom: 12 },
  otpDisplay: { flexDirection: "row", gap: 8, marginBottom: 8 },
  digitBox: {
    width: 38,
    height: 46,
    backgroundColor: "#0b141a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#00a884",
    alignItems: "center",
    justifyContent: "center",
  },
  digitText: { color: "#00a884", fontSize: 20, fontWeight: "700" },
  otpNote: { color: "#8696a0", fontSize: 11, textAlign: "center" },
  inputLabel: { color: "#8696a0", fontSize: 12, alignSelf: "flex-start", marginBottom: 8 },
  input: {
    backgroundColor: "#1f2c34",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: "#e9edef",
    fontSize: 26,
    letterSpacing: 12,
    borderWidth: 1,
    borderColor: "#2a3942",
    width: "100%",
    marginBottom: 20,
  },
  btn: {
    backgroundColor: "#00a884",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    width: "100%",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
