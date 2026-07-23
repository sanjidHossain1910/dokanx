import { initializeI18n } from "@/src/i18n";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isI18nReady, setIsI18nReady] = useState(false);
  useEffect(() => {
    void initializeI18n().finally(() => {
      setIsI18nReady(true);
      void SplashScreen.hideAsync();
    });
  }, []);
  if (!isI18nReady) return null;



  return (
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
