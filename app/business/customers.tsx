import { Button, Field, money, Screen, useUi } from "@/components/business/Screen";
import { useBusiness } from "@/src/store/BusinessProvider";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { router } from "expo-router";

export default function Customers() {
  const ui = useUi();
  const { data, update } = useBusiness();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const saving = useRef(false);
  const save = async () => {
    if (saving.current) return;
    const cleanPhone = phone.trim().replace(/[\s()-]/g, "");
    if (!name.trim() || (cleanPhone && !/^\+?\d{7,15}$/.test(cleanPhone))) { setMessage("invalidCustomer"); return; }
    saving.current = true;
    setBusy(true);
    setMessage("");
    try {
      await update((current) => {
        if (cleanPhone && current.customers?.some((c) => c.phone === cleanPhone)) throw new Error("duplicateCustomer");
        return { ...current, customers: [...(current.customers ?? []), { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: name.trim(), phone: cleanPhone }] };
      });
      setName(""); setPhone(""); setMessage("saved");
    } catch (cause) { setMessage(cause instanceof Error && cause.message === "duplicateCustomer" ? "duplicateCustomer" : "saveFailed"); }
    finally { saving.current = false; setBusy(false); }
  };
  return <Screen back title={t("dashboard.customers")}>
    <Button secondary title={t("flows.customers")} onPress={() => router.push("/business/customer")} />
    <Field label={t("dashboard.customerName")} value={name} onChangeText={setName} /><Field label={t("dashboard.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
    {!!message && <Text accessibilityLiveRegion="polite" style={message === "saved" ? ui.text : ui.error}>{t(message === "saved" || message === "saveFailed" ? `business.${message}` : `dashboard.${message}`)}</Text>}
    <Button title={t("dashboard.addCustomer")} disabled={busy} onPress={() => void save()} />
    {!data.customers?.length && <Text style={ui.text}>{t("dashboard.noCustomers")}</Text>}
    {data.customers?.map((c) => <View key={c.id} style={ui.card}><Text style={ui.subtitle}>{c.name}</Text>{!!c.phone && <Text style={ui.text}>{c.phone}</Text>}<Text style={ui.text}>{t("pos.customerBalance")}: {money(c.balance ?? 0)}</Text><Button secondary title={t("flows.history")} onPress={() => router.push({ pathname: "/business/customer", params: { id: c.id } })} /></View>)}
  </Screen>;
}
