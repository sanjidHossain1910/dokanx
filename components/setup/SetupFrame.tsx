import Header from "@/components/ui/Header";
import { useTheme } from "@/src/theme/ThemeProvider";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function SetupFrame({ title, children, footer, right, onBack }: { title?: string; children: ReactNode; footer: ReactNode; right?: ReactNode; onBack?: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}>
    {title && <Header title={title} onBack={onBack} fallbackHref="/setup" rightSection={right} />}
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 20, maxWidth: 540, width: "100%", alignSelf: "center" }}>{children}</ScrollView>
      <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: insets.bottom + 20, width: "100%", maxWidth: 540, alignSelf: "center", gap: 10 }}>{footer}</View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
