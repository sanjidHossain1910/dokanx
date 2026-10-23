import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/src/theme/ThemeProvider";
import type { PriceType } from "@/src/store/productPricing";
import type { UnitId } from "@/src/store/productUnits";
import { unitLabel } from "@/src/store/productUnits";
import { money } from "@/components/business/Screen";
export default function PriceSelector({ value, retailPrice, wholesalePrice, unit, disabled, onChange }: { value: PriceType; retailPrice: number; wholesalePrice: number; unit?: UnitId; disabled?: boolean; onChange: (value: PriceType) => void }) {
  const { colors } = useTheme(); const { t, i18n } = useTranslation();
  return <View accessibilityRole="radiogroup" accessibilityLabel={`${t("selling.retail")} / ${t("selling.wholesale")}`} style={{ flexDirection: "row", gap: 8 }}>{(["retail", "wholesale"] as const).map((type) => <Pressable key={type} accessibilityRole="radio" accessibilityState={{ checked: value === type, disabled }} disabled={disabled} onPress={() => onChange(type)} style={{ flex: 1, padding: 10, minHeight: 58, borderRadius: 12, borderWidth: 1, borderColor: value === type ? colors.primary : colors.border, backgroundColor: value === type ? colors.primary : colors.elevated, gap: 4, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.5 : 1 }}><Text style={{ color: value === type ? colors.onPrimary : colors.text, fontSize: 13, lineHeight: 21 }}>{t(`selling.${type}`)}</Text><Text style={{ color: value === type ? colors.onPrimary : colors.text, fontWeight: "600", fontSize: 13, lineHeight: 21 }}>{money(type === "retail" ? retailPrice : wholesalePrice)} / {unitLabel(unit, i18n.language)}</Text></Pressable>)}</View>;
}
