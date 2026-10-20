import type { Product } from "@/src/store/business";
import { stockStatus } from "@/src/store/inventory";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

export default function StockBadge({ product }: { product: Product }) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const status = stockStatus(product);
  const color = status === "in" ? isDark ? colors.success : "#15803D" : status === "low" ? isDark ? colors.warning : "#92400E" : isDark ? colors.danger : "#B91C1C";
  return <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 5, backgroundColor: status === "in" ? colors.successSoft : status === "low" ? colors.warningSoft : colors.dangerSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} /><Text style={{ fontSize: 11, lineHeight: 18, fontWeight: "600", color }}>{t(`inventory.${status === "in" ? "inStock" : status === "low" ? "lowStock" : "outOfStock"}`)}</Text></View>;
}
