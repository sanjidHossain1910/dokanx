import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { selectDuePlans } from "@/src/store/dueReminders";
import { formatMoney, formatNumber, localeFor } from "@/src/dashboard/format";
import { selectLifetimeSummary } from "@/src/dashboard/lifetimeSummary";
import { selectDashboard } from "@/src/dashboard/selectors";
import { selectTopSellingProducts } from "@/src/dashboard/topSellingProducts";
import { useDeviceTime } from "@/src/dashboard/useDeviceTime";
import { useBusiness } from "@/src/store/BusinessProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import { router } from "expo-router";
import { ArrowRight, Boxes, Check, CircleAlert, PackagePlus, ShoppingBag, ShoppingCart, TrendingUp, Truck, UsersRound, Wallet } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../business/Screen";
import { InventoryStatusCard, QuickActionCard, SummaryCard } from "./Cards";
import DashboardHeader from "./DashboardHeader";
import LowStockAlert from "./LowStockAlert";
import WeeklySalesChart from "./WeeklySalesChart";
import BestSellerRow from "./BestSellerRow";
import LifetimeSummary from "./LifetimeSummary";
import SyncConflictNotice from "./SyncConflictNotice";

function SectionTitle({ title, action }: { title: string; action?: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return <View className="flex-row items-center justify-between gap-3"><Text className="flex-1 text-lg font-bold text-ink" style={{ lineHeight: 29 }}>{title}</Text>{action && <Pressable accessibilityRole="button" accessibilityLabel={`${title}: ${t("dashboard.viewAll")}`} onPress={action} className="flex-row items-center gap-1" style={{ minHeight: 44, paddingLeft: 8 }}><Text className="text-xs font-semibold text-brand">{t("dashboard.viewAll")}</Text><ArrowRight size={14} color={colors.primary} /></Pressable>}</View>;
}
export default function HomeDashboard() {
  const { data, ready, error, retry } = useBusiness();
  const { ready: themeReady, colors } = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isTablet, pageMaxWidth, gutter } = useResponsiveLayout();
  const now = useDeviceTime();
  const overview = useMemo(() => selectDashboard(data, now), [data, now]);
  const lifetime = useMemo(() => selectLifetimeSummary(data), [data]);
  const duePlans = useMemo(() => selectDuePlans(data, now), [data, now]);
  const bestSellers = useMemo(() => selectTopSellingProducts(data, { now, limit: 3 }), [data, now]);
  const number = (value: number) => formatNumber(value, i18n.language);
  const money = (value: number) => formatMoney(value, i18n.language);
  const products = () => router.push("/(tabs)/packege");
  return <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-canvas" style={{ backgroundColor: colors.background }}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 16, paddingBottom: insets.bottom + 118 }}>
      <View className="mx-auto w-full" style={{ maxWidth: pageMaxWidth }}>
        <DashboardHeader name={data.shopName} ownerName={data.ownerName} photoUri={data.shopPhotoUri} now={now} unread={ready ? overview.unread : 0} />
        {error ? <View className="mt-6 gap-4 rounded-2xl border border-line bg-surface p-5"><Text className="text-sm text-negative">{t("business.storageUnavailable")}</Text><Button title={t("business.retry")} onPress={retry} /></View> : !ready || !themeReady ? <View className="items-center py-16"><ActivityIndicator color={colors.primary} accessibilityLabel={t("common.loading")} /><Text className="mt-3 text-sm text-muted">{t("common.loading")}</Text></View> :
          <Animated.View entering={FadeIn.duration(250).reduceMotion(ReduceMotion.System)} className="gap-6 pt-7">
            <SyncConflictNotice />
            {overview.productCount === 0 && <View className="rounded-2xl border p-4" style={{ borderColor: colors.primary + "33", backgroundColor: colors.primarySoft, gap: 8 }}><Text className="text-base font-semibold text-ink">{t("dashboard.noProducts")}</Text><Text className="text-sm text-muted" style={{ lineHeight: 24 }}>{t("dashboard.noProductsBody")}</Text><Button title={t("business.addProduct")} onPress={() => router.push("/inventory/add-product")} /></View>}
            <View style={{ gap: 12 }}>
              <View className="flex-row flex-wrap items-center justify-between gap-2"><Text className="text-lg font-bold text-ink">{t("dashboard.today")}</Text><Text className="text-xs text-muted" style={{ lineHeight: 22 }}>{now.toLocaleDateString(localeFor(i18n.language), { day: "numeric", month: "short", year: "numeric" })}</Text></View>
              <View style={{ flexDirection: isTablet ? "row" : "column", gap: 12 }}>
              <View className="flex-row gap-3" style={{ flex: 1 }}><SummaryCard label={t("dashboard.sales")} amount={money(overview.sales)} icon={ShoppingCart} tone="primary" detail={overview.salesChange !== null ? t("dashboard.yesterday", { value: `${overview.salesChange >= 0 ? "+" : ""}${number(Math.round(overview.salesChange))}%` }) : undefined} onPress={() => router.push("/(tabs)/sales/history")} /><SummaryCard label={t("dashboard.purchase")} amount={money(overview.purchase)} icon={ShoppingBag} tone="orange" onPress={() => router.push("/business/purchases")} /></View>
              <View className="flex-row gap-3" style={{ flex: 1 }}><SummaryCard label={t("dashboard.profit")} amount={money(overview.profit)} icon={TrendingUp} tone={overview.profit < 0 ? "danger" : "success"} onPress={() => router.push("/business/profit")} /><SummaryCard label={t("dashboard.expense")} amount={money(overview.expenses)} icon={Wallet} tone="danger" onPress={() => router.push("/business/expenses")} /></View>
              </View>
              <Text className="text-xs text-muted" style={{ lineHeight: 21 }}>{t("dashboard.grossNote")}</Text>
            </View>
            <LifetimeSummary totals={lifetime} />
            {duePlans.length > 0 && <View style={{ gap: 10 }}><SectionTitle title={t("due.dashboard")} action={() => router.push("/business/collections")} /><Text className="text-sm text-muted">{t("due.today")}: {number(duePlans.filter((r) => r.status === "today").length)} · {t("due.overdue")}: {number(duePlans.filter((r) => r.status === "overdue").length)}</Text><Button secondary title={t("due.open")} onPress={() => router.push("/business/collections")} /></View>}
            <View style={{ gap: 12 }}><SectionTitle title={t("dashboard.quickActions")} />
              <View style={{ flexDirection: isTablet ? "row" : "column", gap: 12 }}>
              <View className="flex-row gap-3" style={{ flex: 1 }}><QuickActionCard label={t("business.newSale")} icon={ShoppingCart} tone="primary" onPress={() => router.push("/(tabs)/sales")} /><QuickActionCard label={t("business.addProduct")} icon={PackagePlus} tone="success" onPress={() => router.push("/inventory/add-product")} /></View>
              <View className="flex-row gap-3" style={{ flex: 1 }}><QuickActionCard label={t("dashboard.buy")} icon={Truck} tone="orange" onPress={() => router.push("/business/purchases")} /><QuickActionCard label={t("dashboard.customers")} icon={UsersRound} tone="primary" onPress={() => router.push("/business/customers")} /></View>
            </View>
            </View>
            <View style={{ gap: 10 }}><SectionTitle title={t("dashboard.inventory")} action={products} /><View className="flex-row gap-2"><InventoryStatusCard label={t("dashboard.totalProducts")} value={number(overview.productCount)} icon={Boxes} tone="primary" onPress={products} /><InventoryStatusCard label={t("dashboard.lowStock")} value={number(overview.lowStockCount)} icon={CircleAlert} tone="warning" onPress={() => router.push({ pathname: "/(tabs)/packege", params: { stock: "low" } })} /><InventoryStatusCard label={t("dashboard.outOfStock")} value={number(overview.outOfStockCount)} icon={ShoppingBag} tone="danger" onPress={() => router.push({ pathname: "/(tabs)/packege", params: { stock: "out" } })} /></View></View>
            <Button secondary title={t("restock.title")} onPress={() => router.push("/inventory/restock")} />
            <View style={{ gap: 10 }}><SectionTitle title={t("dashboard.bestSellers")} action={() => router.push("/business/best-sellers")} /><Text className="text-xs text-muted" style={{ lineHeight: 20 }}>{t("dashboard.bestSellersHint")}</Text>{bestSellers.length ? bestSellers.map((item, index) => <BestSellerRow key={item.product.id} item={item} rank={index + 1} />) : <Text className="text-sm text-muted" style={{ lineHeight: 24 }}>{t("dashboard.noBestSellers")}</Text>}</View>
            <View style={{ gap: 12 }}><SectionTitle title={t("dashboard.week")} /><WeeklySalesChart days={overview.week} total={overview.weeklyTotal} /></View>
            <View style={{ gap: 10 }}><SectionTitle title={t("dashboard.alerts")} action={() => router.push("/business/notifications")} /><LowStockAlert products={overview.alerts} /></View>
            <View className="flex-row items-center justify-center gap-1.5"><Check size={12} color={colors.success} /><Text className="text-xs text-muted">{t("dashboard.local")}</Text></View>
          </Animated.View>}
      </View>
    </ScrollView>
  </SafeAreaView>;
}
