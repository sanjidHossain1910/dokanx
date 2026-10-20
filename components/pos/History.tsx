import { invoiceDue } from "@/src/store/finance";
import { formatBusinessDate } from "@/src/store/businessSettings";
import { Field, money, useUi } from "@/components/business/Screen";
import { POSFrame } from "./Shared";
import { useBusiness } from "@/src/store/BusinessProvider";
import { historyRange } from "@/src/store/salesHistory";
import { useTheme } from "@/src/theme/ThemeProvider";
import { router } from "expo-router";
import { ReceiptText, Search } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SalesHistory() {
  const { data } = useBusiness();
  const { colors, isDark } = useTheme();
  const ui = useUi();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const now = new Date();
  const range = historyRange(period, now, from, to);
  const rows = useMemo(() => [
    ...(data.invoices ?? []).map((i) => ({ id: i.id, title: i.invoiceNumber, name: i.customerName, total: i.total, createdAt: i.createdAt, method: i.method, status: invoiceDue(data, i.id) === 0 ? "paid" : invoiceDue(data, i.id) < i.total ? "partial" : "due", legacy: false, returned: (data.saleReturns ?? []).filter((r) => r.invoiceId === i.id).reduce((n, r) => n + r.total, 0) })),
    ...data.sales.filter((s) => !s.invoiceId).map((s) => ({ id: s.id, title: s.name, name: "", total: s.total, createdAt: s.createdAt, method: "", status: "", legacy: true, returned: 0 })),
  ].filter((row) => {
    const date = Date.parse(row.createdAt);
    return range && date >= range.start && date < range.end && `${row.title} ${row.name}`.toLocaleLowerCase(i18n.language).includes(search.trim().toLocaleLowerCase(i18n.language));
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [data, range, search, i18n.language]);
  return <POSFrame title={t("pos.history")} scroll={false}>
    <FlatList data={rows} keyExtractor={(i) => `${i.legacy ? "legacy" : "invoice"}-${i.id}`} keyboardShouldPersistTaps="handled" initialNumToRender={15} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 125, gap: 12, width: "100%", maxWidth: 720, alignSelf: "center" }}
      ListHeaderComponent={<View style={{ gap: 14, marginBottom: 8 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 14, borderRadius: 13, backgroundColor: colors.elevated }}><Search size={20} color={colors.muted} /><TextInput accessibilityLabel={t("pos.historySearch")} placeholder={t("pos.historySearch")} placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} keyboardAppearance={isDark ? "dark" : "light"} style={{ flex: 1, minHeight: 50, color: colors.text }} /></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{["today", "week", "month", "customDate"].map((id) => <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: period === id }} onPress={() => setPeriod(id)} style={{ padding: 12, minHeight: 44, borderRadius: 12, backgroundColor: period === id ? colors.primary : colors.card, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: period === id ? colors.onPrimary : colors.muted }}>{t(`pos.${id}`)}</Text></Pressable>)}</ScrollView>{period === "customDate" && <><Field label={t("pos.from")} value={from} onChangeText={setFrom} placeholder="2026-10-01" /><Field label={t("pos.to")} value={to} onChangeText={setTo} placeholder="2026-10-31" />{!range && <Text accessibilityRole="alert" style={ui.error}>{t("pos.invalidDates")}</Text>}</>}</View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}, ${money(item.total)}`} onPress={() => router.push({ pathname: "/(tabs)/sales/receipt", params: item.legacy ? { legacyId: item.id } : { saleId: item.id } })} style={{ ...ui.card, gap: 7 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><ReceiptText size={24} color={colors.primary} /><Text numberOfLines={2} style={{ flex: 1, color: colors.text, fontSize: 12, lineHeight: 20, fontWeight: "600" }}>{item.title}</Text><Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}>{money(item.total)}</Text></View><Text style={ui.text}>{item.legacy ? t("pos.legacySale") : item.name || t("pos.walkIn")}</Text><Text style={{ color: colors.muted, fontSize: 12, lineHeight: 21 }}>{formatBusinessDate(item.createdAt, i18n.language, data.businessSettings)}</Text>{!item.legacy && <Text style={{ color: item.status === "paid" ? colors.success : colors.warning, fontSize: 13 }}>{t(`pos.${item.status === "paid" ? "paidStatus" : item.status === "partial" ? "partialStatus" : "dueStatus"}`)} · {t(`pos.${item.method}`)}</Text>}{item.returned > 0 && <Text style={ui.text}>{t("flows.returned")}: {money(item.returned)}</Text>}</Pressable>}
      ListEmptyComponent={<Text style={{ ...ui.text, paddingVertical: 40, textAlign: "center" }}>{t("pos.noSales")}</Text>} />
  </POSFrame>;
}



