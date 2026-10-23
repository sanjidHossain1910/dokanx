import { AccountProvider } from "@/src/account/AccountProvider";
import CloudBackupProvider from "@/src/cloudBackup/CloudBackupProvider";
import AccountWorkspaceGate from '@/src/account/AccountWorkspaceGate';
import ReminderProvider from "@/src/reminders/ReminderProvider";
import { SecurityProvider, AppAccessGate } from "@/src/security/SecurityProvider";
import { initializeI18n } from "@/src/i18n";
import { BusinessProvider, useBusiness } from "@/src/store/BusinessProvider";
import { ScanFeedbackProvider } from "@/src/scanner/ScanFeedbackProvider";
import { ThemeProvider, useTheme } from "@/src/theme/ThemeProvider";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { ActivityIndicator, Button, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";
void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return <ThemeProvider><AppRoot /></ThemeProvider>;
}

function AppRoot() {
  const { colors, isDark } = useTheme();
  const [isI18nReady, setIsI18nReady] = useState(false);
  const [initializationError, setInitializationError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void initializeI18n().then(() => {
      if (active) setIsI18nReady(true);
    }).catch(() => {
      if (active) setInitializationError(true);
    }).finally(() => { void SplashScreen.hideAsync().catch(() => {}); });
    return () => { active = false; };
  }, [attempt]);
  return <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
    <SafeAreaProvider style={{ backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {initializationError ? <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.background }}><Text style={{ color: colors.text }}>অ্যাপ চালু করা যায়নি / Could not start the app.</Text><Button color={colors.primary} title="আবার চেষ্টা করুন / Try again" onPress={() => { setInitializationError(false); setAttempt((value) => value + 1); }} /></View> : !isI18nReady ? <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View> :
        <ScanFeedbackProvider><BusinessProvider><SecurityProvider><AppAccessGate><AccountProvider><AccountWorkspaceGate><CloudBackupProvider><ReminderProvider><ShopNavigation /></ReminderProvider></CloudBackupProvider></AccountWorkspaceGate></AccountProvider></AppAccessGate></SecurityProvider></BusinessProvider></ScanFeedbackProvider>}
    </SafeAreaProvider>
  </GestureHandlerRootView>;
}

function ShopNavigation() {
  const { data, workspace, ready, error, retry } = useBusiness();
  const { colors } = useTheme();
  if (!ready || error) return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: 24, gap: 16 }}>{error ? <><Text style={{ color: colors.text }}>তথ্য খোলা যায়নি / Could not load shop data.</Text><Button title="আবার চেষ্টা করুন / Try again" onPress={retry} /></> : <ActivityIndicator color={colors.primary} />}</View>;
  const active = data.shopActive === true;
  return <Stack key={workspace} initialRouteName="index" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="index" />
    <Stack.Screen name="account" />
    <Stack.Screen name="account-sync" />
    <Stack.Protected guard={!active}><Stack.Screen name="setup" /></Stack.Protected>
    <Stack.Protected guard={active}>
      <Stack.Screen name="(tabs)" /><Stack.Screen name="(scanner)" /><Stack.Screen name="business" /><Stack.Screen name="inventory" /><Stack.Screen name="settings" />
    </Stack.Protected>
  </Stack>;
}
