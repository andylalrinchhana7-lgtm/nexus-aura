import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SocketProvider } from "@/contexts/SocketContext";

SplashScreen.preventAutoHideAsync();

// ── Foreground notification behaviour ──────────────────────────────────────
// Show banner + play sound even when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Android notification channel ───────────────────────────────────────────
async function setupAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("messages", {
    name: "Messages",
    description: "New chat message notifications",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#00a884",
    sound: "default",
    enableVibrate: true,
    showBadge: true,
  });
}

const queryClient = new QueryClient();

// ── Notification deep-link payload ─────────────────────────────────────────
interface NotificationData {
  roomId?: string;
  roomName?: string;
}

// ── Inner navigator with notification listener ─────────────────────────────
function RootLayoutNav() {
  const router = useRouter();
  const notificationResponseListener =
    useRef<Notifications.EventSubscription | null>(null);
  const notificationReceivedListener =
    useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Handle tap on a notification (app background/killed)
    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as NotificationData;
        if (data?.roomId && data?.roomName) {
          router.push({
            pathname: "/room/[id]",
            params: { id: data.roomId, name: data.roomName },
          });
        }
      });

    // Handle notification received while app is foregrounded (optional UI hook)
    notificationReceivedListener.current =
      Notifications.addNotificationReceivedListener((_notification) => {
        // Badge / in-app banner is handled automatically by setNotificationHandler
      });

    // Check if the app was launched from a notification (cold start — native only)
    if (Platform.OS !== "web") {
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) {
          const data = response.notification.request.content.data as NotificationData;
          if (data?.roomId && data?.roomName) {
            router.push({
              pathname: "/room/[id]",
              params: { id: data.roomId, name: data.roomName },
            });
          }
        }
      });
    }

    return () => {
      notificationResponseListener.current?.remove();
      notificationReceivedListener.current?.remove();
    };
  }, [router]);

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="otp" options={{ headerShown: false }} />
      <Stack.Screen name="room/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

function AppWithAuth() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <SocketProvider>
      <RootLayoutNav />
    </SocketProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Set up the Android channel once on app start
  useEffect(() => {
    setupAndroidChannel();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <AppWithAuth />
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
