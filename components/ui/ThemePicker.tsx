import { useTheme } from "@/src/theme/ThemeProvider";
import { Monitor, Moon, Sun } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

export default function ThemePicker() {
  const { mode, setMode, ready, colors } = useTheme();
  const { t } = useTranslation();
  const [error, setError] = useState(false);
  const options = [{ id: "light", icon: Sun }, { id: "dark", icon: Moon }, { id: "system", icon: Monitor }] as const;
  return <View className="gap-3"><Text className="text-base font-semibold text-ink">{t("dashboard.theme")}</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel={t("dashboard.theme")} className="flex-row gap-2">{options.map(({ id, icon: Icon }) => <Pressable key={id} disabled={!ready} accessibilityRole="radio" aria-checked={mode === id} aria-disabled={!ready} accessibilityState={{ checked: mode === id, disabled: !ready }} accessibilityLabel={t(`dashboard.${id}`)} onPress={() => { setError(false); void setMode(id).catch(() => setError(true)); }} className="flex-1 items-center justify-center gap-2 rounded-xl border p-3" style={{ backgroundColor: mode === id ? colors.primarySoft : colors.card, borderColor: mode === id ? colors.primary : colors.border, minHeight: 78 }}><Icon size={20} color={mode === id ? colors.primary : colors.muted} /><Text className="text-sm text-ink" style={{ lineHeight: 22 }}>{t(`dashboard.${id}`)}</Text></Pressable>)}</View>
    <Text className="text-xs text-muted" style={{ lineHeight: 21 }}>{t("dashboard.themeHint")}</Text>
    {error && <Text accessibilityRole="alert" className="text-sm text-negative">{t("dashboard.themeError")}</Text>}
  </View>;
}
