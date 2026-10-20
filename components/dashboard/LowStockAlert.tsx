import { formatNumber } from "@/src/dashboard/format";
import type { Product } from "@/src/store/business";
import { useTheme } from "@/src/theme/ThemeProvider";
import { router } from "expo-router";
import { AlertTriangle, ArrowUpRight, PackageCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { unitLabel } from "@/src/store/productUnits";

interface LowStockAlertProps { products: Product[] }
export default function LowStockAlert({ products }: LowStockAlertProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  if (!products.length) return <View className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-4"><PackageCheck size={27} color={colors.success} /><View className="flex-1"><Text className="text-sm font-semibold text-ink" style={{ lineHeight: 24 }}>{t("dashboard.noAlerts")}</Text><Text className="text-xs text-muted" style={{ lineHeight: 21 }}>{t("dashboard.noAlertsBody")}</Text></View></View>;
  return <View className="overflow-hidden rounded-[20px] border border-line bg-surface">{products.slice(0, 3).map((product, index) => <Pressable key={product.id} accessibilityRole="button" accessibilityLabel={t("dashboard.stockNotice", { name: product.name, quantity: `${formatNumber(product.stock, i18n.language)} ${unitLabel(product.unit, i18n.language)}` })} onPress={() => router.push({ pathname: "/business/purchases", params: { productId: product.id } })} className="flex-row items-center gap-3 p-4" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, borderTopWidth: index ? 1 : 0, borderColor: colors.border })}>
    <View style={{ backgroundColor: product.stock ? colors.warningSoft : colors.dangerSoft, width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center" }}><AlertTriangle size={18} color={product.stock ? colors.warning : colors.danger} /></View>
    <View className="flex-1"><Text className="text-sm font-semibold text-ink" style={{ lineHeight: 24 }}>{product.name}</Text><Text className="text-xs text-muted" style={{ lineHeight: 21 }}>{t(product.stock ? "dashboard.lowStock" : "dashboard.outOfStock")} · {t("dashboard.remaining", { quantity: `${formatNumber(product.stock, i18n.language)} ${unitLabel(product.unit, i18n.language)}` })}</Text></View><ArrowUpRight size={18} color={colors.muted} />
  </Pressable>)}</View>;
}
