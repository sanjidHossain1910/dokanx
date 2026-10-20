import Header from "@/components/ui/Header";
import { Button, useUi } from "@/components/business/Screen";
import { useBusiness } from "@/src/store/BusinessProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import { Search, Store, X } from "lucide-react-native";
import type { Supplier } from "@/src/store/purchasing";
export function PurchaseFrame({ title, hint, children, footer, right, scroll = true, hideHeader = false }: { title: string; hint?: string; children: ReactNode; footer?: ReactNode; right?: ReactNode; scroll?: boolean; hideHeader?: boolean }) {
  const { colors } = useTheme();
  const { ready, error, retry } = useBusiness();
  const { t } = useTranslation();
  const ui = useUi();
  const insets = useSafeAreaInsets();
  return <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}>
    {!hideHeader && <Header title={title} description={hint} rightSection={right} fallbackHref="/(tabs)" />}
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {error ? <View style={{ padding: 20, gap: 12 }}><Text style={ui.error}>{t("business.storageUnavailable")}</Text><Button title={t("business.retry")} onPress={retry} /></View> : !ready ? <ActivityIndicator color={colors.primary} /> : scroll ? <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 16, maxWidth: 720, width: "100%", alignSelf: "center" }}>{children}</ScrollView> : children}
    </KeyboardAvoidingView>
    {footer && ready && !error && <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 14, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}><View style={{ width: "100%", maxWidth: 680, alignSelf: "center" }}>{footer}</View></View>}
  </SafeAreaView>;
}
export function PurchaseIssue({ issue }: { issue?: string }) { const { t, i18n } = useTranslation(); const ui = useUi(); return issue ? <Text accessibilityRole="alert" style={ui.error}>{t(`${i18n.exists(`flows.${issue}`) ? "flows" : "purchase"}.${issue}`)}</Text> : null; }
export function SearchBox({ label, value, onChangeText }: { label: string; value: string; onChangeText: (text: string) => void }) {
  const { colors, isDark } = useTheme(); const { t } = useTranslation();
  return <View style={{ flexDirection: "row", gap: 8, alignItems: "center", minHeight: 46, paddingLeft: 12, backgroundColor: colors.elevated, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}><Search size={18} color={colors.muted} /><TextInput accessibilityLabel={label} placeholder={label} placeholderTextColor={colors.muted} value={value} onChangeText={onChangeText} autoCorrect={false} keyboardAppearance={isDark ? "dark" : "light"} style={{ flex: 1, minWidth: 0, minHeight: 46, fontSize: 12, color: colors.text }} />{!!value && <Pressable accessibilityRole="button" accessibilityLabel={t("pos.clearSearch")} onPress={() => onChangeText("")} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><X size={16} color={colors.muted} /></Pressable>}</View>;
}
export function Choice({ label, selected, onPress, disabled = false, icon }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean; icon?: ReactNode }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: 44, flexDirection: "row", gap: 7, justifyContent: "center", alignItems: "center", paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, backgroundColor: selected ? colors.primary : colors.elevated, borderWidth: 1, borderColor: selected ? colors.primary : colors.border }}>{icon}<Text style={{ color: selected ? colors.onPrimary : colors.text, fontSize: 13, lineHeight: 22 }}>{label}</Text></Pressable>;
}
export function SupplierInfo({ supplier, right, compact = false }: { compact?: boolean; supplier: Pick<Supplier, "name" | "phone" | "address">; right?: ReactNode }) {
  const { colors } = useTheme(); const ui = useUi();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}><Store color={colors.primary} size={25} /></View><View style={{ flex: 1, gap: 3 }}><Text style={[ui.subtitle, compact && { fontSize: 13, lineHeight: 20 }]}>{supplier.name}</Text>{!!supplier.phone && <Text style={[ui.text, { fontSize: compact ? 10 : 12, lineHeight: compact ? 17 : 25 }]}>{supplier.phone}</Text>}{!!supplier.address && <Text style={[ui.text, { fontSize: compact ? 10 : 12, lineHeight: compact ? 17 : 25 }]}>{supplier.address}</Text>}</View>{right}</View>;
}
