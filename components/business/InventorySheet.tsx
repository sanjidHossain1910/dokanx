import { useTheme } from "@/src/theme/ThemeProvider";
import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function InventorySheet({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return <Modal visible transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay }}>
      <Pressable disabled={busy} accessibilityLabel={t("business.cancel")} accessibilityRole="button" onPress={onClose} style={{ position: "absolute", inset: 0 }} />
      <View style={{ maxHeight: "85%", width: "100%", maxWidth: 720, alignSelf: "center", backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 16 }}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 12 }} />
        <View className="flex-row items-center justify-between px-5 py-3"><Text accessibilityRole="header" style={{ flex: 1, color: colors.text, fontSize: 20, lineHeight: 30, fontWeight: "700" }}>{title}</Text><Pressable disabled={busy} onPress={onClose} accessibilityRole="button" accessibilityLabel={t("business.cancel")} style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }}><X size={22} color={colors.muted} /></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>{children}</ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
