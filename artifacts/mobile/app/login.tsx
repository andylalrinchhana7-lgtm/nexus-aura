import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleContinue = async () => {
    if (!username.trim() || !email.trim()) {
      Alert.alert("Missing info", "Please fill in your username and email.");
      return;
    }

    setLoading(true);
    try {
      const { otp } = await register(username.trim(), email.trim());
      router.push({ pathname: "/otp", params: { email: email.trim(), otp } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20) },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>N</Text>
          </View>
          <Text style={styles.appName}>Nexus Aura</Text>
          <Text style={styles.tagline}>Connect. Chat. Vibe.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Your display name"
            placeholderTextColor="#8696a0"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#8696a0"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleContinue}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Continue</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footer}>
            A 6-digit OTP will be sent to verify your email.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b141a" },
  container: { flex: 1, paddingHorizontal: 28 },
  header: { alignItems: "center", marginBottom: 44 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#00a884",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#00a884",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  logoText: { color: "#fff", fontSize: 36, fontWeight: "800" },
  appName: { color: "#e9edef", fontSize: 28, fontWeight: "700", letterSpacing: 0.5 },
  tagline: { color: "#8696a0", fontSize: 14, marginTop: 6 },
  form: {},
  label: { color: "#8696a0", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input: {
    backgroundColor: "#1f2c34",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#e9edef",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#2a3942",
  },
  btn: {
    backgroundColor: "#00a884",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 28,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  footer: {
    color: "#8696a0",
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
  },
});
