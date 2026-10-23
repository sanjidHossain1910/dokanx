import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useBusiness } from "@/src/store/BusinessProvider";
import type { Href } from "expo-router";
import Header from "@/components/ui/Header";
import { useMemo, type ReactNode } from "react";
import { useTheme } from "@/src/theme/ThemeProvider";
import { formatMoney } from "@/src/dashboard/format";
import { i18n } from "@/src/i18n";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export function useUi() {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
  title: { fontSize: 28, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  text: { fontSize: 15, color: colors.muted, lineHeight: 25 },
  card: { backgroundColor: colors.card, padding: 18, borderRadius: 16, gap: 10, borderWidth: 1, borderColor: colors.border, color: colors.text },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, color: colors.text, backgroundColor: colors.card, fontSize: 16 },
  error: { color: colors.danger, fontSize: 15, lineHeight: 24 },
}), [colors]);
}

export function Button({ title, onPress, disabled = false, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} aria-disabled={disabled} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ backgroundColor: secondary ? colors.elevated : colors.primary, padding: 14, borderRadius: 10, minHeight: 48, opacity: disabled ? 0.45 : pressed ? 0.7 : 1 })}>
    <Text style={{ color: secondary ? colors.text : colors.onPrimary, fontSize: 15, lineHeight: 24, textAlign: "center", fontWeight: "600" }}>{title}</Text>
  </Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const ui = useUi();
  const { colors, isDark } = useTheme();
  return <View style={{ gap: 6 }}><Text style={ui.subtitle}>{label}</Text><TextInput accessibilityLabel={label} style={ui.input} placeholderTextColor={colors.muted} selectionColor={colors.primary} keyboardAppearance={isDark ? "dark" : "light"} {...props} /></View>;
}
interface ScreenProps {
  title: string;
  children: ReactNode;
  back?: boolean;
  description?: string;
  rightSection?: ReactNode;
  onBack?: () => void;
  fallbackHref?: Href;
  footer?: ReactNode;
}
export function Screen({ title, children, back = false, description, rightSection, onBack, fallbackHref, footer }: ScreenProps) {
  const { ready, error, retry } = useBusiness();
  const { t } = useTranslation();
  const ui = useUi();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { formMaxWidth, gutter } = useResponsiveLayout();
  return <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}>
    {back && <Header title={title} description={description} rightSection={rightSection} onBack={onBack} fallbackHref={fallbackHref} />}
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: gutter, paddingBottom: footer ? 24 : insets.bottom + (back ? 40 : 118), gap: 16, maxWidth: formMaxWidth, width: "100%", alignSelf: "center" }}>
      {!back && <Text style={ui.title}>{title}</Text>}
      {error ? <><Text style={ui.error}>{t("business.storageUnavailable")}</Text><Button title={t("business.retry")} onPress={retry} /></> : !ready ? <ActivityIndicator color={colors.primary} accessibilityLabel={t("common.loading")} /> : children}
    </ScrollView>
    </KeyboardAvoidingView>
    {footer && <View style={{ borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: gutter, paddingTop: 14, paddingBottom: insets.bottom + 14 }}><View style={{ maxWidth: formMaxWidth - 40, width: "100%", alignSelf: "center" }}>{footer}</View></View>}
  </SafeAreaView>;
}
export function money(cents: number) { return formatMoney(cents, i18n.resolvedLanguage ?? "en"); }
