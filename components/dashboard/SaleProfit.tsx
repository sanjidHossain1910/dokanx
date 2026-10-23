import { FlatList, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusiness } from "@/src/store/BusinessProvider";
import { profitMargin, selectSaleProfit } from "@/src/dashboard/profitReport";
import { formatMoney, formatNumber } from "@/src/dashboard/format";
import { formatBusinessDate } from "@/src/store/businessSettings";
import { Button, useUi } from "@/components/business/Screen";
import { POSFrame, SummaryRow } from "@/components/pos/Shared";
import ProfitLine from "./ProfitLine";

export default function SaleProfit() {
  const { saleId } = useLocalSearchParams<{ saleId: string }>(); const { data } = useBusiness(); const { t, i18n } = useTranslation(); const ui = useUi(); const insets = useSafeAreaInsets();
  const sale = data.sales.find((s) => s.id === saleId);
  const invoice = sale?.invoiceId ? data.invoices?.find((i) => i.id === sale.invoiceId) : undefined;
  const rows = selectSaleProfit(data, saleId).events;
  const revenue = rows.reduce((n, e) => n + e.revenue, 0), cost = rows.reduce((n, e) => n + e.cost, 0), profit = revenue - cost;
  const margin = profitMargin(profit, revenue), money = (n: number) => formatMoney(n, i18n.language);
  return <POSFrame title={t("profit.sale")} subtitle={t("profit.original")} scroll={false}>
    <FlatList data={rows} keyExtractor={(e) => e.id} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 16 }} ListEmptyComponent={<Text style={ui.text}>{t("profit.notFound")}</Text>}
      ListHeaderComponent={sale ? <View style={{ ...ui.card, marginBottom: 16 }}><Text selectable style={ui.subtitle}>{invoice?.invoiceNumber ?? sale.id}</Text><Text style={ui.text}>{invoice?.customerName || t("pos.walkIn")}</Text><Text style={ui.text}>{formatBusinessDate(sale.createdAt, i18n.language, data.businessSettings)}</Text><SummaryRow label={t("profit.total")} value={money(rows.reduce((n, e) => n + e.revenue + e.tax, 0))} /><SummaryRow label={t("profit.cost")} value={money(cost)} /><SummaryRow label={t("profit.totalProfit")} value={money(profit)} strong /><SummaryRow label={t("profit.margin")} value={margin === null ? "—" : `${formatNumber(Math.round(margin * 100) / 100, i18n.language)}%`} /><Button secondary title={t("profit.receipt")} onPress={() => router.push({ pathname: "/(tabs)/sales/receipt", params: invoice ? { saleId: invoice.id } : { legacyId: sale.id } })} /></View> : null}
      renderItem={({ item }) => <ProfitLine event={item} />} />
  </POSFrame>;
}
