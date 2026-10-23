import { money } from "@/components/business/Screen";
import { ProductPhoto } from "./Shared";
import type { CartLine } from "@/src/store/pos";
import { allowsFraction, lineAmount, unitLabel } from "@/src/store/productUnits";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Minus, Plus, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, TextInput, View } from "react-native";
import type { ReactNode } from "react";

export default function CartItem({ line: l, value, busy, onInput, onStep, onRemove, priceOptions }: { line: CartLine; value: string; busy: boolean; onInput: (value: string) => void; onStep: (quantity: number) => void; onRemove: () => void; priceOptions?: ReactNode }) {
  const { colors, isDark } = useTheme();
  const { t, i18n } = useTranslation();
  return <View style={{ padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 12 }}>
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}><ProductPhoto uri={l.photoUri} name={l.name} size={56} /><View style={{ flex: 1, minWidth: 0, gap: 5 }}><Text style={{ color: colors.text, fontWeight: "600", fontSize: 15, lineHeight: 23 }}>{l.name}</Text><Text style={{ color: colors.muted, fontSize: 12, lineHeight: 20 }}>{money(l.unitPrice)} / {unitLabel(l.unit, i18n.language)}</Text></View><Text style={{ maxWidth: 90, color: colors.text, fontSize: 15, lineHeight: 24, fontWeight: "700", textAlign: "right" }}>{money(lineAmount(l.unitPrice, l.quantity) ?? 0)}</Text></View>
    {priceOptions}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={t("pos.decrease", { name: l.name })} onPress={() => onStep(Math.max(0, Math.round((l.quantity - 1) * 1000) / 1000))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.primarySoft }}><Minus size={19} color={colors.primary} /></Pressable>
      <TextInput accessibilityLabel={`${l.name}: ${t("pos.quantity", { unit: unitLabel(l.unit, i18n.language) })}`} value={value} onChangeText={onInput} keyboardType={allowsFraction(l.unit) ? "decimal-pad" : "number-pad"} keyboardAppearance={isDark ? "dark" : "light"} style={{ flex: 1, minWidth: 40, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.elevated, textAlign: "center", paddingHorizontal: 4 }} />
      <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={t("pos.increase", { name: l.name })} onPress={() => onStep(Math.round((l.quantity + 1) * 1000) / 1000)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.primarySoft }}><Plus size={19} color={colors.primary} /></Pressable>
      <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={t("pos.remove", { name: l.name })} onPress={onRemove} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Trash2 size={19} color={colors.muted} /></Pressable>
    </View>
  </View>;
}
