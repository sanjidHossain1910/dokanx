import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useColorScheme, View } from "react-native";
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from "expo-router";
import { VariableContextProvider } from "react-native-css";
import { darkTheme, getThemeVariables, isThemeMode, lightTheme, resolveThemeMode, type ThemeMode, type ThemeTokens } from "./tokens";
import { syncPlatformTheme } from "./syncPlatformTheme";

const THEME_KEY = "@dokanx/theme";
interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeTokens;
  ready: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
}
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [ready, setReady] = useState(false);
  const writeQueue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (active && isThemeMode(saved)) setModeState(saved);
    }).catch(() => {}).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  // Keep the server and first client render identical; otherwise React can retain
  // the server's light CSS variables while context already reports dark mode.
  const isDark = resolveThemeMode(mode, system, ready) === "dark";
  const colors = isDark ? darkTheme : lightTheme;
  useEffect(() => { if (ready) syncPlatformTheme(colors, isDark, mode); }, [colors, isDark, mode, ready]);
  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, primary: colors.primary, background: colors.background, card: colors.card, text: colors.text, border: colors.border, notification: colors.danger } };
  }, [colors, isDark]);
  const variables = useMemo(() => getThemeVariables(colors), [colors]);
  const value: ThemeContextValue = {
    mode, isDark, colors, ready,
    setMode: (next) => {
      setModeState(next);
      const write = writeQueue.current.then(() => AsyncStorage.setItem(THEME_KEY, next));
      writeQueue.current = write.catch(() => {});
      return write;
    },
  };
  return <ThemeContext.Provider value={value}><VariableContextProvider value={variables}><NavigationThemeProvider value={navigationTheme}><View style={{ flex: 1, backgroundColor: ready ? colors.background : "transparent" }}>{ready ? children : null}</View></NavigationThemeProvider></VariableContextProvider></ThemeContext.Provider>;
}
export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("ThemeProvider is required");
  return theme;
}
