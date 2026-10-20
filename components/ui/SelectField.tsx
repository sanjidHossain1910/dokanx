import { useTheme } from "@/src/theme/ThemeProvider";
import { Check, ChevronDown, X } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Props { label: string; value: string; options: readonly { id: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean }
export default function SelectField({ label, value, options, onChange, disabled }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 8 }}>
    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, expanded: open }} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onPress={() => setOpen(true)}
      style={{ minHeight: 54, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 10, opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ flex: 1, color: colors.text, fontSize: 16 }}>{options.find((option) => option.id === value)?.label ?? "—"}</Text>
      <ChevronDown size={20} color={colors.muted} />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 20 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("business.cancel")} onPress={() => setOpen(false)} style={{ position: "absolute", top: 0, right: 0, left: 0, bottom: 0 }} />
        <SafeAreaView style={{ width: "100%", maxWidth: 560, maxHeight: "80%", alignSelf: "center", borderRadius: 20, backgroundColor: colors.card, overflow: "hidden" }}>
          <View style={{ paddingLeft: 20, paddingRight: 8, paddingVertical: 10, flexDirection: "row", alignItems: "center" }}>
            <Text accessibilityRole="header" style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: "700" }}>{label}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t("business.cancel")} onPress={() => setOpen(false)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><X size={22} color={colors.text} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 10 }}>
            <View accessibilityRole="radiogroup" accessibilityLabel={label}>{options.map((option) => <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: value === option.id }} aria-checked={value === option.id}
              onPress={() => { onChange(option.id); setOpen(false); }} style={{ minHeight: 52, borderRadius: 10, padding: 14, flexDirection: "row", alignItems: "center", backgroundColor: value === option.id ? colors.primarySoft : "transparent" }}>
              <Text style={{ flex: 1, color: colors.text, fontSize: 16 }}>{option.label}</Text>{value === option.id && <Check size={20} color={colors.primary} />}
            </Pressable>)}</View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  </View>;
}
