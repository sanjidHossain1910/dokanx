import { FlatList, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";
import { useBusiness } from "@/src/store/BusinessProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import { formatBusinessDate } from "@/src/store/businessSettings";
import { Button, useUi } from "@/components/business/Screen";
import { CountFrame, CountItemView } from "./StockCountShared";

export default function StockCountDetails() {
  const { id, success } = useLocalSearchParams<{ id: string; success?: string }>(); const { data } = useBusiness(); const { colors } = useTheme(); const { t, i18n } = useTranslation(); const ui = useUi(); const insets = useSafeAreaInsets(); const count = data.stockCounts?.find((c) => c.id === id);
  return <CountFrame title={t("stockCount.details")}><FlatList data={count?.items ?? []} keyExtractor={(i) => i.productId} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 12 }} ListEmptyComponent={<Text style={ui.text}>{t("stockCount.noMatches")}</Text>}
    ListHeaderComponent={count ? <View style={{ ...ui.card, marginBottom: 8, backgroundColor: colors.successSoft }}><Check size={36} color={colors.success} /><Text style={ui.subtitle}>{t(success ? "stockCount.updated" : "stockCount.completed")}</Text><Text selectable style={ui.subtitle}>{count.number}</Text><Text style={ui.text}>{formatBusinessDate(count.createdAt, i18n.language, data.businessSettings)}</Text></View> : null}
    renderItem={({ item }) => <View style={ui.card}><CountItemView item={item} />{!!item.reason && <Text style={ui.text}>{t(`stockCount.${item.reason}`)}</Text>}</View>}
    ListFooterComponent={count ? <View style={{ gap: 12, marginTop: 8 }}>{!!count.note && <View style={ui.card}><Text style={ui.text}>{count.note}</Text></View>}<Text style={ui.text}>{t("stockCount.savedHint")}</Text><Button title={t("stockCount.new")} onPress={() => router.replace("/inventory/count-stock")} /><Button secondary title={t("stockCount.history")} onPress={() => router.dismissTo("/inventory/stock-counts")} /></View> : null} /></CountFrame>;
}
