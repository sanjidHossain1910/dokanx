import { useMemo } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useBusiness } from "@/src/store/BusinessProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import { selectTopSellingProducts } from "@/src/dashboard/topSellingProducts";
import { useDeviceTime } from "@/src/dashboard/useDeviceTime";
import Header from "@/components/ui/Header";
import { Button } from "@/components/business/Screen";
import BestSellerRow from "./BestSellerRow";

export default function BestSellers() {
  const { data, ready, error, retry } = useBusiness(); const { colors } = useTheme(); const { t } = useTranslation(); const insets = useSafeAreaInsets(); const now = useDeviceTime();
  const rows = useMemo(() => selectTopSellingProducts(data, { now, limit: data.products.length }), [data, now]);
  return <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}><Header title={t("dashboard.bestSellers")} description={t("dashboard.bestSellersHint")} fallbackHref="/(tabs)" />
    {error ? <View style={{ padding: 20, gap: 12 }}><Text style={{ color: colors.danger }}>{t("business.storageUnavailable")}</Text><Button title={t("business.retry")} onPress={retry} /></View> : !ready ? <ActivityIndicator color={colors.primary} /> : <FlatList data={rows} keyExtractor={(item) => item.product.id} initialNumToRender={12} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 10, width: "100%", maxWidth: 720, alignSelf: "center" }} renderItem={({ item, index }) => <BestSellerRow item={item} rank={index + 1} />} ListEmptyComponent={<Text style={{ color: colors.muted, fontSize: 14, lineHeight: 24, paddingVertical: 24, textAlign: "center" }}>{t("dashboard.noBestSellers")}</Text>} />}
  </SafeAreaView>;
}
