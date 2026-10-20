import { useRef, useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { useBusiness } from "@/src/store/BusinessProvider";
import { previewReturn, returnSale, type MoneyMethod } from "@/src/store/finance";
import { allowsFraction, parseQuantityInput, quantityTicks, unitLabel } from "@/src/store/productUnits";
import { Button, Field, money, Screen, useUi } from "./Screen";
import { FinanceIssue, MoneyMethods, useFinanceAction } from "./FinanceShared";
export default function SaleReturnScreen() {
  const { saleId } = useLocalSearchParams<{ saleId?: string }>(); const { data } = useBusiness(); const { t, i18n } = useTranslation(); const ui = useUi(); const action = useFinanceAction();
  const [values, setValues] = useState<Record<string, string>>({}); const [restock, setRestock] = useState<Record<string, boolean>>({}); const [note, setNote] = useState(""); const [method, setMethod] = useState<MoneyMethod>("cash"); const tx = useRef(Crypto.randomUUID());
  const invoice = data.invoices?.find((i) => i.id === saleId);
  const prior = (data.saleReturns ?? []).filter((r) => r.invoiceId === saleId).flatMap((r) => r.items);
  const selected = invoice?.items.flatMap((l) => { const q = parseQuantityInput(values[l.id] ?? "0", l.unit); return q ? [{ lineId: l.id, quantity: q, restock: restock[l.id] !== false }] : []; }) ?? [];
  const invalid = invoice?.items.some((l) => parseQuantityInput(values[l.id] ?? "0", l.unit) === null);
  let preview: ReturnType<typeof previewReturn> | undefined;
  try { if (invoice && selected.length && !invalid) preview = previewReturn(data, invoice.id, selected); } catch {}
  const submit = () => {
    if (!invoice || !preview || !note.trim()) { action.setIssue("invalidReturn"); return; }
    const expected = JSON.stringify({ returns: data.saleReturns, collections: data.customerCollections });
    const input = { id: tx.current, invoiceId: invoice.id, items: selected, method, note: note.trim(), createdAt: new Date().toISOString() };
    Alert.alert(t("flows.returns"), `${t("flows.returnTotal")}: ${money(preview.total)}\n${t("flows.dueReduction")}: ${money(preview.dueReduction)}\n${t("flows.refund")}: ${money(preview.refund)}`, [{ text: t("flows.cancel"), style: "cancel" }, { text: t("flows.confirm"), onPress: () => { void action.run((current) => { if (JSON.stringify({ returns: current.saleReturns, collections: current.customerCollections }) !== expected) throw new Error("invalidReturn"); return returnSale(current, input); }).then((ok) => { if (ok) router.dismissTo({ pathname: "/(tabs)/sales/receipt", params: { saleId: invoice.id } }); }); } }]);
  };
  return <Screen back title={t("flows.returns")}><Text style={ui.text}>{t("flows.returnHint")}</Text>{invoice ? <><Text style={ui.subtitle}>{invoice.invoiceNumber}</Text>{invoice.items.map((l) => { const remaining = (quantityTicks(l.quantity)! - prior.filter((r) => r.lineId === l.id).reduce((n, r) => n + quantityTicks(r.quantity)!, 0)) / 1000; return <View key={l.id} style={ui.card}><Text style={ui.subtitle}>{l.name}</Text><Text style={ui.text}>{remaining} {unitLabel(l.unit, i18n.language)} · {money(l.unitPrice)}</Text><Field label={t("flows.quantity")} value={values[l.id] ?? "0"} keyboardType={allowsFraction(l.unit) ? "decimal-pad" : "number-pad"} editable={!action.busy && remaining > 0} onChangeText={(v) => setValues((s) => ({ ...s, [l.id]: v }))} /><View style={ui.row}><Switch accessibilityLabel={`${l.name}: ${t("flows.restock")}`} value={restock[l.id] !== false} disabled={action.busy} onValueChange={(v) => setRestock((s) => ({ ...s, [l.id]: v }))} /><Text style={[ui.text, { flex: 1 }]}>{t("flows.restock")}</Text></View></View>; })}<Field label={t("flows.reason")} value={note} onChangeText={setNote} editable={!action.busy} multiline /><MoneyMethods value={method} onChange={setMethod} disabled={action.busy} />{preview && <View style={ui.card}><Text style={ui.subtitle}>{t("flows.returnTotal")}: {money(preview.total)}</Text><Text style={ui.text}>{t("flows.dueReduction")}: {money(preview.dueReduction)}</Text><Text style={ui.subtitle}>{t("flows.refund")}: {money(preview.refund)}</Text></View>}<FinanceIssue issue={action.issue} /><Button title={t("flows.confirm")} onPress={submit} disabled={action.busy || !preview || !note.trim()} /></> : <Text style={ui.error}>{t("pos.receiptMissing")}</Text>}</Screen>;
}
