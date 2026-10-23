import { supplierInvoiceDue } from "@/src/store/finance";
import { Button, money, useUi } from "@/components/business/Screen";
import InventorySheet from "@/components/business/InventorySheet";
import { usePurchasing } from "@/src/store/usePurchasing";
import { useTheme } from "@/src/theme/ThemeProvider";
import { formatBusinessDate } from "@/src/store/businessSettings";
import { router, useLocalSearchParams } from "expo-router";
import { Plus, SlidersHorizontal } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { Choice, SearchBox, PurchaseFrame, SupplierInfo } from "./Shared";

export default function List() {
  const p = usePurchasing(); const ui = useUi(); const { colors } = useTheme(); const { t, i18n } = useTranslation();
  const [search, setSearch] = useState(""); const [filter, setFilter] = useState("all"); const [sort, setSort] = useState("newest"); const [sortOpen, setSortOpen] = useState(false);
  const params = useLocalSearchParams<{ productId?: string }>();
  useEffect(() => { if (params.productId && p.ready) { router.replace({ pathname: "/business/purchases/suppliers", params: { productId: params.productId } }); } }, [params.productId, p.ready]);
  const records = useMemo(() => {
    const invoices = (p.data.purchaseInvoices ?? []).map((i) => ({ id: i.id, name: i.supplierName, phone: i.supplierPhone, address: "", total: i.total, createdAt: i.createdAt, invoice: i.invoiceNumber, status: i.status, payment: supplierInvoiceDue(p.data, i.id) === 0 ? "paidBadge" : supplierInvoiceDue(p.data, i.id) === i.total ? "dueBadge" : "partialBadge", keywords: i.items.map((l) => l.name).join(" ") }));
    const legacy = (p.data.purchases ?? []).filter((i) => !i.invoiceId).map((i) => ({ id: i.id, name: i.name, phone: "", address: "", total: i.total, createdAt: i.createdAt, invoice: i.id, status: "received", payment: "legacy", keywords: i.name }));
    const now = new Date();
    return [...invoices, ...legacy].filter((i) => {
      const date = new Date(i.createdAt);
      return (filter === "all" || filter === "month" ? filter !== "month" || date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() : i.status === filter) && `${i.name} ${i.phone} ${i.invoice} ${i.keywords}`.normalize("NFKC").toLowerCase().includes(search.trim().normalize("NFKC").toLowerCase());
    }).sort((a, b) => sort === "highest" ? b.total - a.total : sort === "oldest" ? Date.parse(a.createdAt) - Date.parse(b.createdAt) : Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [p.data, search, filter, sort]);
  return <PurchaseFrame title={t("purchase.title")} hint={t("purchase.listHint")} scroll={false} right={<Pressable accessibilityRole="button" accessibilityLabel={t("purchase.newPurchase")} onPress={() => router.push("/business/purchases/suppliers")} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}><Plus color={colors.onPrimary} size={26} /></Pressable>}
    footer={p.draft ? <Button title={t("purchase.continue")} onPress={() => router.push("/business/purchases/items")} /> : undefined}>
    <FlatList data={records} keyExtractor={(i) => i.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" }}
      ListHeaderComponent={<View style={{ gap: 14, paddingBottom: 6 }}><Button secondary title={t("restock.title")} onPress={() => router.push("/inventory/restock")} /><Button secondary title={t("flows.suppliers")} onPress={() => router.push("/business/suppliers")} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{["all", "month", "pending", "received"].map((value) => <Choice key={value} label={t(`purchase.${value}`)} selected={filter === value} onPress={() => setFilter(value)} />)}</ScrollView><View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}><View style={{ flex: 1 }}><SearchBox label={t("purchase.search")} value={search} onChangeText={setSearch} /></View><Pressable accessibilityRole="button" accessibilityLabel={t("purchase.sort")} onPress={() => setSortOpen(true)} style={{ width: 44, height: 50, alignItems: "center", justifyContent: "center" }}><SlidersHorizontal color={colors.primary} size={22} /></Pressable></View>{p.draft && <Text style={ui.text}>{t("purchase.draftSaved")}</Text>}</View>}
      ListEmptyComponent={<View style={{ gap: 14, paddingVertical: 30 }}><Text style={ui.text}>{t("purchase.empty")}</Text><Button title={t("purchase.newPurchase")} onPress={() => router.push("/business/purchases/suppliers")} /></View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${item.name} ${item.invoice}`} onPress={() => router.push({ pathname: "/business/purchases/receipt", params: { purchaseId: item.id } })} style={[ui.card, { padding: 12, gap: 5 }]}><SupplierInfo compact supplier={item} right={<Text style={ui.subtitle}>{money(item.total)}</Text>} /><Text numberOfLines={1} style={[ui.text, { fontSize: 11, lineHeight: 18 }]}>{item.invoice}</Text><View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}><Text style={[ui.text, { fontSize: 12, lineHeight: 20 }]}>{formatBusinessDate(item.createdAt, i18n.language, p.data.businessSettings, false)}</Text><View style={{ flexDirection: "row", gap: 6 }}><Text style={{ fontSize: 11, color: item.status === "received" ? colors.success : colors.orange, backgroundColor: item.status === "received" ? colors.successSoft : colors.orangeSoft, padding: 5, borderRadius: 6 }}>{t(`purchase.${item.status}`)}</Text><Text style={{ fontSize: 11, color: colors.muted, padding: 5 }}>{t(`purchase.${item.payment}`)}</Text></View></View></Pressable>} />
    {sortOpen && <InventorySheet title={t("purchase.sort")} onClose={() => setSortOpen(false)}>{["newest", "oldest", "highest"].map((value) => <Choice key={value} label={t(`purchase.${value}`)} selected={sort === value} onPress={() => { setSort(value); setSortOpen(false); }} />)}</InventorySheet>}
  </PurchaseFrame>;
}




