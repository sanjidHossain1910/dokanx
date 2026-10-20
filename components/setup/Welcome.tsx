import { Button, useUi } from "@/components/business/Screen";
import LanguageDropdown from "@/components/ui/LanguageDropdown";
import ThemePicker from "@/components/ui/ThemePicker";
import { useTheme } from "@/src/theme/ThemeProvider";
import { router } from "expo-router";
import { BadgeCheck, Contact, CreditCard, Store, UserRound } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import SetupFrame from "./SetupFrame";

export default function ShopWelcome() {
  const { t } = useTranslation(); const ui = useUi(); const { colors } = useTheme();
  const start = () => router.push("/setup/basic");
  return <SetupFrame footer={<Button title={`${t("buttons.getStarted")}  →`} onPress={start} />}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><LanguageDropdown /><Pressable accessibilityRole="button" onPress={start} style={{ padding: 12 }}><Text style={ui.subtitle}>{t("buttons.skip")}</Text></Pressable></View>
    <View style={{ alignItems: "center", gap: 16, paddingVertical: 12 }}>
      <View style={{ width: 158, height: 158, borderRadius: 44, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}><Store size={100} color={colors.primary} strokeWidth={1.6} /></View>
      <Text accessibilityRole="header" style={[ui.title, { textAlign: "center", fontSize: 27 }]}>{t("setup.welcome")}</Text><Text style={[ui.text, { textAlign: "center", maxWidth: 300 }]}>{t("setup.welcomeHint")}</Text>
    </View>
    <View style={[ui.card, { backgroundColor: colors.primarySoft, borderWidth: 0, gap: 17 }]}>{[{ Icon: UserRound, key: "names" }, { Icon: Contact, key: "contact" }, { Icon: CreditCard, key: "payments" }, { Icon: BadgeCheck, key: "editLater" }].map(({ Icon, key }) => <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 13 }}><Icon size={21} color={colors.primary} /><Text style={[ui.text, { flex: 1, color: colors.text }]}>{t(`setup.${key}`)}</Text></View>)}</View>
    <ThemePicker />
    <Button secondary title={t("flows.restore")} onPress={() => router.push("/setup/restore")} />
  </SetupFrame>;
}
