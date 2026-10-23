import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useBusiness } from "@/src/store/BusinessProvider";
import { unitLabel } from "@/src/store/productUnits";
import { formatBusinessDate } from "@/src/store/businessSettings";
import { formatMoney, formatNumber } from "@/src/dashboard/format";
import { profitMargin, type ProfitEvent } from "@/src/dashboard/profitReport";
import { useUi } from "@/components/business/Screen";
import { ProductPhoto, SummaryRow } from "@/components/pos/Shared";

export default function ProfitLine({ event }: { event: ProfitEvent }) {
  const { data } = useBusiness(); const { t, i18n } = useTranslation(); const ui = useUi();
  const money = (n: number) => formatMoney(n, i18n.language);
  const margin = profitMargin(event.profit, event.revenue);
  return <View style={ui.card}>
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}><ProductPhoto uri={event.photoUri} name={event.name} /><View style={{ flex: 1, gap: 4 }}><Text style={ui.subtitle}>{event.name}</Text><Text style={ui.text}>{formatBusinessDate(event.createdAt, i18n.language, data.businessSettings)}</Text>{event.returned && <Text style={ui.error}>{t("profit.returned")}</Text>}</View></View>
    <SummaryRow label={t("profit.quantity")} value={`${formatNumber(event.quantity, i18n.language)} ${unitLabel(event.unit, i18n.language)}`} />
    <SummaryRow label={t("profit.price")} value={money(event.unitPrice)} />
    <SummaryRow label={t("profit.buyPrice")} value={money(event.unitCost)} />
    {!event.returned && <SummaryRow label={t("profit.discount")} value={money(event.discount)} />}
    <SummaryRow label={t("profit.tax")} value={money(event.tax)} />
    <SummaryRow label={t("profit.total")} value={money(event.revenue + event.tax)} />
    <SummaryRow label={t("profit.cost")} value={money(event.cost)} />
    <SummaryRow label={t("profit.profit")} value={money(event.profit)} strong />
    <SummaryRow label={t("profit.margin")} value={margin === null ? "—" : `${formatNumber(Math.round(margin * 100) / 100, i18n.language)}%`} />
  </View>;
}
