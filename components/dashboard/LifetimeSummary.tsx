import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useAmountVisibility } from "@/src/dashboard/useAmountVisibility";
import { formatMoney, localeFor } from "@/src/dashboard/format";
import type { selectLifetimeSummary } from "@/src/dashboard/lifetimeSummary";
import AmountVisibilityButton from "./AmountVisibilityButton";

export default function LifetimeSummary({ totals }: { totals: ReturnType<typeof selectLifetimeSummary> }) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const { visible, toggle } = useAmountVisibility();
  const [expanded, setExpanded] = useState(false);
  const amount = (value: number) => visible ? formatMoney(value, i18n.language) : "••••••";
  const percent = totals.margin === null ? "—" : new Intl.NumberFormat(localeFor(i18n.language), { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(totals.margin) + "%";
  const margin = totals.margin === null ? 0 : Math.min(100, Math.max(0, totals.margin));
  const valueStyle = { color: colors.text, fontSize: 19, fontWeight: "700" as const, fontVariant: ["tabular-nums" as const], flexShrink: 1 };
  const mutedStyle = { color: colors.muted, fontSize: 12, lineHeight: 21 };
  const rowStyle = { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 12 };
  const allSales = () => router.push({ pathname: "/(tabs)/sales/history", params: { period: "all" } });
  return <View style={{ gap: 10 }}>
    <View style={rowStyle}><Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>{t("dashboard.businessSummary")}</Text><Text style={mutedStyle}>{t("dashboard.allTime")}</Text></View>
    <View style={{ backgroundColor: colors.primarySoft, borderRadius: 20, padding: 18, gap: 12 }}>
      <View style={rowStyle}><Text style={{ ...mutedStyle, flex: 1 }}>{t("dashboard.salesSinceStart")}</Text><AmountVisibilityButton visible={visible} toggle={toggle} label={t("dashboard.businessSummary")} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={t("dashboard.totalSales")} accessibilityHint={t("dashboard.viewAll")} onPress={allSales} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ ...valueStyle, fontSize: 30 }}>{amount(totals.sales)}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t("dashboard.totalProfit")} onPress={() => router.push({ pathname: "/business/profit", params: { period: "all" } })} style={{ ...rowStyle, minHeight: 44 }}><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 14 }}>{t("dashboard.totalProfit")}</Text><Text style={mutedStyle}>{t("dashboard.netProfitHint")}</Text></View><Text style={{ ...valueStyle, color: colors.success }}>{amount(totals.profit)}</Text></Pressable>
      <View style={{ gap: 8 }}>
        <View style={rowStyle}><Text style={mutedStyle}>{t("dashboard.netMargin")}</Text><Text style={{ color: colors.success, fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{visible ? percent : "—"}</Text></View>
        <View accessible accessibilityLabel={visible ? t("dashboard.marginDescription", { value: percent }) : t("dashboard.amountHidden")} style={{ height: 7, borderRadius: 7, overflow: "hidden", flexDirection: "row", backgroundColor: colors.border }}>
          {visible && totals.margin !== null && <><View style={{ flex: 1, backgroundColor: colors.orange, opacity: 0.65 }} /><View style={{ width: `${margin}%`, backgroundColor: colors.success }} /></>}
        </View>
        {visible && totals.margin !== null && <View style={{ ...rowStyle, justifyContent: "flex-start", flexWrap: "wrap", gap: 14 }}><Text style={mutedStyle}><Text style={{ color: colors.orange }}>● </Text>{t("dashboard.costsShare")}</Text><Text style={mutedStyle}><Text style={{ color: colors.success }}>● </Text>{t("dashboard.profit")}</Text></View>}
      </View>
      <View style={{ flexDirection: "row", gap: 14, paddingTop: 6 }}>
        <View style={{ flex: 1, gap: 4 }}><Text style={mutedStyle}>{t("dashboard.totalReceived")}</Text><Text style={valueStyle}>{amount(totals.received)}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={t("dashboard.totalDue")} onPress={() => router.push("/business/collections")} style={{ flex: 1, gap: 4, minHeight: 44 }}><Text style={mutedStyle}>{t("dashboard.totalDue")}</Text><Text style={{ ...valueStyle, color: colors.success }}>{amount(totals.due)}</Text></Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ ...rowStyle, minHeight: 44, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}><Text style={{ color: colors.primary, fontSize: 14, flex: 1 }}>{t(expanded ? "dashboard.closeBreakdown" : "dashboard.openBreakdown")}</Text>{expanded ? <ChevronUp size={18} color={colors.primary} /> : <ChevronDown size={18} color={colors.primary} />}</Pressable>
      {expanded && <View style={{ gap: 12 }}>
        <View style={rowStyle}><Text style={mutedStyle}>{t("dashboard.cashReceived")}</Text><Text style={valueStyle}>{amount(totals.cash)}</Text></View>
        <View style={rowStyle}><View style={{ flex: 1 }}><Text style={mutedStyle}>{t("dashboard.digitalReceived")}</Text><Text style={mutedStyle}>{t("dashboard.digitalHint")}</Text></View><Text style={valueStyle}>{amount(totals.digital)}</Text></View>
        <Text style={mutedStyle}>{t("dashboard.receiptsNote")}</Text>
        <Text style={mutedStyle}>{t("dashboard.marginNote")}</Text>
        {totals.untrackedSales > 0 && <Text style={mutedStyle}>{t("dashboard.legacyReceiptsNote")}</Text>}
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/(tabs)/sales/history", params: { period: "all", payment: "outstanding" } })} style={{ ...rowStyle, minHeight: 44 }}><Text style={{ color: colors.primary, fontSize: 14, flex: 1 }}>{t("dashboard.dueSales")}</Text><ChevronRight size={18} color={colors.primary} /></Pressable>
      </View>}
    </View>
  </View>;
}
