import { productGrid } from "@/src/layout/responsive";
import { Button, money, useUi } from "@/components/business/Screen";
import ProductCamera from "@/components/business/ProductCamera";
import InventorySheet from "@/components/business/InventorySheet";
import { ProductPhoto } from "@/components/pos/Shared";
import { usePurchasing } from "@/src/store/usePurchasing";
import { unitLabel } from "@/src/store/productUnits";
import { formatNumber } from "@/src/dashboard/format";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useScanFeedback } from "@/src/scanner/ScanFeedbackProvider";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { Plus, ScanBarcode, Trash2 } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Keyboard, Modal, Pressable, ScrollView, Text, View } from "react-native";
import ItemEditor from "./ItemEditor";
import { Choice, SearchBox, PurchaseFrame, PurchaseIssue } from "./Shared";

export default function Products() {
  const p = usePurchasing(); const { t, i18n } = useTranslation(); const { colors } = useTheme(); const ui = useUi();
  const params = useLocalSearchParams<{ productId?: string }>();
  const [search, setSearch] = useState(""); const [category, setCategory] = useState(""); const [width, setWidth] = useState(360); const [selected, setSelected] = useState("");
  const [scan, setScan] = useState(false); const [feedbackId, setFeedbackId] = useState(""); const [clear, setClear] = useState(false);
  const feedback = useScanFeedback();
  useEffect(() => { if (!scan && feedbackId) feedback(feedbackId); }, [scan, feedbackId, feedback]);
  const products = useMemo(() => p.data.products.filter((item) => !item.deletedAt), [p.data.products]);
  const categories = ["", ...new Set(products.map((item) => item.category).filter(Boolean))];
  const filtered = products.filter((item) => (!category || item.category === category) && `${item.name} ${item.barcode} ${item.id}`.normalize("NFKC").toLowerCase().includes(search.trim().normalize("NFKC").toLowerCase()));
  const { columns, cardWidth, pageMaxWidth, gutter } = productGrid(width);
  const chosen = products.find((item) => item.id === (selected || params.productId));
  if (p.ready && !p.draft) return <PurchaseFrame title={t("purchase.itemsTitle")}><Text style={ui.text}>{t("purchase.noDraft")}</Text><Button title={t("purchase.newPurchase")} onPress={() => router.replace("/business/purchases/suppliers")} /></PurchaseFrame>;
  return <PurchaseFrame title={t("purchase.itemsTitle")} hint={t("purchase.itemsHint")} scroll={false} right={<Pressable accessibilityRole="button" accessibilityLabel={t("purchase.clear")} onPress={() => setClear(true)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Trash2 color={colors.muted} size={22} /></Pressable>}
    footer={<View style={{ gap: 10 }}><Button secondary title={t("purchase.addProduct")} disabled={p.busy} onPress={() => router.push("/business/purchases/add-product")} /><Button title={`${t("purchase.review")} (${formatNumber(p.draft?.lines.length ?? 0, i18n.language)}) · ${p.totals ? money(p.totals.total) : "—"}`} disabled={p.busy || !p.draft?.lines.length} onPress={() => router.push("/business/purchases/summary")} /></View>}>
    <View style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}><FlatList key={columns} numColumns={columns} data={filtered} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" columnWrapperStyle={{ gap: 10 }} contentContainerStyle={{ padding: gutter, gap: 12, width: "100%", maxWidth: pageMaxWidth, alignSelf: "center" }}
      ListHeaderComponent={<View style={{ gap: 12, paddingBottom: 6 }}><View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}><View style={{ flex: 1 }}><SearchBox label={t("purchase.searchProducts")} value={search} onChangeText={setSearch} /></View><Pressable accessibilityRole="button" accessibilityLabel={t("business.scan")} onPress={() => { Keyboard.dismiss(); setScan(true); }} style={{ width: 48, height: 50, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.elevated }}><ScanBarcode color={colors.primary} size={23} /></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{categories.map((item) => <Choice key={item} label={item || t("purchase.all")} selected={category === item} onPress={() => setCategory(item)} />)}</ScrollView><PurchaseIssue issue={p.issue} /></View>}
      ListEmptyComponent={<Text style={ui.text}>{t("purchase.noProducts")}</Text>}
      renderItem={({ item }) => { const line = p.draft?.lines.find((l) => l.productId === item.id); return <Pressable accessibilityRole="button" accessibilityLabel={item.name} onPress={() => { Keyboard.dismiss(); setSelected(item.id); }} style={{ width: cardWidth, backgroundColor: colors.card, borderWidth: 1, borderColor: line ? colors.primary : colors.border, borderRadius: 14, padding: 8, gap: 6 }}><ProductPhoto uri={item.photoUri} name={item.name} size={Math.max(40, cardWidth - 18)} /><Text numberOfLines={2} style={{ color: colors.text, fontSize: 12, lineHeight: 19, minHeight: 38 }}>{item.name}</Text><Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{money(line?.unitCost ?? item.cost)}</Text><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 3 }}><Text style={{ flex: 1, color: colors.muted, fontSize: 10, lineHeight: 17 }}>{line ? t("purchase.selected", { quantity: formatNumber(line.quantity, i18n.language), unit: unitLabel(item.unit, i18n.language) }) : unitLabel(item.unit, i18n.language)}</Text><View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}><Plus size={18} color={colors.onPrimary} /></View></View></Pressable>; }} /></View>
    {chosen && <ItemEditor key={chosen.id} product={chosen} onClose={() => { setSelected(""); router.setParams({ productId: "" }); }} />}
    {clear && <InventorySheet title={t("purchase.clear")} busy={p.busy} onClose={() => setClear(false)}><Text style={ui.text}>{t("purchase.clearHint")}</Text><PurchaseIssue issue={p.issue} /><Button title={t("purchase.clear")} disabled={p.busy} onPress={() => void p.run((data) => ({ ...data, purchaseDraft: undefined })).then((ok) => { if (ok) { setClear(false); router.dismissTo("/business/purchases"); } })} /></InventorySheet>}
    <Modal visible={scan} animationType="slide" onRequestClose={() => setScan(false)}>{scan && <ProductCamera mode="barcode" onBusyChange={() => {}} onPhoto={() => {}} onClose={() => setScan(false)} onBarcode={(value) => { setScan(false); setFeedbackId(Crypto.randomUUID()); const item = products.find((item) => item.barcode === value || item.id === value); if (item) setSelected(item.id); else p.setIssue("productNotFound"); }} />}</Modal>
  </PurchaseFrame>;
}
