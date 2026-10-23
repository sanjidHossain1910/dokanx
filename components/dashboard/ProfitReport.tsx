import DateTimeField from "@/components/ui/DateTimeField";
import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ReceiptText, ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBusiness } from "@/src/store/BusinessProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import { historyRange } from "@/src/store/salesHistory";
import { formatBusinessDate } from "@/src/store/businessSettings";
import { formatMoney } from "@/src/dashboard/format";
import { selectProfitHistory } from "@/src/dashboard/profitReport";
import { useDeviceTime } from "@/src/dashboard/useDeviceTime";
import { useUi } from "@/components/business/Screen";
import { POSFrame, SummaryRow } from "@/components/pos/Shared";

export default function ProfitReport() {
  const { data } = useBusiness(); const { colors, isDark } = useTheme(); const { t, i18n } = useTranslation(); const ui = useUi(); const insets = useSafeAreaInsets();
  const now = useDeviceTime();
  const params = useLocalSearchParams<{ period?: string }>();
  const [period, setPeriod] = useState(params.period === "all" ? "all" : "today"), [from, setFrom] = useState(""), [to, setTo] = useState(""), [search, setSearch] = useState("");
  const range = useMemo(() => historyRange(period, now, from, to), [period, now, from, to]);
  const history = useMemo(() => selectProfitHistory(data, range), [data, range]);
  const query = search.trim().toLocaleLowerCase(i18n.language);
  const rows = history.filter((r) => `${r.title} ${r.customerName} ${r.names.join(" ")}`.toLocaleLowerCase(i18n.language).includes(query));
  const money = (n: number) => formatMoney(n, i18n.language);
  return <POSFrame title={t("profit.history")} subtitle={t("profit.historyHint")} scroll={false}>
    <FlatList data={rows} keyExtractor={(r) => r.key} initialNumToRender={15} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 12 }}
      ListHeaderComponent={<View style={{ gap: 14, marginBottom: 8 }}>
        <TextInput accessibilityLabel={t("profit.searchSales")} placeholder={t("profit.searchSales")} placeholderTextColor={colors.muted} keyboardAppearance={isDark ? "dark" : "light"} style={ui.input} value={search} onChangeText={setSearch} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{["today", "week", "month", "all", "customDate"].map((id) => <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: id === period }} onPress={() => setPeriod(id)} style={{ padding: 12, minHeight: 44, borderRadius: 12, backgroundColor: period === id ? colors.primary : colors.card, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: period === id ? colors.onPrimary : colors.muted }}>{t(id === "all" ? "dashboard.allTime" : `pos.${id}`)}</Text></Pressable>)}</ScrollView>
        {period === "customDate" && <><DateTimeField label={t("pos.from")} value={from} onChange={setFrom} /><DateTimeField label={t("pos.to")} value={to} onChange={setTo} />{!range && <Text accessibilityRole="alert" style={ui.error}>{t("pos.invalidDates")}</Text>}</>}
      </View>}
      ListEmptyComponent={<Text style={{ ...ui.text, paddingVertical: 40, textAlign: "center" }}>{t("pos.noSales")}</Text>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}, ${t("profit.sale")}`} style={ui.card} onPress={() => router.push({ pathname: "/business/sale-profit", params: { saleId: item.saleId } })}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}><ReceiptText size={24} color={colors.primary} /><Text style={{ ...ui.subtitle, flex: 1 }} numberOfLines={2}>{item.title}</Text><ChevronRight size={18} color={colors.muted} /></View>
        <Text style={ui.text}>{item.customerName || t("pos.walkIn")}</Text><Text numberOfLines={2} style={ui.text}>{item.names.join(", ")}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 21 }}>{formatBusinessDate(item.createdAt, i18n.language, data.businessSettings)}</Text>
        <SummaryRow label={t("profit.total")} value={money(item.total)} />
        <View style={{ flexDirection: "row", gap: 12, justifyContent: "space-between", alignItems: "center", paddingVertical: 8 }}><Text style={ui.subtitle}>{t("profit.totalProfit")}</Text><Text style={{ color: item.profit < 0 ? colors.danger : colors.success, fontSize: 20, fontWeight: "700", flexShrink: 1 }}>{money(item.profit)}</Text></View>
        {item.returnedTotal > 0 && <Text style={ui.text}>{t("profit.returned")}: {money(item.returnedTotal)}</Text>}
      </Pressable>} />
  </POSFrame>;
}
