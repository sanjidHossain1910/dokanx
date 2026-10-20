import Header from "@/components/ui/Header";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import InventorySheet from "@/components/business/InventorySheet";
import { Button, useUi } from "@/components/business/Screen";
import { useBusiness } from "@/src/store/BusinessProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Package, Trash2 } from "lucide-react-native";
import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export function POSFrame({ title, subtitle, back = true, right, children, footer, scroll = true, hideHeader = false }: { title: string; subtitle?: string; back?: boolean; right?: ReactNode; children: ReactNode; footer?: ReactNode; scroll?: boolean; hideHeader?: boolean }) {
  const { colors } = useTheme();
  const { ready, error, retry } = useBusiness();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const showFooter = footer && !keyboardVisible;
  return <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}>
    {hideHeader ? null : back ? <Header title={title} description={subtitle} rightSection={right} fallbackHref="/(tabs)/sales" /> : <View className="flex-row items-center px-5 pt-4 pb-3" style={{ gap: 12 }}><View style={{ flex: 1 }}><Text accessibilityRole="header" style={{ color: colors.text, fontSize: 26, lineHeight: 38, fontWeight: "700" }}>{title}</Text><Text style={{ color: colors.muted, fontSize: 14, lineHeight: 23 }}>{subtitle}</Text></View>{right}</View>}
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {error ? <View style={{ padding: 24, gap: 16 }}><Text style={{ color: colors.danger }}>{t("business.storageUnavailable")}</Text><Button title={t("business.retry")} onPress={retry} /></View> : !ready ? <ActivityIndicator color={colors.primary} /> : scroll ? <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + (showFooter ? 220 : keyboardVisible ? 24 : 125), gap: 16, width: "100%", maxWidth: 720, alignSelf: "center" }}>{children}</ScrollView> : children}
      {showFooter && ready && !error && <View style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 100, backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: 20, paddingVertical: 12 }}><View style={{ maxWidth: 680, width: "100%", alignSelf: "center" }}>{footer}</View></View>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export function ProductPhoto({ uri, size = 64, name }: { uri?: string; size?: number; name: string }) {
  const { colors } = useTheme();
  return <View style={{ width: size, height: size, borderRadius: 12, backgroundColor: colors.elevated, overflow: "hidden", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{uri ? <Image source={{ uri }} accessibilityLabel={name} contentFit="cover" style={{ width: size, height: size }} /> : <Package size={size * 0.45} color={colors.muted} />}</View>;
}
export function SummaryRow({ label, value, strong = false, positive = false }: { label: string; value: string; strong?: boolean; positive?: boolean }) {
  const { colors } = useTheme();
  return <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 8 }}><Text style={{ color: strong ? colors.text : colors.muted, fontSize: strong ? 17 : 14, lineHeight: 25, flexShrink: 1, fontWeight: strong ? "700" : "400" }}>{label}</Text><Text style={{ color: positive ? colors.success : strong ? colors.primary : colors.text, fontSize: strong ? 22 : 15, lineHeight: 30, fontWeight: strong ? "700" : "600", flexShrink: 1, textAlign: "right" }}>{value}</Text></View>;
}
export function POSIssue({ issue }: { issue?: string }) {
  const { t, i18n } = useTranslation();
  const ui = useUi();
  return issue ? <Text accessibilityRole="alert" style={ui.error}>{t(`${i18n.exists(`flows.${issue}`) ? "flows" : "pos"}.${issue}`)}</Text> : null;
}
export function ClearCartButton() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { data, update } = useBusiness();
  const ui = useUi();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  return <><Pressable accessibilityRole="button" accessibilityLabel={t("pos.clearCart")} disabled={!data.saleDraft?.lines.length} onPress={() => setOpen(true)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: data.saleDraft?.lines.length ? 1 : 0.4 }}><Trash2 size={23} color={colors.text} /></Pressable>
    {open && <InventorySheet title={t("pos.clearTitle")} busy={busy} onClose={() => setOpen(false)}><Text style={ui.text}>{t("pos.clearHint")}</Text>{error && <Text style={ui.error}>{t("business.saveFailed")}</Text>}<Button title={t("pos.clearCart")} disabled={busy} onPress={() => {
      if (lock.current) return; lock.current = true; setBusy(true); setError(false);
      void update((current) => ({ ...current, saleDraft: undefined })).then(() => { setOpen(false); router.dismissTo("/(tabs)/sales"); }).catch(() => setError(true)).finally(() => { lock.current = false; setBusy(false); });
    }} /><Button secondary title={t("pos.cancel")} disabled={busy} onPress={() => setOpen(false)} /></InventorySheet>}
  </>;
}
