import { useBusiness } from "@/src/store/BusinessProvider";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Button, money, Screen, useUi } from "./Screen";
import { activeProducts, stockStatus } from "@/src/store/inventory";
import { unitLabel } from "@/src/store/productUnits";
import { useAmountVisibility } from "@/src/dashboard/useAmountVisibility";
import AmountVisibilityButton from "@/components/dashboard/AmountVisibilityButton";

function PrivateMetric({ label, value }: { label: string; value: string }) {
  const { visible, toggle } = useAmountVisibility();
  const { t } = useTranslation();
  const ui = useUi();
  return <View style={ui.card}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><Text style={[ui.text, { flex: 1 }]}>{label}</Text><AmountVisibilityButton visible={visible} toggle={toggle} label={label} /></View><Text accessibilityLabel={visible ? undefined : t("dashboard.amountHidden")} style={ui.title}>{visible ? value : "••••••"}</Text></View>;
}

export default function Dashboard({ reports = false }: { reports?: boolean }) {
  const ui = useUi();
  const { data } = useBusiness();
  const { t, i18n } = useTranslation();
  const products = activeProducts(data);
  const revenue = data.sales.reduce((sum, sale) => sum + sale.total, 0) - (data.saleReturns ?? []).reduce((n, r) => n + r.total, 0);
  const cost = data.sales.reduce((sum, sale) => sum + sale.cost + (sale.tax ?? 0), 0) - (data.saleReturns ?? []).flatMap((r) => r.items).reduce((n, r) => n + r.tax + (r.restock ? r.cost : 0), 0) + (data.expenses ?? []).reduce((n, e) => n + e.total, 0);
  const metrics = [[t("business.products"), String(products.length)], [t("business.revenue"), money(revenue)], [t("business.profit"), money(revenue - cost)], [t("business.inventoryValue"), money(products.reduce((sum, item) => sum + item.cost * item.stock, 0))]];
  return <Screen title={reports ? t("business.reports") : data.shopName}>
    <Button secondary title={t("flows.cashDay")} onPress={() => router.push("/business/cash-day")} />
    <Text style={ui.text}>{t("business.local")}</Text>
    {metrics.map(([label, value], index) => index === 0 ? <View key={label} style={ui.card}><Text style={ui.text}>{label}</Text><Text style={ui.title}>{value}</Text></View> : <PrivateMetric key={label} label={label} value={value} />)}
    {!reports && <View style={ui.row}><Button title={t("business.addProduct")} onPress={() => router.push("/inventory/add-product")} /><Button title={t("business.newSale")} onPress={() => router.push("/(tabs)/sales")} /></View>}
    <Text style={ui.subtitle}>{t("inventory.lowStock")}</Text>
    {products.filter((p) => stockStatus(p) !== "in").map((p) => <View key={p.id} style={ui.card}><Text style={ui.subtitle}>{p.name}</Text><Text style={ui.text}>{t("business.stock")}: {p.stock.toLocaleString(i18n.language)} {unitLabel(p.unit, i18n.language)}</Text></View>)}
    {products.length === 0 && <Text style={ui.text}>{t("business.emptyProducts")}</Text>}
  </Screen>;
}
