import { Button, money, Screen, useUi } from "@/components/business/Screen";
import ProductActions from "@/components/business/ProductActions";
import StockBadge from "@/components/business/StockBadge";
import SquareFrame from "@/components/ui/SquareFrame";
import { useBusiness } from "@/src/store/BusinessProvider";
import { unitLabel } from "@/src/store/productUnits";
import { formatNumber } from "@/src/dashboard/format";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { MoreHorizontal, Package } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

export default function ProductDetails() {
  const { productId, saved } = useLocalSearchParams<{ productId?: string; saved?: string }>();
  const { data } = useBusiness();
  const { colors } = useTheme();
  const ui = useUi();
  const { t, i18n } = useTranslation();
  const [menu, setMenu] = useState(false);
  const p = data.products.find((item) => item.id === productId && !item.deletedAt);
  if (!p) return <Screen back title={t("inventory.details")}><Text style={ui.text}>{t("inventory.missing")}</Text><Button title={t("inventory.returnProducts")} onPress={() => router.replace("/(tabs)/packege")} /></Screen>;
  const unit = unitLabel(p.unit, i18n.language);
  const fields = [
    ["stock", `${formatNumber(p.stock, i18n.language)} ${unit}`], ["category", p.category || t("business.none")], ["business.barcode", p.barcode || t("inventory.noBarcode")], ["unit", unit],
    ["purchasePrice", `${money(p.cost)} / ${unit}`], ["sellingPrice", `${money(p.price)} / ${unit}`], ["threshold", `${formatNumber(p.lowStockThreshold ?? 5, i18n.language)} ${unit}`],
    ...(p.wholesalePrice !== undefined ? [["selling.wholesale", `${money(p.wholesalePrice)} / ${unit}`]] : []),
  ];
  const movements = [...(data.stockMovements ?? [])].filter((m) => m.productId === p.id).reverse();
  return <Screen back title={t("inventory.details")} rightSection={<Pressable accessibilityRole="button" accessibilityLabel={t("inventory.options", { name: p.name })} onPress={() => setMenu(true)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><MoreHorizontal size={24} color={colors.text} /></Pressable>}
    footer={<View style={{ flexDirection: "row", gap: 12 }}><View style={{ flex: 1 }}><Button secondary title={t("inventory.edit")} onPress={() => router.push({ pathname: "/inventory/edit-product", params: { productId: p.id } })} /></View><View style={{ flex: 1 }}><Button title={t("inventory.updateStock")} onPress={() => router.push({ pathname: "/inventory/update-stock", params: { productId: p.id } })} /></View></View>}>
    {!!saved && <Text accessibilityLiveRegion="polite" style={{ color: colors.success, backgroundColor: colors.successSoft, padding: 14, borderRadius: 12 }}>{t(saved === "stock" ? "inventory.stockUpdated" : "inventory.saved")}</Text>}
    <View style={{ ...ui.card, gap: 16 }}>
      <SquareFrame style={{ borderRadius: 16, backgroundColor: colors.elevated, justifyContent: "center", alignItems: "center" }}>{p.photoUri ? <Image source={{ uri: p.photoUri }} contentFit="cover" accessibilityLabel={p.name} style={{ position: "absolute", inset: 0 }} /> : <><Package size={64} color={colors.muted} /><Text style={ui.text}>{t("inventory.noImage")}</Text></>}</SquareFrame>
      <View style={{ gap: 8 }}><Text style={{ color: colors.text, fontSize: 24, fontWeight: "700", lineHeight: 34 }}>{p.name}</Text><Text selectable style={{ color: colors.muted, fontSize: 12, lineHeight: 20 }}>{t("inventory.code")}: {p.id}</Text><StockBadge product={p} /></View>
      <Text style={{ color: colors.primary, fontSize: 28, lineHeight: 38, fontWeight: "700" }}>{money(p.price)}<Text style={{ color: colors.muted, fontSize: 15, fontWeight: "400" }}> / {unit}</Text></Text>
    </View>
    <View style={ui.card}>{fields.map(([key, value]) => <View key={key} style={{ paddingVertical: 10, flexDirection: "row", flexWrap: "wrap", gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}><Text style={{ ...ui.text, flexGrow: 1, flexBasis: "40%" }}>{t(key.includes(".") ? key : `inventory.${key}`)}</Text><Text selectable style={{ color: colors.text, fontSize: 15, lineHeight: 25, fontWeight: "600", flexShrink: 1 }}>{value}</Text></View>)}<Text style={ui.subtitle}>{t("inventory.description")}</Text><Text style={ui.text}>{p.description || t("inventory.noDescription")}</Text></View>
    <Button secondary title={t("flows.expiry")} onPress={() => router.push({ pathname: "/inventory/expiry", params: { productId: p.id } })} />
    <Button secondary title={t("inventory.sale")} disabled={p.stock === 0} onPress={() => router.push({ pathname: "/(tabs)/sales", params: { productId: p.id } })} />
    <View style={ui.card}><Text style={ui.subtitle}>{t("inventory.history")}</Text>{!movements.length && <Text style={ui.text}>{t("inventory.noHistory")}</Text>}{movements.map((m) => <View key={m.id} style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 12, gap: 4 }}><Text style={ui.subtitle}>{t(`inventory.${m.kind === "add" ? "addStock" : m.kind === "remove" ? "removeStock" : "setStock"}`)}</Text><Text style={ui.text}>{t("inventory.beforeAfter", { before: formatNumber(m.before, i18n.language), after: formatNumber(m.after, i18n.language), unit: unitLabel(m.unit, i18n.language) })}</Text>{!!m.reason && <Text style={ui.text}>{m.stockCountId ? `${t("stockCount.title")} · ${t(`stockCount.${m.reason.slice(11)}`)}` : m.reason}</Text>}{!!m.notes && <Text style={ui.text}>{m.notes}</Text>}<Text style={ui.text}>{new Date(m.createdAt).toLocaleString(i18n.language)}</Text></View>)}</View>
    {menu && <ProductActions product={p} onClose={() => setMenu(false)} onDeleted={() => router.dismissTo("/(tabs)/packege")} />}
  </Screen>;
}
