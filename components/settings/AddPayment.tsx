import { WalletSetup } from "@/components/business/PaymentSettings";
import { Button, useUi } from "@/components/business/Screen";
import WalletLogo from "@/components/payments/WalletLogo";
import SetupFrame from "@/components/setup/SetupFrame";
import { useTheme } from "@/src/theme/ThemeProvider";
import { router, useLocalSearchParams } from "expo-router";
import { Building2, CheckCircle2, Circle, Grid2X2 } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

export default function AddPayment() {
  const [busy, setBusy] = useState(false);
  const params = useLocalSearchParams<{ method?: string }>(); const [method, setMethod] = useState<"bkash" | "nagad">(params.method === "nagad" ? "nagad" : "bkash"); const { colors } = useTheme(); const { t } = useTranslation(); const ui = useUi();
  return <SetupFrame title={t("profileSettings.addPayment")} onBack={() => { if (!busy) router.dismissTo("/settings/payments"); }} footer={<Button secondary disabled={busy} title={t("pos.cancel")} onPress={() => router.dismissTo("/settings/payments")} />}>
    <View style={[ui.card, { padding: 0, overflow: "hidden" }]}>{(["bkash", "nagad"] as const).map((id) => <Pressable key={id} accessibilityRole="radio" aria-checked={method === id} disabled={busy} accessibilityLabel={t(`pos.${id}`)} accessibilityState={{ checked: method === id }} onPress={() => setMethod(id)} style={{ flexDirection: "row", gap: 14, alignItems: "center", minHeight: 65, padding: 14, backgroundColor: method === id ? colors.primarySoft : colors.card }}><WalletLogo method={id} width={38} height={34} /><Text style={[ui.subtitle, { flex: 1 }]}>{t(`pos.${id}`)}</Text>{method === id ? <CheckCircle2 color={colors.primary} size={22} /> : <Circle color={colors.muted} size={22} />}</Pressable>)}{[{ Icon: Building2, label: "bank" }, { Icon: Grid2X2, label: "other" }].map(({ Icon, label }) => <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, opacity: 0.55 }}><Icon color={colors.muted} size={28} /><Text style={[ui.text, { flex: 1 }]}>{t(`profileSettings.${label}`)}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{t("profileSettings.later")}</Text></View>)}</View>
    <WalletSetup key={method} method={method} onBusyChange={setBusy} onSaved={() => router.dismissTo("/settings/payments")} />
  </SetupFrame>;
}

