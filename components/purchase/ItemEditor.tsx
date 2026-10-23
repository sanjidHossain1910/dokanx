import DateTimeField from "@/components/ui/DateTimeField";
import InventorySheet from "@/components/business/InventorySheet";
import { Button, Field, money, useUi } from "@/components/business/Screen";
import type { Product } from "@/src/store/business";
import { setPurchaseItem } from "@/src/store/purchasing";
import { allowsFraction, lineAmount, parseMoneyInput, parseQuantityInput, unitLabel } from "@/src/store/productUnits";
import { usePurchasing } from "@/src/store/usePurchasing";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Choice, PurchaseIssue } from "./Shared";

export default function ItemEditor({ product, onClose }: { product: Product; onClose: () => void }) {
  const p = usePurchasing(); const { t, i18n } = useTranslation(); const ui = useUi();
  const line = p.draft?.lines.find((l) => l.productId === product.id);
  const [quantity, setQuantity] = useState(String(line?.quantity ?? 1));
  const [batchNumber, setBatchNumber] = useState(line?.batchNumber ?? "");
  const [expiryDate, setExpiryDate] = useState(line?.expiryDate ?? "");
  const [cost, setCost] = useState(((line?.unitCost ?? product.cost) / 100).toFixed(2));
  const count = parseQuantityInput(quantity, product.unit, false), price = parseMoneyInput(cost);
  const total = count !== null && price !== null ? lineAmount(price, count) : null;
  const unit = unitLabel(product.unit, i18n.language);
  return <InventorySheet title={product.name} busy={p.busy} onClose={onClose}>
    <Text style={ui.text}>{t("purchase.editItem")}</Text>
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>{!allowsFraction(product.unit) && <Choice label="−" selected={false} disabled={p.busy || count === null || count <= 1} onPress={() => setQuantity(String(count! - 1))} />}<View style={{ flex: 1 }}><Field label={t("purchase.quantity", { unit })} keyboardType={allowsFraction(product.unit) ? "decimal-pad" : "number-pad"} value={quantity} onChangeText={setQuantity} editable={!p.busy} /></View>{!allowsFraction(product.unit) && <Choice label="+" selected={false} disabled={p.busy || count === null} onPress={() => setQuantity(String(count! + 1))} />}</View>
    <Field label={t("purchase.cost", { unit })} value={cost} onChangeText={setCost} keyboardType="decimal-pad" editable={!p.busy} />
    <Text style={ui.subtitle}>{t("flows.optionalBatch")}</Text>
    <Field label={t("flows.batch")} value={batchNumber} onChangeText={setBatchNumber} editable={!p.busy} />
    <DateTimeField label={t("flows.expiryDate")} value={expiryDate} onChange={setExpiryDate} disabled={p.busy} clearable />
    {total !== null && <Text style={ui.subtitle}>{t("purchase.total")}: {money(total)}</Text>}
    <PurchaseIssue issue={p.issue} />
    <Button title={t(line ? "purchase.updateItem" : "purchase.addItem")} disabled={p.busy || total === null} onPress={() => { if (count !== null && price !== null) void p.run((data) => setPurchaseItem(data, product.id, count, price, { batchNumber: batchNumber.trim() || undefined, expiryDate: expiryDate.trim() || undefined })).then((ok) => { if (ok) onClose(); }); }} />
    {line && <Button secondary title={t("purchase.remove")} disabled={p.busy} onPress={() => void p.run((data) => setPurchaseItem(data, product.id, 0, line.unitCost)).then((ok) => { if (ok) onClose(); })} />}
  </InventorySheet>;
}
