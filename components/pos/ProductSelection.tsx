import { productGrid } from "@/src/layout/responsive";
import { Button, money, useUi } from "@/components/business/Screen";
import SaleScanner from "./SaleScanner";
import { ClearCartButton, POSFrame, POSIssue } from "./Shared";
import { usePOS } from "@/src/store/usePOS";
import SaleProductCard from "./SaleProductCard";
import { setProductFavorite } from "@/src/store/inventory";
import { sellableStock } from "@/src/store/expiry";
import { prioritizeTopSellingProducts, selectTopSellingProducts } from "@/src/dashboard/topSellingProducts";
import { useDeviceTime } from "@/src/dashboard/useDeviceTime";
import { setSaleCardQuantity } from "@/src/store/inlineCart";
import type { PriceType } from "@/src/store/productPricing";
import { formatNumber } from "@/src/dashboard/format";
import { useTheme } from "@/src/theme/ThemeProvider";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { Clock, History, ScanBarcode, Search, ShoppingBag, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Keyboard, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ProductSelection() {
  const pos = usePOS();
  const now = useDeviceTime();
  const { ready, run } = pos;
  const { colors, isDark } = useTheme();
  const ui = useUi();
  const { t, i18n } = useTranslation();
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [width, setWidth] = useState(360);
  const [scan, setScan] = useState(false);
  const scanBusy = useRef(false);
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState<string[]>([]);
  const actionLock = useRef(false);
  const onEditing = useCallback((id: string, active: boolean) => {
    setEditing((current) => active ? current.includes(id) ? current : [...current, id] : current.includes(id) ? current.filter((key) => key !== id) : current);
  }, []);
  const expectedDraftId = pos.draft?.id;
  const onQuantity = useCallback(async (id: string, quantity: number, type?: PriceType) => {
    if (actionLock.current) return false;
    actionLock.current = true;
    try {
      const draftId = expectedDraftId ?? Crypto.randomUUID();
      const saved = await run((current) => {
        if (current.saleDraft?.id !== expectedDraftId) throw new Error("invalidCart");
        return setSaleCardQuantity(current, draftId, id, quantity, type);
      });
      if (saved && quantity === 0) setSelectedId((current) => current === id ? "" : current);
      return saved;
    } finally { actionLock.current = false; }
  }, [expectedDraftId, run]);
  const handled = useRef("");
  useEffect(() => {
    if (!ready || !productId || handled.current === productId) return;
    handled.current = productId;
    setSelectedId(productId); setSearch(productId); setCategory(""); setFavoritesOnly(false);
    router.setParams({ productId: "" });
  }, [ready, productId]);
  useEffect(() => { if (!productId) handled.current = ""; }, [productId]);
  const products = useMemo(() => {
    const current = pos.data.products.filter((p) => !p.deletedAt).map((p) => ({ ...p, stock: sellableStock(pos.data, p.id) }));
    return prioritizeTopSellingProducts(current, selectTopSellingProducts(pos.data, { now, limit: 10 }));
  }, [pos.data, now]);
  const categories = useMemo(() => ["", ...new Set([...pos.data.categories, ...products.map((p) => p.category)].filter(Boolean))], [pos.data.categories, products]);
  const filtered = useMemo(() => products.filter((p) => (!favoritesOnly || p.isFavorite) && (!category || p.category === category) && `${p.name} ${p.barcode} ${p.id}`.normalize("NFKC").toLocaleLowerCase(i18n.language).includes(search.trim().normalize("NFKC").toLocaleLowerCase(i18n.language))), [products, search, category, favoritesOnly, i18n.language]);
  const filters = [{ id: "all", label: t("pos.all"), selected: !favoritesOnly && !category, onPress: () => { setFavoritesOnly(false); setCategory(""); } }, { id: "favorites", label: `★ ${t("selling.favorites")}`, selected: favoritesOnly, onPress: () => { setFavoritesOnly(true); setCategory(""); } }, ...categories.filter(Boolean).map((c) => ({ id: `category-${c}`, label: c, selected: !favoritesOnly && category === c, onPress: () => { setCategory(c); setFavoritesOnly(false); } }))];
  const { columns, cardWidth, pageMaxWidth, gutter } = productGrid(width);
  return <POSFrame title={t("pos.newSale")} subtitle={t("pos.selectHint")} back={false} scroll={false} right={<View style={{ flexDirection: "row" }}><Pressable accessibilityRole="button" accessibilityLabel={t("selling.heldCount", { quantity: formatNumber(pos.data.heldSales?.length ?? 0, i18n.language) })} onPress={() => router.push("/business/held-sales")} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Clock size={23} color={colors.text} />{!!pos.data.heldSales?.length && <View style={{ position: "absolute", top: 0, right: -1, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 3, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 10, color: colors.onPrimary }}>{formatNumber(pos.data.heldSales.length, i18n.language)}</Text></View>}</Pressable><Pressable accessibilityRole="button" accessibilityLabel={t("pos.history")} onPress={() => router.push("/(tabs)/sales/history")} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><History size={23} color={colors.text} /></Pressable><ClearCartButton /></View>}
    footer={pos.draft?.lines.length ? <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><ShoppingBag size={22} color={colors.primary} /><View style={{ flex: 1 }}><Text style={ui.text}>{t("pos.items", { count: pos.draft.lines.length, quantity: formatNumber(pos.draft.lines.length, i18n.language) })}</Text><Text style={{ ...ui.subtitle, color: colors.primary }}>{pos.totals ? money(pos.totals.total) : "—"}</Text></View><Button title={t("pos.viewCart")} disabled={pos.busy || editing.length > 0} onPress={() => router.push("/(tabs)/sales/cart")} /></View> : undefined}>
    <View style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <FlatList key={columns} numColumns={columns} data={filtered} keyExtractor={(p) => p.id} columnWrapperStyle={{ gap: 10, alignItems: "flex-start" }} ItemSeparatorComponent={() => <View style={{ height: 10 }} />} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" initialNumToRender={12} windowSize={7}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 12, paddingBottom: insets.bottom + (pos.draft?.lines.length ? 220 : 125), maxWidth: pageMaxWidth, width: "100%", alignSelf: "center" }}
        ListHeaderComponent={<View style={{ gap: 14, paddingBottom: 16 }}><View style={{ flexDirection: "row", gap: 8 }}><View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.elevated, borderRadius: 13, paddingLeft: 12 }}><Search size={18} color={colors.muted} /><TextInput value={search} onChangeText={setSearch} accessibilityLabel={t("pos.search")} placeholder={t("pos.search")} placeholderTextColor={colors.muted} autoCorrect={false} keyboardAppearance={isDark ? "dark" : "light"} style={{ flex: 1, minWidth: 0, minHeight: 48, color: colors.text, fontSize: 13 }} />{!!search && <Pressable accessibilityRole="button" accessibilityLabel={t("pos.clearSearch")} onPress={() => setSearch("")} style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }}><X size={17} color={colors.muted} /></Pressable>}</View><Pressable accessibilityRole="button" accessibilityLabel={t("business.scan")} onPress={() => { Keyboard.dismiss(); setScan(true); }} style={{ width: 48, height: 48, backgroundColor: colors.elevated, borderRadius: 13, justifyContent: "center", alignItems: "center" }}><ScanBarcode size={23} color={colors.text} /></Pressable></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{filters.map((f) => <Pressable key={f.id} accessibilityRole="button" accessibilityState={{ selected: f.selected }} onPress={f.onPress} style={{ minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: f.selected ? colors.primary : colors.border, backgroundColor: f.selected ? colors.primary : colors.card }}><Text style={{ color: f.selected ? colors.onPrimary : colors.muted, fontSize: 13, lineHeight: 21 }}>{f.label}</Text></Pressable>)}</ScrollView>
          <POSIssue issue={pos.issue} />
        </View>}
        renderItem={({ item }) => <SaleProductCard product={item} width={cardWidth} line={pos.draft?.lines.find((l) => l.productId === item.id)} expanded={selectedId === item.id} onQuantity={onQuantity} onEditing={onEditing} onFavorite={(id, favorite) => {
          if (actionLock.current) return;
          actionLock.current = true;
          void pos.run((d) => setProductFavorite(d, id, favorite, new Date().toISOString())).finally(() => { actionLock.current = false; });
        }} disabled={pos.busy || editing.some((id) => id !== item.id)} />}
        ListEmptyComponent={<View style={{ padding: 24, gap: 16, alignItems: "center" }}><Text style={ui.subtitle}>{t(favoritesOnly ? "selling.noFavorites" : "pos.noProducts")}</Text><Text style={ui.text}>{t(favoritesOnly ? "selling.favoritesHint" : "pos.noProductsHint")}</Text>{favoritesOnly ? <Button secondary title={t("selling.allProducts")} onPress={() => { setFavoritesOnly(false); setCategory(""); setSearch(""); }} /> : <Button title={t("pos.addProduct")} onPress={() => router.push("/inventory/add-product")} />}</View>} />
    </View>
    <Modal visible={scan} animationType="slide" onRequestClose={() => { if (!scanBusy.current) setScan(false); }}>{scan && <SaleScanner onBusyChange={busy => { scanBusy.current = busy; }} onClose={() => setScan(false)} />}</Modal>
  </POSFrame>;
}
