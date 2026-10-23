import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { TopSellingProduct } from "@/src/dashboard/topSellingProducts";
import { formatMoney, formatNumber } from "@/src/dashboard/format";
import { unitLabel } from "@/src/store/productUnits";
import { useTheme } from "@/src/theme/ThemeProvider";
import { ProductPhoto } from "@/components/pos/Shared";

export default function BestSellerRow({ item, rank }: { item: TopSellingProduct; rank: number }) {
  const { colors } = useTheme(); const { t, i18n } = useTranslation(); const { product } = item;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${formatNumber(rank, i18n.language)}. ${product.name}, ${t("dashboard.soldInSales", { count: item.saleCount, quantity: formatNumber(item.saleCount, i18n.language) })}`} onPress={() => router.push({ pathname: "/inventory/product", params: { productId: product.id } })} style={({ pressed }) => ({ flexDirection: "row", gap: 12, alignItems: "center", padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.elevated : colors.card, minHeight: 84 })}>
    <View style={{ position: "relative" }}><ProductPhoto uri={product.photoUri} name={product.name} size={58} /><View style={{ position: "absolute", top: -5, left: -5, minWidth: 23, height: 23, paddingHorizontal: 4, borderRadius: 12, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" }}><Text style={{ color: colors.onPrimary, fontSize: 11, fontWeight: "700" }}>{formatNumber(rank, i18n.language)}</Text></View></View>
    <View style={{ flex: 1, minWidth: 0, gap: 3 }}><Text numberOfLines={2} style={{ color: colors.text, fontSize: 14, fontWeight: "600", lineHeight: 22 }}>{product.name}</Text><Text style={{ color: colors.muted, fontSize: 12, lineHeight: 20 }}>{t("dashboard.soldInSales", { count: item.saleCount, quantity: formatNumber(item.saleCount, i18n.language) })}</Text><Text style={{ color: colors.primary, fontSize: 13, lineHeight: 21, fontWeight: "600" }}>{formatMoney(product.price, i18n.language)} / {unitLabel(product.unit, i18n.language)}</Text></View><ChevronRight size={18} color={colors.muted} />
  </Pressable>;
}
