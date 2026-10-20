import { Button, Field, money, Screen, useUi } from "@/components/business/Screen";
import { useBusiness } from "@/src/store/BusinessProvider";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

export default function Expenses() {
  const ui = useUi();
  const { data, update } = useBusiness();
  const { t, i18n } = useTranslation();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const saving = useRef(false);
  const save = async () => {
    if (saving.current) return;
    const total = Math.round(Number(amount) * 100);
    if (!name.trim() || !/^\d+(\.\d{1,2})?$/.test(amount.trim()) || !Number.isSafeInteger(total) || total <= 0) { setMessage("invalidExpense"); return; }
    saving.current = true; setBusy(true); setMessage("");
    try {
      await update((current) => ({ ...current, expenses: [...(current.expenses ?? []), { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: name.trim(), total, createdAt: new Date().toISOString() }] }));
      setName(""); setAmount(""); setMessage("saved");
    } catch { setMessage("saveFailed"); }
    finally { saving.current = false; setBusy(false); }
  };
  return <Screen back title={t("dashboard.expense")}><Field label={t("dashboard.expenseName")} value={name} onChangeText={setName} /><Field label={t("dashboard.expenseAmount")} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
    {!!message && <Text accessibilityLiveRegion="polite" style={message === "saved" ? ui.text : ui.error}>{t(message === "saved" || message === "saveFailed" ? `business.${message}` : `dashboard.${message}`)}</Text>}
    <Button title={t("dashboard.recordExpense")} disabled={busy} onPress={() => void save()} />
    {!data.expenses?.length && <Text style={ui.text}>{t("dashboard.noExpenses")}</Text>}
    {[...(data.expenses ?? [])].reverse().map((e) => <View key={e.id} style={ui.card}><Text style={ui.subtitle}>{e.name}</Text><Text style={ui.text}>{money(e.total)} · {new Date(e.createdAt).toLocaleDateString(i18n.language)}</Text></View>)}
  </Screen>;
}
