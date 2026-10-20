import { Button, Field, money, useUi } from "@/components/business/Screen";
import InventorySheet from "@/components/business/InventorySheet";
import { usePurchasing } from "@/src/store/usePurchasing";
import { saveSupplier, selectPurchaseSupplier } from "@/src/store/purchasing";
import { normalizeNumericInput } from "@/src/store/productUnits";
import { useTheme } from "@/src/theme/ThemeProvider";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { CheckCircle2, Circle, Plus } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, Text, View } from "react-native";
import { SearchBox, PurchaseFrame, PurchaseIssue, SupplierInfo } from "./Shared";

export default function Suppliers() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const p = usePurchasing(); const ui = useUi(); const { colors } = useTheme(); const { t } = useTranslation();
  const [search, setSearch] = useState(""); const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [address, setAddress] = useState("");
  const filtered = (p.data.suppliers ?? []).filter((s) => `${s.name} ${s.phone} ${s.address}`.normalize("NFKC").toLowerCase().includes(search.trim().normalize("NFKC").toLowerCase()));
  const add = async () => {
    const id = Crypto.randomUUID();
    if (await p.run((data) => selectPurchaseSupplier(saveSupplier(data, { id, name: name.trim(), phone: normalizeNumericInput(phone).replace(/[\s()-]/g, ""), address: address.trim(), balance: 0 }), id, Crypto.randomUUID()))) { setOpen(false); setName(""); setPhone(""); setAddress(""); }
  };
  return <PurchaseFrame title={t("purchase.newPurchase")} hint={t("purchase.supplierHint")} scroll={false} footer={<Button title={t("purchase.continue")} disabled={p.busy || !p.draft?.supplierId} onPress={() => router.push({ pathname: "/business/purchases/items", params: { productId: productId ?? "" } })} />}>
    <FlatList data={filtered} keyExtractor={(s) => s.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12, width: "100%", maxWidth: 720, alignSelf: "center" }}
      ListHeaderComponent={<View style={{ gap: 12, paddingBottom: 6 }}><SearchBox label={t("purchase.searchSupplier")} value={search} onChangeText={setSearch} /><Pressable accessibilityRole="button" onPress={() => { p.setIssue(""); setOpen(true); }} style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, minHeight: 44 }}><Plus size={20} color={colors.primary} /><Text style={{ color: colors.primary }}>{t("purchase.addSupplier")}</Text></Pressable><PurchaseIssue issue={p.issue} /></View>}
      ListEmptyComponent={<Text style={ui.text}>{t("purchase.emptySuppliers")}</Text>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={item.name} accessibilityState={{ selected: p.draft?.supplierId === item.id }} disabled={p.busy} onPress={() => void p.run((data) => selectPurchaseSupplier(data, item.id, Crypto.randomUUID()))} style={[ui.card, { borderColor: p.draft?.supplierId === item.id ? colors.primary : colors.border }]}><SupplierInfo supplier={item} right={p.draft?.supplierId === item.id ? <CheckCircle2 color={colors.primary} size={22} /> : <Circle color={colors.border} size={22} />} /><Text style={ui.text}>{t("purchase.balance")}: {money(item.balance)}</Text></Pressable>} />
    {open && <InventorySheet title={t("purchase.addSupplier")} busy={p.busy} onClose={() => setOpen(false)}><Field label={t("purchase.supplierName")} value={name} onChangeText={setName} /><Field label={t("purchase.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" /><Field label={t("purchase.address")} value={address} onChangeText={setAddress} multiline /><PurchaseIssue issue={p.issue} /><Button title={t("business.save")} disabled={p.busy} onPress={() => void add()} /></InventorySheet>}
  </PurchaseFrame>;
}
