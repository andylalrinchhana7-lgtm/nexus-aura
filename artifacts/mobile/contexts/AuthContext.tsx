import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

interface AuthUser {
  id: string;
  username: string;
  email: string;
  avatarColor: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  register: (username: string, email: string) => Promise<{ otp: string }>;
  verifyOTP: (email: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "nexus_aura_user";
const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

async function registerPushToken(userId: string) {
  if (Platform.OS === "web") return;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    await fetch(`${BASE_URL}/api/auth/push-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, token }),
    });
  } catch {
    // Push setup is optional — don't block the app
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(async (stored) => {
        if (stored) {
          const u = JSON.parse(stored) as AuthUser;
          setUser(u);
          await registerPushToken(u.id);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const register = useCallback(async (username: string, email: string) => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error: string };
      throw new Error(err.error ?? "Registration failed");
    }
    const data = (await res.json()) as {
      userId: string;
      username: string;
      email: string;
      avatarColor: string;
      otp: string;
    };
    await AsyncStorage.setItem(
      "nexus_pending_email",
      JSON.stringify({ email: data.email, userId: data.userId, username: data.username, avatarColor: data.avatarColor })
    );
    return { otp: data.otp };
  }, []);

  const verifyOTP = useCallback(async (email: string, otp: string) => {
    const res = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error: string };
      throw new Error(err.error ?? "Invalid OTP");
    }
    const data = (await res.json()) as AuthUser;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setUser(data);
    await registerPushToken(data.id);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem("nexus_pending_email");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, register, verifyOTP, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
