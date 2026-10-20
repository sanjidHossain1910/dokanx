import WalletLogo from "@/components/payments/WalletLogo";
import { Button, Field, money, useUi } from "@/components/business/Screen";
import { SummaryRow, ProductPhoto } from "@/components/pos/Shared";
import { useBusiness } from "@/src/store/BusinessProvider";
import { completePurchase, purchaseTotals, type PurchaseMethod } from "@/src/store/purchasing";
import { usePurchasing } from "@/src/store/usePurchasing";
import { parseMoneyInput, unitLabel } from "@/src/store/productUnits";
import { formatNumber } from "@/src/dashboard/format";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { Choice, PurchaseFrame, PurchaseIssue, SupplierInfo } from "./Shared";
import ItemEditor from "./ItemEditor";

export default function Summary() {
  const { data, ready } = useBusiness();
  const { t } = useTranslation();
  return ready ? <PurchaseSummary key={data.purchaseDraft?.id ?? "empty"} /> : <PurchaseFrame title={t("purchase.summary")}><View /></PurchaseFrame>;
}
function PurchaseSummary() {
  const p = usePurchasing(); const { t, i18n } = useTranslation(); const ui = useUi();
  const draft = p.draft;
  const [discount, setDiscount] = useState(((draft?.discount.value ?? 0) / 100).toFixed(2));
  const [transport, setTransport] = useState(((draft?.transport ?? 0) / 100).toFixed(2));
  const [other, setOther] = useState(((draft?.other ?? 0) / 100).toFixed(2));
  const [payStatus, setPayStatus] = useState<"full" | "partial" | "duePayment">("full");
  const [paidInput, setPaidInput] = useState(""); const [method, setMethod] = useState<PurchaseMethod>("cash");
  const [status, setStatus] = useState<"pending" | "received">("received"); const [reference, setReference] = useState(""); const [note, setNote] = useState(""); const [selected, setSelected] = useState("");
  const supplier = p.data.suppliers?.find((s) => s.id === draft?.supplierId);
  const discountAmount = parseMoneyInput(discount), transportAmount = parseMoneyInput(transport), otherAmount = parseMoneyInput(other);
  const fieldsValid = discountAmount !== null && transportAmount !== null && otherAmount !== null;
  let totals: ReturnType<typeof purchaseTotals> | null = null;
  try { if (draft && fieldsValid) totals = purchaseTotals({ ...draft, discount: { ...draft.discount, value: discountAmount! }, transport: transportAmount!, other: otherAmount! }); } catch { /* Invalid fields keep completion disabled. */ }
  const paid = payStatus === "full" ? totals?.total ?? 0 : payStatus === "duePayment" ? 0 : parseMoneyInput(paidInput);
  const paymentValid = paid !== null && totals !== null && paid <= totals.total && (payStatus !== "partial" || paid > 0 && paid < totals.total);
  const saveField = (key: "discount" | "transport" | "other", text: string) => {
    const value = parseMoneyInput(text);
    if (value !== null) void p.run((data) => { if (!data.purchaseDraft || data.purchaseDraft.id !== draft?.id) throw new Error("invalidDraft"); return { ...data, purchaseDraft: { ...data.purchaseDraft, [key]: key === "discount" ? { ...data.purchaseDraft.discount, value } : value } }; });
  };
  const complete = async () => {
    if (!draft || !fieldsValid || !paymentValid || paid === null) return;
    const id = draft.id;
    if (await p.run((data) => completePurchase({ ...data, purchaseDraft: data.purchaseDraft?.id === id ? { ...data.purchaseDraft, discount: { ...data.purchaseDraft.discount, value: discountAmount! }, transport: transportAmount!, other: otherAmount! } : data.purchaseDraft }, id, { paid, method, status, reference: reference.trim(), note: note.trim(), createdAt: new Date().toISOString() }))) router.replace({ pathname: "/business/purchases/receipt", params: { purchaseId: id, success: "1" } });
  };
  const chosen = p.data.products.find((item) => item.id === selected && !item.deletedAt);
  return <PurchaseFrame title={t("purchase.summary")} hint={t("purchase.summaryHint")} footer={draft?.lines.length ? <Button title={t(p.busy ? "purchase.saving" : "purchase.complete")} disabled={p.busy || !totals || !fieldsValid || !paymentValid} onPress={() => void complete()} /> : undefined}>
    {!draft?.lines.length || !supplier ? <><Text style={ui.text}>{t("purchase.emptyItems")}</Text><Button title={t("purchase.newPurchase")} onPress={() => router.replace("/business/purchases/suppliers")} /></> : <>
      <View style={ui.card}><SupplierInfo supplier={supplier} /><Button secondary title={t("purchase.change")} disabled={p.busy} onPress={() => router.push("/business/purchases/suppliers")} /></View>
      <Text style={ui.subtitle}>{t("purchase.items", { count: formatNumber(draft.lines.length, i18n.language) })}</Text>
      {draft.lines.map((line) => <Pressable key={line.productId} accessibilityRole="button" accessibilityLabel={line.name} onPress={() => setSelected(line.productId)} style={[ui.card, { flexDirection: "row", alignItems: "center", gap: 10 }]}><ProductPhoto name={line.name} uri={line.photoUri} size={42} /><View style={{ flex: 1 }}><Text style={ui.subtitle}>{line.name}</Text><Text style={ui.text}>{formatNumber(line.quantity, i18n.language)} {unitLabel(line.unit, i18n.language)} × {money(line.unitCost)}</Text></View><Text style={ui.subtitle}>{money(totals?.lines[draft.lines.indexOf(line)] ?? 0)}</Text></Pressable>)}
      <Button secondary title={t("purchase.itemsTitle")} disabled={p.busy} onPress={() => router.push("/business/purchases/items")} />
      <View style={ui.card}><SummaryRow label={t("purchase.subtotal")} value={totals ? money(totals.subtotal) : "—"} /><Text style={ui.subtitle}>{t("purchase.discount")}</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{(["fixed", "percent"] as const).map((kind) => <Choice key={kind} label={t(kind === "fixed" ? "purchase.amount" : "purchase.percent")} selected={draft.discount.kind === kind} disabled={p.busy} onPress={() => { setDiscount("0.00"); void p.run((data) => ({ ...data, purchaseDraft: data.purchaseDraft ? { ...data.purchaseDraft, discount: { kind, value: 0 } } : undefined })); }} />)}</View>
      <Field label={t("purchase.discountValue")} value={discount} keyboardType="decimal-pad" onChangeText={setDiscount} onBlur={() => saveField("discount", discount)} editable={!p.busy} />
      <Field label={t("purchase.transport")} value={transport} keyboardType="decimal-pad" onChangeText={setTransport} onBlur={() => saveField("transport", transport)} editable={!p.busy} />
      <Field label={t("purchase.otherCost")} value={other} keyboardType="decimal-pad" onChangeText={setOther} onBlur={() => saveField("other", other)} editable={!p.busy} />
      <SummaryRow label={t("purchase.discount")} value={totals ? `− ${money(totals.discount)}` : "—"} /><SummaryRow label={t("purchase.total")} value={totals ? money(totals.total) : "—"} strong />
      {!fieldsValid && <Text style={ui.text}>{t("purchase.invalidTotals")}</Text>}<PurchaseIssue issue={totals ? "" : "invalidTotals"} /></View>
      <Text style={ui.subtitle}>{t("purchase.receiptStatus")}</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{(["received", "pending"] as const).map((s) => <Choice key={s} label={t(`purchase.${s}`)} selected={status === s} disabled={p.busy} onPress={() => setStatus(s)} />)}</View><Text style={ui.text}>{t("purchase.statusHint")}</Text>
      <Text style={ui.subtitle}>{t("purchase.paymentStatus")}</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{(["full", "partial", "duePayment"] as const).map((s) => <Choice key={s} label={t(`purchase.${s}`)} selected={payStatus === s} disabled={p.busy} onPress={() => setPayStatus(s)} />)}</View>
      <Text style={ui.subtitle}>{t("purchase.paymentMethod")}</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{(["cash", "bkash", "nagad", "bank", "other"] as const).map((s) => <Choice key={s} label={t(`purchase.${s}`)} selected={method === s} icon={s === "bkash" || s === "nagad" ? <WalletLogo method={s} width={44} height={34} /> : undefined} disabled={p.busy} onPress={() => setMethod(s)} />)}</View><Text style={ui.text}>{t("purchase.manualHint")}</Text>
      {payStatus === "partial" && <Field label={t("purchase.paidInput")} value={paidInput} onChangeText={setPaidInput} keyboardType="decimal-pad" editable={!p.busy} />}
      <SummaryRow label={t("purchase.paid")} value={paid === null ? "—" : money(paid)} /><SummaryRow label={t("purchase.due")} value={paid !== null && totals ? money(Math.max(0, totals.total - paid)) : "—"} />
      {!paymentValid && <Text style={ui.error}>{t("purchase.invalidPayment")}</Text>}
      <Field label={t("purchase.reference")} value={reference} onChangeText={setReference} editable={!p.busy} /><Field label={t("purchase.note")} value={note} onChangeText={setNote} multiline editable={!p.busy} /><Text style={ui.text}>{t("purchase.draftSaved")}</Text><PurchaseIssue issue={p.issue} />
    </>}
    {chosen && <ItemEditor key={chosen.id} product={chosen} onClose={() => setSelected("")} />}
  </PurchaseFrame>;
}
