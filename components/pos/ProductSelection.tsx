import { Button, money, useUi } from "@/components/business/Screen";
import ProductCamera from "@/components/business/ProductCamera";
import { ClearCartButton, POSFrame, POSIssue, ProductPhoto } from "./Shared";
import { usePOS } from "@/src/store/usePOS";
import QuantityPicker from "./QuantityPicker";
import { stockStatus } from "@/src/store/inventory";
import { sellableStock } from "@/src/store/expiry";
import { unitLabel } from "@/src/store/productUnits";
import type { Product } from "@/src/store/business";
import { formatNumber } from "@/src/dashboard/format";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useScanFeedback } from "@/src/scanner/ScanFeedbackProvider";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { History, Plus, ScanBarcode, Search, ShoppingBag, X } from "lucide-react-native";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Keyboard, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";

const SaleCard = memo(function SaleCard({ product, width, quantity, onAdd, disabled }: { product: Product; width: number; quantity: number; onAdd: (id: string) => void; disabled: boolean }) {
  const { colors, isDark } = useTheme();
  const { t, i18n } = useTranslation();
  const state = stockStatus(product);
  const stockColor = state === "out" ? colors.danger : state === "low" ? isDark ? colors.warning : "#92400E" : isDark ? colors.success : "#15803D";
  return <Animated.View entering={FadeIn.duration(120).reduceMotion(ReduceMotion.System)} style={{ width, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: 16, padding: 10, gap: 6 }}>
    <View style={{ alignItems: "center" }}><ProductPhoto uri={product.photoUri} name={product.name} size={Math.max(40, width - 22)} /></View>
    <Text numberOfLines={2} style={{ minHeight: 44, fontSize: 13, lineHeight: 21, fontWeight: "600", color: colors.text }}>{product.name}</Text>
    <Text style={{ color: colors.text, fontSize: 17, lineHeight: 25, fontWeight: "700" }}>{money(product.price)}</Text>
    <Text style={{ color: stockColor, fontSize: 11, lineHeight: 19 }}>{product.stock ? t("pos.available", { quantity: formatNumber(product.stock, i18n.language), unit: unitLabel(product.unit, i18n.language) }) : t("pos.out")}</Text>
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 44, gap: 3 }}><Text style={{ flex: 1, color: colors.muted, fontSize: 10, lineHeight: 17 }}>{quantity ? t("pos.added", { quantity: formatNumber(quantity, i18n.language) }) : unitLabel(product.unit, i18n.language)}</Text><Pressable disabled={disabled || product.stock <= quantity} accessibilityRole="button" accessibilityLabel={t("pos.add", { name: product.name })} onPress={() => onAdd(product.id)} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, opacity: disabled || product.stock <= quantity ? 0.35 : pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] })} hitSlop={3}><Plus size={23} color={colors.onPrimary} /></Pressable></View>
  </Animated.View>;
});
export default function ProductSelection() {
  const pos = usePOS();
  const { ready } = pos;
  const { colors, isDark } = useTheme();
  const ui = useUi();
  const { t, i18n } = useTranslation();
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [width, setWidth] = useState(360);
  const [scan, setScan] = useState(false);
  const [scanId, setScanId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const feedback = useScanFeedback();
  const handled = useRef("");
  useEffect(() => {
    if (!ready || !productId || handled.current === productId) return;
    handled.current = productId;
    setSelectedId(productId);
    router.setParams({ productId: "" });
  }, [ready, productId]);
  useEffect(() => { if (!productId) handled.current = ""; }, [productId]);
  useEffect(() => { if (!scan && scanId) feedback(scanId); }, [scan, scanId, feedback]);
  const products = pos.data.products.filter((p) => !p.deletedAt).map((p) => ({ ...p, stock: sellableStock(pos.data, p.id) }));
  const categories = useMemo(() => ["", ...new Set([...pos.data.categories, ...products.map((p) => p.category)].filter(Boolean))], [pos.data.categories, products]);
  const filtered = useMemo(() => products.filter((p) => (!category || p.category === category) && `${p.name} ${p.barcode} ${p.id}`.normalize("NFKC").toLocaleLowerCase(i18n.language).includes(search.trim().normalize("NFKC").toLocaleLowerCase(i18n.language))), [products, search, category, i18n.language]);
  const columns = width >= 480 ? 3 : 2;
  const cardWidth = (Math.min(width, 720) - 40 - (columns - 1) * 12) / columns;
  const add = (id: string) => { Keyboard.dismiss(); setSelectedId(id); };
  const selected = products.find((p) => p.id === selectedId);
  return <POSFrame title={t("pos.newSale")} subtitle={t("pos.selectHint")} back={false} scroll={false} right={<View style={{ flexDirection: "row" }}><Pressable accessibilityRole="button" accessibilityLabel={t("pos.history")} onPress={() => router.push("/(tabs)/sales/history")} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><History size={23} color={colors.text} /></Pressable><ClearCartButton /></View>}
    footer={pos.draft?.lines.length ? <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><ShoppingBag size={22} color={colors.primary} /><View style={{ flex: 1 }}><Text style={ui.text}>{t("pos.items", { count: pos.draft.lines.length, quantity: formatNumber(pos.draft.lines.length, i18n.language) })}</Text><Text style={{ ...ui.subtitle, color: colors.primary }}>{pos.totals ? money(pos.totals.total) : "—"}</Text></View><Button title={t("pos.viewCart")} disabled={pos.busy} onPress={() => router.push("/(tabs)/sales/cart")} /></View> : undefined}>
    <View style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <FlatList key={columns} numColumns={columns} data={filtered} keyExtractor={(p) => p.id} columnWrapperStyle={{ gap: 12 }} ItemSeparatorComponent={() => <View style={{ height: 12 }} />} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" initialNumToRender={12} windowSize={7}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + (pos.draft?.lines.length ? 220 : 125), maxWidth: 720, width: "100%", alignSelf: "center" }}
        ListHeaderComponent={<View style={{ gap: 14, paddingBottom: 16 }}><View style={{ flexDirection: "row", gap: 8 }}><View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.elevated, borderRadius: 13, paddingLeft: 12 }}><Search size={18} color={colors.muted} /><TextInput value={search} onChangeText={setSearch} accessibilityLabel={t("pos.search")} placeholder={t("pos.search")} placeholderTextColor={colors.muted} autoCorrect={false} keyboardAppearance={isDark ? "dark" : "light"} style={{ flex: 1, minWidth: 0, minHeight: 48, color: colors.text, fontSize: 13 }} />{!!search && <Pressable accessibilityRole="button" accessibilityLabel={t("pos.clearSearch")} onPress={() => setSearch("")} style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }}><X size={17} color={colors.muted} /></Pressable>}</View><Pressable accessibilityRole="button" accessibilityLabel={t("business.scan")} onPress={() => { Keyboard.dismiss(); setScan(true); }} style={{ width: 48, height: 48, backgroundColor: colors.elevated, borderRadius: 13, justifyContent: "center", alignItems: "center" }}><ScanBarcode size={23} color={colors.text} /></Pressable></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{categories.map((c) => <Pressable key={c} accessibilityRole="button" accessibilityState={{ selected: category === c }} onPress={() => setCategory(c)} style={{ minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: category === c ? colors.primary : colors.border, backgroundColor: category === c ? colors.primary : colors.card }}><Text style={{ color: category === c ? colors.onPrimary : colors.muted, fontSize: 13, lineHeight: 21 }}>{c || t("pos.all")}</Text></Pressable>)}</ScrollView>
          <POSIssue issue={pos.issue} />
        </View>}
        renderItem={({ item }) => <SaleCard product={item} width={cardWidth} quantity={pos.draft?.lines.find((l) => l.productId === item.id)?.quantity ?? 0} onAdd={add} disabled={pos.busy} />}
        ListEmptyComponent={<View style={{ padding: 24, gap: 16, alignItems: "center" }}><Text style={ui.subtitle}>{t("pos.noProducts")}</Text><Text style={ui.text}>{t("pos.noProductsHint")}</Text><Button title={t("pos.addProduct")} onPress={() => router.push("/inventory/add-product")} /></View>} />
    </View>
    {selected && <QuantityPicker key={selected.id} product={selected} onClose={() => setSelectedId("")} />}
    <Modal visible={scan} animationType="slide" onRequestClose={() => setScan(false)}>{scan && <ProductCamera mode="barcode" onBusyChange={() => {}} onPhoto={() => {}} onClose={() => setScan(false)} onBarcode={(value) => {
      setScan(false); setScanId(Crypto.randomUUID());
      const p = products.find((p) => p.barcode === value || p.id === value);
      if (p) add(p.id); else pos.setIssue("productNotFound");
    }} />}</Modal>
  </POSFrame>;
}
