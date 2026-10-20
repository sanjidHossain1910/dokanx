import * as SystemUI from "expo-system-ui";
import { Appearance } from "react-native";
import type { ThemeMode, ThemeTokens } from "./tokens";

export function syncPlatformTheme(colors: ThemeTokens, _isDark: boolean, mode: ThemeMode) {
  Appearance.setColorScheme(mode === "system" ? "unspecified" : mode);
  void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
}
