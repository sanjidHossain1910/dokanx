import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { Button, money, useUi } from "./Screen";
import InventorySheet from "./InventorySheet";
import ProductActions from "./ProductActions";
import StockBadge from "./StockBadge";
import SelectField from "@/components/ui/SelectField";
import { useBusiness } from "@/src/store/BusinessProvider";
import type { Product } from "@/src/store/business";
import { stockStatus } from "@/src/store/inventory";
import { router, useLocalSearchParams } from "expo-router";
import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme/ThemeProvider";
import { unitLabel } from "@/src/store/productUnits";
import { formatNumber } from "@/src/dashboard/format";
import { Image } from "expo-image";
import { MoreHorizontal, Package, Plus, ScanBarcode, Search, SlidersHorizontal, X } from "lucide-react-native";
import Animated, { LinearTransition } from "react-native-reanimated";

type Filter = "all" | "in" | "low" | "out";
const ProductCard = memo(function ProductCard({ product: p, onOptions }: { product: Product; onOptions: (product: Product) => void }) {
  const { colors, isDark } = useTheme();
  const { t, i18n } = useTranslation();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${p.name}, ${money(p.price)}, ${formatNumber(p.stock, i18n.language)} ${unitLabel(p.unit, i18n.language)}`} onPress={() => router.push({ pathname: "/inventory/product", params: { productId: p.id } })}
    className="flex-row items-center rounded-2xl" style={({ pressed }) => ({ padding: 14, gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.8 : 1, boxShadow: isDark ? undefined : "0px 2px 8px rgba(15,23,42,0.04)" })}>
    <View style={{ width: 64, height: 72, flexShrink: 0, marginRight: 6, borderRadius: 12, backgroundColor: p.photoUri ? colors.productPhoto : colors.elevated, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
      {p.photoUri ? <Image source={{ uri: p.photoUri }} contentFit="cover" accessibilityLabel={p.name} style={{ width: 64, height: 64 }} /> : <Package size={30} color={colors.muted} />}
    </View>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <Text numberOfLines={2} style={{ color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: "700" }}>{p.name}</Text>
      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10, lineHeight: 16 }}>{p.id}</Text>
      <Text style={{ color: colors.primary, fontSize: 15, lineHeight: 23, fontWeight: "700" }}>{money(p.price)}<Text style={{ color: colors.muted, fontSize: 11, fontWeight: "400" }}> / {unitLabel(p.unit, i18n.language)}</Text></Text>
    </View>
    <View style={{ alignItems: "flex-end", gap: 3, maxWidth: 112 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("inventory.options", { name: p.name })} onPress={(event) => { event.stopPropagation(); onOptions(p); }} style={{ width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" }} hitSlop={4}><MoreHorizontal size={22} color={colors.muted} /></Pressable>
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14, lineHeight: 22, textAlign: "right" }}>{formatNumber(p.stock, i18n.language)} <Text style={{ fontWeight: "400", fontSize: 11, color: colors.muted }}>{unitLabel(p.unit, i18n.language)}</Text></Text>
      <StockBadge product={p} />
    </View>
  </Pressable>;
});

export default function Products() {
  const ui = useUi();
  const { colors, isDark } = useTheme();
  const { data, ready, error, retry } = useBusiness();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { availableWidth, pageMaxWidth, gutter } = useResponsiveLayout();
  const columns = availableWidth >= 1000 ? 2 : 1;
  const cardWidth = (Math.min(availableWidth, pageMaxWidth) - gutter * 2 - (columns - 1) * 14) / columns;
  const { stock, saved } = useLocalSearchParams<{ stock?: string; saved?: string }>();
  const filter: Filter = stock === "in" || stock === "low" || stock === "out" ? stock : "all";
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Product>();
  const active = useMemo(() => data.products.filter((p) => !p.deletedAt), [data.products]);
  const candidates = useMemo(() => {
    const query = search.trim().normalize("NFKC").toLocaleLowerCase(i18n.language);
    return active.filter((p) => (!category || p.category === category) && `${p.name} ${p.barcode} ${p.id}`.normalize("NFKC").toLocaleLowerCase(i18n.language).includes(query));
  }, [active, category, search, i18n.language]);
  const counts = useMemo(() => candidates.reduce((result, p) => { result[stockStatus(p)]++; return result; }, { all: candidates.length, in: 0, low: 0, out: 0 }), [candidates]);
  const products = useMemo(() => {
    const rows = candidates.filter((p) => filter === "all" || stockStatus(p) === filter);
    if (sort === "name") rows.sort((a, b) => a.name.localeCompare(b.name, i18n.language));
    else if (sort === "priceLow") rows.sort((a, b) => a.price - b.price);
    else if (sort === "priceHigh") rows.sort((a, b) => b.price - a.price);
    else rows.reverse();
    return rows;
  }, [candidates, filter, sort, i18n.language]);
  const reset = () => { setSearch(""); setCategory(""); setSort("newest"); router.setParams({ stock: "" }); };
  return <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}>
    <FlatList key={columns} numColumns={columns} columnWrapperStyle={columns > 1 ? { gap: 14 } : undefined} data={error || !ready ? [] : products} keyExtractor={(p) => p.id} renderItem={({ item }) => <View style={{ width: columns > 1 ? cardWidth : "100%" }}><ProductCard product={item} onOptions={setSelected} /></View>} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" initialNumToRender={12} maxToRenderPerBatch={12} windowSize={7}
      contentContainerStyle={{ padding: gutter, paddingBottom: insets.bottom + 118, gap: 14, maxWidth: pageMaxWidth, width: "100%", alignSelf: "center", flexGrow: 1 }}
      ListHeaderComponent={<View style={{ gap: 22, marginBottom: 4 }}>
        <Button secondary title={t("restock.title")} disabled={!ready || error} onPress={() => router.push("/inventory/restock")} />
        <View style={{ flexDirection: "row", gap: 10 }}><View style={{ flex: 1 }}><Button secondary title={t("stockCount.title")} disabled={!ready || error} onPress={() => router.push("/inventory/stock-counts")} /></View><View style={{ flex: 1 }}><Button secondary title={t("flows.expiryAlerts")} onPress={() => router.push("/inventory/expiry")} /></View></View>
        {!!saved && <View style={{ flexDirection: "row", alignItems: "center", borderRadius: 12, paddingLeft: 14, backgroundColor: colors.successSoft }}><Text accessibilityLiveRegion="polite" style={{ flex: 1, color: colors.success, fontWeight: "600" }}>{t("inventory.saved")}</Text><Pressable accessibilityRole="button" accessibilityLabel={t("business.cancel")} onPress={() => router.setParams({ saved: "" })} style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }}><X size={18} color={colors.success} /></Pressable></View>}
        <View className="flex-row items-center justify-between" style={{ gap: 12 }}><View style={{ flex: 1 }}><Text accessibilityRole="header" style={{ color: colors.text, fontSize: 27, fontWeight: "700", lineHeight: 38 }}>{t("business.products")}</Text><Text style={ui.text}>{t("inventory.subtitle")}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={t("business.scan")} onPress={() => router.push("/(scanner)/scan")} style={{ height: 46, width: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 23, justifyContent: "center", alignItems: "center", backgroundColor: colors.card }}><ScanBarcode size={23} color={colors.text} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("business.addProduct")} onPress={() => router.push("/inventory/add-product")} style={{ height: 46, width: 46, borderRadius: 23, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" }}><Plus size={25} color={colors.onPrimary} /></Pressable>
        </View>
        <View className="flex-row items-center" style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingLeft: 14, gap: 10 }}>
          <Search size={21} color={colors.muted} /><TextInput accessibilityLabel={t("business.search")} placeholder={t("inventory.search")} placeholderTextColor={colors.muted} selectionColor={colors.primary} keyboardAppearance={isDark ? "dark" : "light"} autoCorrect={false} value={search} onChangeText={setSearch} style={{ flex: 1, minWidth: 0, height: 56, color: colors.text, fontSize: 15 }} />
          {!!search && <Pressable accessibilityRole="button" accessibilityLabel={t("inventory.clearSearch")} onPress={() => setSearch("")} style={{ width: 36, height: 48, justifyContent: "center", alignItems: "center" }}><X size={18} color={colors.muted} /></Pressable>}
          <Pressable accessibilityRole="button" accessibilityLabel={t("inventory.filters")} onPress={() => setShowFilters(true)} style={{ width: 48, height: 48, marginRight: 4, borderRadius: 12, justifyContent: "center", alignItems: "center", backgroundColor: category || sort !== "newest" ? colors.primarySoft : colors.card }}><SlidersHorizontal size={21} color={category || sort !== "newest" ? colors.primary : colors.muted} /></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>{(["all", "in", "low", "out"] as Filter[]).map((id) => <Animated.View key={id} layout={LinearTransition.duration(180)}><Pressable accessibilityRole="button" accessibilityState={{ selected: filter === id }} onPress={() => router.setParams({ stock: id === "all" ? "" : id })} style={{ paddingHorizontal: 14, paddingVertical: 11, minHeight: 44, borderRadius: 12, backgroundColor: filter === id ? colors.primary : id === "low" ? colors.warningSoft : id === "out" ? colors.dangerSoft : colors.card, borderWidth: 1, borderColor: filter === id ? colors.primary : colors.border }}><Text style={{ color: filter === id ? colors.onPrimary : id === "low" ? colors.warning : id === "out" ? colors.danger : colors.muted, fontSize: 13, lineHeight: 22, fontWeight: "600" }}>{t(`inventory.${id === "all" ? "all" : id === "in" ? "inStock" : id === "low" ? "lowStock" : "outOfStock"}`)} ({formatNumber(counts[id], i18n.language)})</Text></Pressable></Animated.View>)}</ScrollView>
      </View>}
      ListEmptyComponent={<View style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 280, padding: 24, gap: 14 }}>
        {error ? <><Text style={ui.error}>{t("business.storageUnavailable")}</Text><Button title={t("business.retry")} onPress={retry} /></> : !ready ? <ActivityIndicator color={colors.primary} /> : <>
          <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}><Package size={34} color={colors.primary} /></View>
          <Text style={{ ...ui.subtitle, textAlign: "center" }}>{t(!active.length ? "inventory.noProducts" : search || category ? "inventory.noResults" : filter === "low" ? "inventory.noLow" : filter === "out" ? "inventory.noOut" : "inventory.noIn")}</Text>
          <Text style={{ ...ui.text, textAlign: "center" }}>{t(!active.length ? "inventory.noProductsHint" : search || category ? "inventory.noResultsHint" : "inventory.filterEmptyHint")}</Text>
          {!active.length ? <Button title={t("business.addProduct")} onPress={() => router.push("/inventory/add-product")} /> : <Button secondary title={t("inventory.clearFilters")} onPress={reset} />}
        </>}
      </View>} />
    {showFilters && <InventorySheet title={t("inventory.filters")} onClose={() => setShowFilters(false)}>
      <SelectField label={t("inventory.category")} value={category} onChange={setCategory} options={[{ id: "", label: t("inventory.allCategories") }, ...Array.from(new Set([...data.categories, ...active.map((p) => p.category).filter(Boolean)])).map((label) => ({ id: label, label }))]} />
      <SelectField label={t("inventory.sort")} value={sort} onChange={setSort} options={["newest", "name", "priceLow", "priceHigh"].map((id) => ({ id, label: t(`inventory.${id}`) }))} />
      <Button secondary title={t("inventory.manageCategories")} onPress={() => { setShowFilters(false); router.push("/inventory/categories"); }} />
      <Button secondary title={t("inventory.clearFilters")} onPress={reset} /><Button title={t("inventory.apply")} onPress={() => setShowFilters(false)} />
    </InventorySheet>}
    {selected && <ProductActions product={selected} onClose={() => setSelected(undefined)} />}
  </SafeAreaView>;
}
