import { Screen, useUi } from "@/components/business/Screen";
import { changeLanguage } from "@/src/i18n";
import { useTheme } from "@/src/theme/ThemeProvider";
import { CheckCircle2, Circle, Languages, Monitor, Moon, Sun } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

export default function Appearance() {
  const { t, i18n } = useTranslation(); const { colors, mode, setMode } = useTheme(); const ui = useUi(); const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const update = async (action: () => Promise<void>) => { if (busy) return; setBusy(true); setError(false); try { await action(); } catch { setError(true); } finally { setBusy(false); } };
  const options = (section: "language" | "appearance") => section === "language" ? [{ id: "en", label: "English", Icon: Languages }, { id: "bn", label: "বাংলা", Icon: Languages }] : [{ id: "light", label: t("dashboard.light"), Icon: Sun }, { id: "dark", label: t("dashboard.dark"), Icon: Moon }, { id: "system", label: t("dashboard.system"), Icon: Monitor }];
  return <Screen back title={t("profileSettings.languageAppearance")} fallbackHref="/(tabs)/profile">
    {(["language", "appearance"] as const).map((section) => <View key={section} style={{ gap: 12 }}><Text style={ui.subtitle}>{t(`profileSettings.${section}`)}</Text><View style={[ui.card, { padding: 0, overflow: "hidden" }]} accessibilityRole="radiogroup" accessibilityLabel={t(`profileSettings.${section}`)}>{options(section).map(({ id, label, Icon }) => {
      const checked = section === "language" ? i18n.language.startsWith(id) : mode === id;
      const Mark = checked ? CheckCircle2 : Circle;
      return <Pressable key={id} accessibilityRole="radio" aria-checked={checked} accessibilityLabel={label} accessibilityState={{ checked, disabled: busy }} disabled={busy} onPress={() => void update(() => section === "language" ? changeLanguage(id as "en" | "bn") : setMode(id as "light" | "dark" | "system"))} style={{ minHeight: 68, padding: 16, flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: checked ? colors.primarySoft : colors.card }}><Icon size={24} color={checked ? colors.primary : colors.muted} /><Text style={[ui.subtitle, { flex: 1 }]}>{label}</Text><Mark size={22} color={checked ? colors.primary : colors.muted} /></Pressable>;
    })}</View></View>)}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{t("business.saveFailed")}</Text>}
  </Screen>;
}

