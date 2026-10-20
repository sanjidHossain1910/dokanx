import { Button, Field, Screen, useUi } from "@/components/business/Screen";
import { useTheme } from "@/src/theme/ThemeProvider";
import Constants from "expo-constants";
import { router, useLocalSearchParams } from "expo-router";
import { BookOpen, FileText, HelpCircle, LifeBuoy, LockKeyhole, MessageSquare, Store } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Share, Text, View } from "react-native";
import MenuRow from "./MenuRow";

const topics = ["guide", "faq", "support", "feedback", "privacy", "terms"] as const;
export default function Help() {
  const { topic } = useLocalSearchParams<{ topic?: string }>(); const { t, i18n } = useTranslation(); const ui = useUi(); const { colors } = useTheme(); const [feedback, setFeedback] = useState(""); const [error, setError] = useState(false); const [busy, setBusy] = useState(false);
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const selected = topics.find((value) => value === topic);
  const share = async () => {
    if (busy || !feedback.trim()) return;
    setBusy(true); setError(false);
    try { await Share.share({ message: `DokanX ${version}\n${Platform.OS} · ${i18n.language}\n\n${feedback.trim()}`, title: t("profileSettings.feedback") }); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  return <Screen back title={t(`profileSettings.${selected ?? "helpAbout"}`)} fallbackHref={selected ? "/settings/help" : "/(tabs)/profile"} onBack={selected ? () => router.setParams({ topic: "" }) : undefined}>
    {selected ? <><Text style={ui.text}>{t(`profileSettings.${selected}Body`)}</Text>{(selected === "feedback" || selected === "support") && <><Field label={t("profileSettings.message")} value={feedback} onChangeText={setFeedback} multiline maxLength={2000} editable={!busy} /><Button title={t("profileSettings.shareMessage")} disabled={busy || !feedback.trim()} onPress={() => void share()} />{!!error && <Text style={ui.error}>{t("profileSettings.shareFailed")}</Text>}</>}</> : <>
      {[{ id: "guide", Icon: BookOpen, color: "#F43F5E" }, { id: "faq", Icon: HelpCircle, color: "#F59E0B" }, { id: "support", Icon: LifeBuoy, color: "#2563EB" }, { id: "feedback", Icon: MessageSquare, color: "#10B981" }, { id: "privacy", Icon: LockKeyhole, color: "#8B5CF6" }, { id: "terms", Icon: FileText, color: "#F97316" }].map(({ id, Icon, color }) => <MenuRow key={id} title={t(`profileSettings.${id}`)} subtitle={t(`profileSettings.${id}Hint`)} Icon={Icon} color={color} onPress={() => { setFeedback(""); setError(false); router.setParams({ topic: id }); }} />)}
      <View style={[ui.card, { backgroundColor: colors.primarySoft, borderWidth: 0, flexDirection: "row", gap: 16 }]}><View style={{ borderRadius: 12, padding: 10, backgroundColor: colors.primary, alignSelf: "flex-start" }}><Store size={32} color={colors.onPrimary} /></View><View style={{ flex: 1, gap: 8 }}><Text style={ui.subtitle}>DokanX</Text><Text style={ui.text}>{t("profileSettings.version", { version })}</Text><Text style={ui.text}>{t("profileSettings.aboutBody")}</Text></View></View>
    </>}
  </Screen>;
}
