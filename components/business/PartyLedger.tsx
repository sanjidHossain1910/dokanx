import DuePlanEditor from "@/components/reminders/DuePlanEditor";
import { ReminderNotice } from "@/components/reminders/DuePlanForm";
import { selectDuePlans } from "@/src/store/dueReminders";
import { useDeviceTime } from "@/src/dashboard/useDeviceTime";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { useBusiness } from "@/src/store/BusinessProvider";
import { formatBusinessDate } from "@/src/store/businessSettings";
import { invoiceDue, settleBalance, supplierInvoiceDue, type MoneyMethod } from "@/src/store/finance";
import { parseMoneyInput } from "@/src/store/productUnits";
import { Button, Field, money, Screen, useUi } from "./Screen";
import InventorySheet from "./InventorySheet";
import { FinanceIssue, MoneyMethods, useFinanceAction } from "./FinanceShared";

export default function PartyLedger({ kind }: { kind: "customer" | "supplier" }) {
  const { id, collect } = useLocalSearchParams<{ id?: string; collect?: string }>(); const { data } = useBusiness(); const { t, i18n } = useTranslation(); const ui = useUi(); const action = useFinanceAction();
  const now = useDeviceTime();
  const [planInvoice, setPlanInvoice] = useState<string>();
  const plans = selectDuePlans(data, now);
  const [search, setSearch] = useState(""); const [sheet, setSheet] = useState(false); const [amount, setAmount] = useState(""); const [reference, setReference] = useState(""); const [note, setNote] = useState(""); const [method, setMethod] = useState<MoneyMethod>("cash"); const [saved, setSaved] = useState(false); const tx = useRef("");
  const parties = kind === "customer" ? data.customers ?? [] : data.suppliers ?? [];
  const party = parties.find((p) => p.id === id); const balance = party?.balance ?? 0;
  const openedCollection = useRef("");
  useEffect(() => {
    if (kind === "customer" && collect === "1" && party && balance > 0 && openedCollection.current !== party.id) {
      openedCollection.current = party.id; tx.current = Crypto.randomUUID(); setSheet(true);
    }
  }, [kind, collect, party, balance]);
  const payments = (kind === "customer" ? data.customerCollections ?? [] : data.supplierPayments ?? []).filter((p) => p.partyId === id);
  const invoices = kind === "customer" ? (data.invoices ?? []).filter((i) => i.customerId === id).map((i) => ({ ...i, due: invoiceDue(data, i.id) })) : (data.purchaseInvoices ?? []).filter((i) => i.supplierId === id).map((i) => ({ ...i, due: supplierInvoiceDue(data, i.id) }));
  const returns = kind === "customer" ? (data.saleReturns ?? []).filter((r) => invoices.some((i) => i.id === r.invoiceId)) : [];
  const timeline = [...invoices.map((i) => ({ key: i.id, date: i.createdAt, label: i.invoiceNumber, detail: `${t("pos.total")}: ${money(i.total)} · ${t("flows.balance")}: ${money(i.due)}`, invoice: i.id })), ...payments.map((p) => ({ key: p.id, date: p.createdAt, label: `${t(kind === "customer" ? "flows.collect" : "flows.pay")} · ${money(p.amount)}`, detail: `${t(`flows.${p.method}`)}${p.reference ? ` · ${p.reference}` : ""}${p.note ? ` · ${p.note}` : ""}`, invoice: "" })), ...returns.map((r) => ({ key: r.id, date: r.createdAt, label: `${t("flows.returned")} · ${money(r.total)}`, detail: `${t("flows.dueReduction")}: ${money(r.dueReduction)} · ${t("flows.refund")}: ${money(r.refund)}`, invoice: r.invoiceId }))].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const submit = () => {
    const value = parseMoneyInput(amount); if (!party || value === null || !value || value > balance) { action.setIssue("invalidTransaction"); return; }
    const expectedBalance = balance; const input = { id: tx.current, partyId: party.id, amount: value, method, reference: reference.trim(), note: note.trim(), createdAt: new Date().toISOString() };
    Alert.alert(t("flows.review"), `${party.name}\n${t("flows.amount")}: ${money(value)}\n${t("flows.method")}: ${t(`flows.${method}`)}\n${t("flows.after")}: ${money(balance - value)}`, [{ text: t("flows.cancel"), style: "cancel" }, { text: t("flows.confirm"), onPress: () => { void action.run((current) => { const latest = (kind === "customer" ? current.customers : current.suppliers)?.find((p) => p.id === input.partyId); if ((latest?.balance ?? 0) !== expectedBalance) throw new Error("invalidTransaction"); return settleBalance(current, kind, input); }).then((ok) => { if (ok) { setSheet(false); setSaved(true); } }); } }]);
  };
  return <Screen back title={party?.name ?? t(kind === "customer" ? "flows.customers" : "flows.suppliers")}>
    {!id ? <><Field label={t("flows.search")} value={search} onChangeText={setSearch} />{parties.filter((p) => `${p.name} ${p.phone}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).map((p) => <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push({ pathname: kind === "customer" ? "/business/customer" : "/business/suppliers", params: { id: p.id } })} style={ui.card}><Text style={ui.subtitle}>{p.name}</Text><Text style={ui.text}>{p.phone}</Text><Text style={ui.subtitle}>{t("flows.balance")}: {money(p.balance ?? 0)}</Text></Pressable>)}{!parties.length && <Text style={ui.text}>{t("flows.empty")}</Text>}</> : !party ? <Text style={ui.error}>{t("flows.empty")}</Text> : <>
      <View style={ui.card}><Text style={ui.text}>{party.phone}</Text><Text style={ui.text}>{t("flows.balance")}</Text><Text style={ui.title}>{money(balance)}</Text><Button title={t(kind === "customer" ? "flows.collect" : "flows.pay")} disabled={balance <= 0 || action.busy} onPress={() => { tx.current = Crypto.randomUUID(); setAmount(""); setReference(""); setNote(""); setSaved(false); action.setIssue(""); setSheet(true); }} /></View>
      {kind === "customer" && <ReminderNotice />}
      {saved && <Text accessibilityLiveRegion="polite" style={ui.subtitle}>{t("flows.saved")}</Text>}<Text style={ui.subtitle}>{t("flows.history")}</Text>
      {!timeline.length && <Text style={ui.text}>{t("flows.empty")}</Text>}{timeline.map((r) => <View key={r.key} style={ui.card}><Pressable disabled={!r.invoice} accessibilityRole={r.invoice ? "button" : undefined} onPress={() => router.push(kind === "customer" ? { pathname: "/(tabs)/sales/receipt", params: { saleId: r.invoice } } : { pathname: "/business/purchases/receipt", params: { purchaseId: r.invoice } })} style={{ gap: 8 }}><Text style={ui.subtitle}>{r.label}</Text><Text style={ui.text}>{r.detail}</Text><Text style={ui.text}>{formatBusinessDate(r.date, i18n.language, data.businessSettings)}</Text></Pressable>{kind === "customer" && r.invoice === r.key && invoices.some((i) => i.id === r.invoice && i.due > 0) && <View style={{ gap: 8 }}>{plans.filter((p) => p.invoiceId === r.invoice).map((p) => <Text key={p.invoiceId} style={ui.text}>{t(`due.${p.status}`)} · {p.dueDate} · {t(p.remind ? "due.on" : "due.off")}</Text>)}<Button secondary title={t(plans.some((p) => p.invoiceId === r.invoice) ? "due.change" : "due.optional")} onPress={() => setPlanInvoice(r.invoice)} /></View>}</View>)}
    </>}
    {planInvoice && <DuePlanEditor invoiceId={planInvoice} onClose={() => setPlanInvoice(undefined)} />}
    {sheet && party && <InventorySheet title={t(kind === "customer" ? "flows.collect" : "flows.pay")} busy={action.busy} onClose={() => setSheet(false)}><Text style={ui.subtitle}>{party.name} · {money(balance)}</Text><Field label={t("flows.amount")} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} editable={!action.busy} /><MoneyMethods value={method} onChange={setMethod} disabled={action.busy} /><Field label={t("flows.reference")} value={reference} onChangeText={setReference} editable={!action.busy} /><Field label={t("flows.note")} value={note} onChangeText={setNote} editable={!action.busy} /><Text style={ui.text}>{t("flows.manual")}</Text><FinanceIssue issue={action.issue} /><Button title={t("flows.review")} disabled={action.busy} onPress={submit} /></InventorySheet>}
  </Screen>;
}
