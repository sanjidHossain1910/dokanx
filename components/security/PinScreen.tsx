import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Delete, LockKeyhole } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/src/theme/ThemeProvider";
import { formatNumber } from "@/src/dashboard/format";
import { PIN_DIGITS } from "@/src/security/pin";
import Header from "@/components/ui/Header";

export function SecurityPage({ title, subtitle, children, footer, onBack }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode; onBack?: () => void }) {
  const { colors } = useTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>{onBack && <Header title={title} onBack={onBack} />}<ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, gap: 18, width: "100%", maxWidth: 480, alignSelf: "center" }} keyboardShouldPersistTaps="handled"><View style={{ alignItems: "center", gap: 12 }}><View style={{ padding: 20, backgroundColor: colors.primarySoft, borderRadius: 40 }}><LockKeyhole size={32} color={colors.primary} /></View><Text accessibilityRole="header" style={{ color: colors.text, fontSize: 23, lineHeight: 32, fontWeight: "700", textAlign: "center" }}>{title}</Text><Text style={{ color: colors.muted, fontSize: 14, lineHeight: 23, textAlign: "center" }}>{subtitle}</Text></View>{children}{footer}</ScrollView></SafeAreaView>;
}
export default function PinScreen({ title, subtitle, pin, onChange, onSubmit, action, busy, progress, disabled, issue, inputFooter, footer, onBack }: { title: string; subtitle: string; pin: string; onChange: (pin: string) => void; onSubmit: (value: string) => void; action: string; busy?: boolean; progress?: number; disabled?: boolean; issue?: string; inputFooter?: ReactNode; footer?: ReactNode; onBack?: () => void }) {
  const { colors } = useTheme(); const { t, i18n } = useTranslation();
  return <SecurityPage title={title} subtitle={subtitle} footer={footer} onBack={onBack}>
    <View accessible accessibilityLabel={t("security.enteredDigits", { count: pin.length, quantity: formatNumber(pin.length, i18n.language) })} style={{ flexDirection: "row", justifyContent: "center", gap: 15, paddingVertical: 8 }}>{Array.from({ length: PIN_DIGITS }, (_, index) => <View key={index} style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: pin.length > index ? colors.primary : colors.muted, backgroundColor: pin.length > index ? colors.primary : "transparent" }} />)}</View>
    {inputFooter}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "delete"].map((key) => key === "" ? <View key="keypad-spacer" style={{ width: "30%", flexGrow: 1 }} /> : <Pressable key={key} accessibilityRole="button" accessibilityLabel={key === "delete" ? t("security.deleteDigit") : formatNumber(Number(key), i18n.language)} disabled={busy || disabled} onPress={() => { if (key !== "delete" && pin.length >= PIN_DIGITS) return; const next = key === "delete" ? pin.slice(0, -1) : pin + key; onChange(next); if (next.length === PIN_DIGITS && key !== "delete") onSubmit(next); }} style={({ pressed }) => ({ width: "30%", flexGrow: 1, minHeight: 52, borderRadius: 10, justifyContent: "center", alignItems: "center", backgroundColor: pressed ? colors.primarySoft : colors.elevated, opacity: busy || disabled ? 0.4 : 1 })}>{key === "delete" ? <Delete size={23} color={colors.text} /> : <Text style={{ color: colors.text, fontSize: 22, fontWeight: "600" }}>{formatNumber(Number(key), i18n.language)}</Text>}</Pressable>)}</View>
    {!!issue && <Text accessibilityRole="alert" style={{ color: colors.danger, textAlign: "center", lineHeight: 22 }}>{issue}</Text>}
    {busy && <><ActivityIndicator accessibilityLabel={t("security.verifying")} color={colors.primary} />{progress !== undefined && <Text accessibilityLiveRegion="polite" style={{ color: colors.muted, textAlign: "center" }}>{t("security.pinProgress", { percent: formatNumber(progress, i18n.language) })}</Text>}</>}
    {!busy && <Text style={{ color: colors.muted, textAlign: "center" }}>{action}</Text>}
  </SecurityPage>;
}
