import DateTimeField from "@/components/ui/DateTimeField";
import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { useBusiness } from "@/src/store/BusinessProvider";
import { addProductBatch } from "@/src/store/expiry";
import { dayKey } from "@/src/store/finance";
import { allowsFraction, parseQuantityInput, quantityTicks, unitLabel } from "@/src/store/productUnits";
import SelectField from "@/components/ui/SelectField";
import { Button, Field, Screen, useUi } from "./Screen";
import InventorySheet from "./InventorySheet";
import { FinanceIssue, useFinanceAction } from "./FinanceShared";
export default function ExpiryScreen() {
  const { productId } = useLocalSearchParams<{ productId?: string }>(); const { data } = useBusiness(); const { t, i18n } = useTranslation(); const ui = useUi(); const action = useFinanceAction();
  const [filter, setFilter] = useState("seven"); const [sheet, setSheet] = useState(false); const [selected, setSelected] = useState(productId ?? ""); const [batch, setBatch] = useState(""); const [expiry, setExpiry] = useState(""); const [quantity, setQuantity] = useState("");
  const product = data.products.find((p) => p.id === selected && !p.deletedAt); const today = dayKey(new Date()); const end = new Date(); end.setDate(end.getDate() + (filter === "seven" ? 7 : 30));
  const rows = (data.productBatches ?? []).filter((b) => b.quantity > 0 && (!productId || b.productId === productId) && (filter === "all" || filter === "expired" ? filter === "all" || b.expiryDate < today : b.expiryDate >= today && b.expiryDate <= dayKey(end))).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  const untracked = product ? (quantityTicks(product.stock)! - (data.productBatches ?? []).filter((b) => b.productId === product.id).reduce((n, b) => n + quantityTicks(b.quantity)!, 0)) / 1000 : 0;
  return <Screen back title={t("flows.expiryAlerts")}><Text style={ui.text}>{t("flows.expiryHint")}</Text><View style={ui.card}><View style={ui.row}><Text style={[ui.subtitle, { flex: 1 }]}>{t("flows.blockExpired")}</Text><Switch accessibilityLabel={t("flows.blockExpired")} value={data.blockExpiredSales !== false} disabled={action.busy} onValueChange={(v) => { void action.run((d) => ({ ...d, blockExpiredSales: v })); }} /></View></View><View style={ui.row}>{["expired", "seven", "thirty", "all"].map((v) => <Button key={v} title={t(`flows.${v}`)} secondary={v !== filter} onPress={() => setFilter(v)} />)}</View>
    <Button title={t("flows.assignBatch")} onPress={() => { action.setIssue(""); setSheet(true); }} />{!rows.length && <Text style={ui.text}>{t("flows.noBatches")}</Text>}{rows.map((b) => { const p = data.products.find((p) => p.id === b.productId); return <View key={b.id} style={ui.card}><Text style={ui.subtitle}>{p?.name}</Text><Text style={ui.text}>{t("flows.batch")}: {b.batchNumber}</Text><Text style={ui.text}>{b.expiryDate < today ? `${t("flows.expired")} · ` : ""}{b.expiryDate}</Text><Text style={ui.subtitle}>{b.quantity} {unitLabel(p?.unit, i18n.language)}</Text></View>; })}<FinanceIssue issue={action.issue} />
    {sheet && <InventorySheet title={t("flows.assignBatch")} busy={action.busy} onClose={() => setSheet(false)}><Text style={ui.text}>{t("flows.batchHint")}</Text><SelectField label={t("business.products")} value={selected} options={[{ id: "", label: t("business.none") }, ...data.products.filter((p) => !p.deletedAt).map((p) => ({ id: p.id, label: p.name }))]} onChange={setSelected} disabled={action.busy} /><Text style={ui.subtitle}>{t("flows.untracked")}: {untracked} {unitLabel(product?.unit, i18n.language)}</Text><Field label={t("flows.batch")} value={batch} onChangeText={setBatch} editable={!action.busy} /><DateTimeField label={t("flows.expiryDate")} value={expiry} onChange={setExpiry} disabled={action.busy} clearable /><Field label={t("flows.batchQuantity")} value={quantity} onChangeText={setQuantity} keyboardType={allowsFraction(product?.unit) ? "decimal-pad" : "number-pad"} editable={!action.busy} /><FinanceIssue issue={action.issue} /><Button title={t("flows.confirm")} disabled={action.busy || !product} onPress={() => { const q = parseQuantityInput(quantity, product?.unit, false); if (q === null || !product) { action.setIssue("invalidBatch"); return; } const input = { id: Crypto.randomUUID(), productId: product.id, batchNumber: batch.trim(), expiryDate: expiry.trim(), quantity: q, createdAt: new Date().toISOString() }; void action.run((d) => addProductBatch(d, input)).then((ok) => { if (ok) { setSheet(false); setBatch(""); setExpiry(""); setQuantity(""); } }); }} /></InventorySheet>}
  </Screen>;
}
