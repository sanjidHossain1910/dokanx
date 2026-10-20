import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import * as Crypto from "expo-crypto";
import { useBusiness } from "@/src/store/BusinessProvider";
import { cashTotals, closeCashDay, dayKey, openCashDay } from "@/src/store/finance";
import { parseMoneyInput } from "@/src/store/productUnits";
import { formatBusinessDate } from "@/src/store/businessSettings";
import { Button, Field, money, Screen, useUi } from "./Screen";
import { FinanceIssue, useFinanceAction } from "./FinanceShared";
export default function CashDayScreen() {
  const { data } = useBusiness(); const { t, i18n } = useTranslation(); const ui = useUi(); const action = useFinanceAction(); const [opening, setOpening] = useState(""); const [counted, setCounted] = useState(""); const [note, setNote] = useState("");
  const today = dayKey(new Date()), row = data.cashDays?.find((d) => d.day === today), totals = cashTotals(data, today), amount = parseMoneyInput(counted);
  const close = () => {
    if (amount === null) { action.setIssue("invalidTransaction"); return; }
    const expected = totals.expected;
    Alert.alert(t("flows.closeDay"), `${t("flows.expected")}: ${money(expected)}\n${t("flows.counted")}: ${money(amount)}\n${t("flows.difference")}: ${money(amount - expected)}`, [{ text: t("flows.cancel"), style: "cancel" }, { text: t("flows.confirm"), onPress: () => { void action.run((current) => { if (cashTotals(current, today).expected !== expected) throw new Error("invalidTransaction"); return closeCashDay(current, { day: today, counted: amount, note, createdAt: new Date().toISOString() }); }); } }]);
  };
  return <Screen back title={t("flows.cashDay")}><Text style={ui.text}>{t("flows.cashHint")}</Text><Text style={ui.subtitle}>{today}</Text>
    {!row ? <><Field label={t("flows.opening")} value={opening} onChangeText={setOpening} keyboardType="decimal-pad" /><Button title={t("flows.openDay")} disabled={action.busy || parseMoneyInput(opening) === null} onPress={() => { const value = parseMoneyInput(opening); if (value !== null) void action.run((current) => openCashDay(current, { id: Crypto.randomUUID(), opening: value, createdAt: new Date().toISOString() })); }} /></> : <>
      <View style={ui.card}>{(["opening", "sales", "collections", "purchases", "suppliers", "expenses", "refunds"] as const).map((key) => <View key={key} style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}><Text style={[ui.text, { flex: 1 }]}>{t(`flows.${key === "suppliers" ? "supplierPayments" : key}`)}</Text><Text style={ui.subtitle}>{money(totals[key])}</Text></View>)}<Text style={ui.text}>{t("flows.expected")}</Text><Text style={ui.title}>{money(row.closedAt ? row.expected! : totals.expected)}</Text></View>
      {row.closedAt ? <View style={ui.card}><Text style={ui.subtitle}>{t("flows.closed")}</Text><Text style={ui.text}>{t("flows.counted")}: {money(row.counted!)}</Text><Text style={ui.text}>{t("flows.difference")}: {money(row.counted! - row.expected!)}</Text><Text style={ui.text}>{row.note}</Text></View> : <><Field label={t("flows.counted")} value={counted} onChangeText={setCounted} keyboardType="decimal-pad" editable={!action.busy} />{amount !== null && <Text style={ui.subtitle}>{t("flows.difference")}: {money(amount - totals.expected)}</Text>}<Field label={t("flows.cashNote")} value={note} onChangeText={setNote} editable={!action.busy} multiline /><Button title={t("flows.closeDay")} disabled={action.busy || amount === null} onPress={close} /></>}
    </>}<FinanceIssue issue={action.issue} /><Text style={ui.subtitle}>{t("flows.cashHistory")}</Text>{[...(data.cashDays ?? [])].filter((d) => d.day !== today).reverse().map((d) => <View style={ui.card} key={d.id}><Text style={ui.subtitle}>{d.day} · {d.closedAt ? t("flows.closed") : t("flows.openDay")}</Text><Text style={ui.text}>{t("flows.opening")}: {money(d.opening)}</Text>{d.closedAt && <><Text style={ui.text}>{t("flows.expected")}: {money(d.expected!)} · {t("flows.counted")}: {money(d.counted!)}</Text><Text style={ui.text}>{t("flows.difference")}: {money(d.counted! - d.expected!)}</Text><Text style={ui.text}>{formatBusinessDate(d.closedAt, i18n.language, data.businessSettings)}</Text><Text style={ui.text}>{d.note}</Text></>}</View>)}</Screen>;
}
