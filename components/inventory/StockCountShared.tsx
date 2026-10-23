import type { ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useBusiness } from "@/src/store/BusinessProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import { countDifference, type CountItem } from "@/src/store/stockCounts";
import { unitLabel } from "@/src/store/productUnits";
import { formatNumber } from "@/src/dashboard/format";
import Header from "@/components/ui/Header";
import { Button, useUi } from "@/components/business/Screen";
import { ProductPhoto } from "@/components/pos/Shared";

export function CountFrame({ title, description, onBack, children }: { title: string; description?: string; onBack?: () => void; children: ReactNode }) {
  const { colors } = useTheme(); const { ready, error, retry } = useBusiness(); const { t } = useTranslation(); const ui = useUi();
  return <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}><Header title={title} description={description} onBack={onBack} fallbackHref="/(tabs)/packege" />
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>{error ? <View style={{ padding: 20, gap: 12 }}><Text style={ui.error}>{t("business.storageUnavailable")}</Text><Button title={t("business.retry")} onPress={retry} /></View> : !ready ? <ActivityIndicator color={colors.primary} /> : children}</KeyboardAvoidingView>
  </SafeAreaView>;
}
export function CountItemView({ item }: { item: CountItem }) {
  const { colors } = useTheme(); const { t, i18n } = useTranslation(); const ui = useUi(); const diff = countDifference(item), unit = unitLabel(item.unit, i18n.language);
  return <View style={{ gap: 6 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><ProductPhoto uri={item.photoUri} name={item.name} size={52} /><View style={{ flex: 1, gap: 4 }}><Text style={ui.subtitle}>{item.name}</Text><Text style={ui.text}>{formatNumber(item.before, i18n.language)} → {formatNumber(item.counted, i18n.language)} {unit}</Text></View></View><Text style={{ color: diff < 0 ? colors.danger : diff > 0 ? colors.success : colors.muted, fontSize: 14, lineHeight: 22, fontWeight: "600" }}>{diff ? `${diff > 0 ? "+" : ""}${formatNumber(diff, i18n.language)} ${unit}` : t("stockCount.unchanged")}</Text></View>;
}
