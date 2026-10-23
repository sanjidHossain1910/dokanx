import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ClipboardCheck, ChevronRight } from "lucide-react-native";
import { useBusiness } from "@/src/store/BusinessProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import { countDifference } from "@/src/store/stockCounts";
import { historyRange } from "@/src/store/salesHistory";
import { formatBusinessDate } from "@/src/store/businessSettings";
import { formatNumber } from "@/src/dashboard/format";
import { useDeviceTime } from "@/src/dashboard/useDeviceTime";
import { Button, useUi } from "@/components/business/Screen";
import { CountFrame } from "./StockCountShared";

export default function StockCountHistory() {
  const { data } = useBusiness(); const { colors, isDark } = useTheme(); const { t, i18n } = useTranslation(); const ui = useUi(); const insets = useSafeAreaInsets(); const now = useDeviceTime();
  const [search, setSearch] = useState(""), [period, setPeriod] = useState("all");
  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(i18n.language), range = historyRange(period, now, "", "");
    return [...(data.stockCounts ?? [])].filter((c) => (period === "all" || range && Date.parse(c.createdAt) >= range.start && Date.parse(c.createdAt) < range.end) && `${c.number} ${c.id} ${c.items.map((i) => i.name).join(" ")}`.toLocaleLowerCase(i18n.language).includes(query)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.number.localeCompare(a.number));
  }, [data.stockCounts, search, period, now, i18n.language]);
  return <CountFrame title={t("stockCount.title")} description={t("stockCount.hint")}><FlatList data={rows} keyExtractor={(c) => c.id} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 12 }} keyboardShouldPersistTaps="handled"
    ListHeaderComponent={<View style={{ gap: 14, marginBottom: 8 }}><Button title={`+ ${t("stockCount.new")}`} onPress={() => router.push("/inventory/count-stock")} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{["today", "month", "all"].map((key) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: period === key }} onPress={() => setPeriod(key)} style={{ minHeight: 44, padding: 12, borderRadius: 10, backgroundColor: period === key ? colors.primary : colors.card }}><Text style={{ color: period === key ? colors.onPrimary : colors.text }}>{t(key === "all" ? "inventory.all" : `pos.${key}`)}</Text></Pressable>)}</ScrollView><TextInput accessibilityLabel={t("stockCount.search")} placeholder={t("stockCount.search")} placeholderTextColor={colors.muted} style={ui.input} keyboardAppearance={isDark ? "dark" : "light"} value={search} onChangeText={setSearch} /></View>}
    ListEmptyComponent={<Text style={{ ...ui.text, textAlign: "center", paddingVertical: 40 }}>{t(search ? "stockCount.noMatches" : "stockCount.empty")}</Text>}
    renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={item.number} onPress={() => router.push({ pathname: "/inventory/stock-count", params: { id: item.id } })} style={ui.card}><View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><ClipboardCheck size={23} color={colors.primary} /><Text style={{ ...ui.subtitle, flex: 1 }}>{item.number}</Text><ChevronRight size={18} color={colors.muted} /></View><Text style={ui.text}>{formatBusinessDate(item.createdAt, i18n.language, data.businessSettings)}</Text><Text style={ui.text}>{t("stockCount.summary", { counted: formatNumber(item.items.length, i18n.language), changed: formatNumber(item.items.filter(countDifference).length, i18n.language) })}</Text><Text style={{ color: colors.success, fontSize: 13 }}>{t("stockCount.completed")}</Text></Pressable>} /></CountFrame>;
}
