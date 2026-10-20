import InventorySheet from "@/components/business/InventorySheet";
import { Button, Field, money, useUi } from "@/components/business/Screen";
import { usePOS } from "@/src/store/usePOS";
import { useTheme } from "@/src/theme/ThemeProvider";
import * as Crypto from "expo-crypto";
import { Check, ChevronDown, UserRound } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { POSIssue } from "./Shared";

export default function CustomerSelector({ required = false }: { required?: boolean }) {
  const pos = usePOS();
  const ui = useUi();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const lock = useRef(false);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const customer = pos.data.customers?.find((c) => c.id === pos.draft?.customerId);
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)));
  const search = normalize(query.trim());
  const phoneSearch = search.replace(/[\s()-]/g, "");
  const matches = (pos.data.customers ?? []).filter((c) => normalize(c.name).includes(search) || !!phoneSearch && normalize(c.phone).replace(/[\s()-]/g, "").includes(phoneSearch));
  const close = () => {
    if (lock.current) return;
    setOpen(false); setAdding(false); setQuery(""); pos.setIssue("");
  };
  const select = async (id: string) => {
    if (lock.current) return;
    lock.current = true;
    try {
      const saved = await pos.run((data) => data.saleDraft ? { ...data, saleDraft: { ...data.saleDraft, customerId: id || undefined } } : data);
      if (saved) { setOpen(false); setQuery(""); }
    } finally { lock.current = false; }
  };
  const save = async () => {
    if (lock.current) return;
    const clean = normalize(phone.trim()).replace(/[\s()-]/g, "");
    if (!name.trim() || clean && !/^\+?\d{7,15}$/.test(clean)) { pos.setIssue("invalidCustomer"); return; }
    lock.current = true;
    try {
      const id = Crypto.randomUUID();
      const saved = await pos.run((data) => {
        if (clean && data.customers?.some((c) => c.phone === clean)) throw new Error("duplicateCustomer");
        return { ...data, customers: [...(data.customers ?? []), { id, name: name.trim(), phone: clean, balance: 0 }], ...(data.saleDraft ? { saleDraft: { ...data.saleDraft, customerId: id } } : {}) };
      });
      if (saved) { setOpen(false); setAdding(false); setName(""); setPhone(""); setQuery(""); }
    } finally { lock.current = false; }
  };
  return <View style={{ gap: 14 }}>
    {customer ? <View style={ui.card}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><UserRound color={colors.primary} size={22} /><Text style={[ui.subtitle, { flex: 1 }]}>{customer.name}</Text><Check color={colors.primary} size={20} /></View>
      {!!customer.phone && <Text selectable style={ui.text}>{customer.phone}</Text>}
      <Text style={ui.text}>{t("pos.customerBalance")}: {money(customer.balance ?? 0)}</Text>
    </View> : required && <Text style={ui.text}>{t("pos.customerRequired")}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel={t(customer ? "pos.changeCustomer" : "pos.selectCustomer")} disabled={pos.busy} onPress={() => { setOpen(true); setAdding(false); setQuery(""); pos.setIssue(""); }} style={{ ...ui.card, flexDirection: "row", alignItems: "center", gap: 10, borderColor: colors.primary, opacity: pos.busy ? 0.5 : 1 }}>
      <UserRound size={20} color={colors.primary} /><Text style={[ui.subtitle, { flex: 1, color: colors.primary }]}>{t(customer ? "pos.changeCustomer" : "pos.selectCustomer")}</Text><ChevronDown size={20} color={colors.primary} />
    </Pressable>
    {open && <InventorySheet title={t(adding ? "pos.addCustomer" : "pos.selectCustomer")} busy={pos.busy} onClose={close}>
      {adding ? <>
        <Field label={t("pos.customerName")} value={name} onChangeText={setName} editable={!pos.busy} autoCapitalize="words" />
        <Field label={t("pos.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!pos.busy} />
        <POSIssue issue={pos.issue} />
        <Button title={t("pos.saveCustomer")} disabled={pos.busy} onPress={() => void save()} />
        <Button secondary title={t("pos.backToCustomers")} disabled={pos.busy} onPress={() => { setAdding(false); pos.setIssue(""); }} />
      </> : <>
        <Field label={t("pos.searchCustomers")} placeholder={t("pos.searchCustomers")} value={query} onChangeText={setQuery} editable={!pos.busy} autoCorrect={false} />
        <Button secondary title={`+ ${t("pos.addCustomer")}`} disabled={pos.busy} onPress={() => { setAdding(true); pos.setIssue(""); }} />
        {!required && !search && <Button secondary title={t("pos.walkIn")} disabled={pos.busy} onPress={() => void select("")} />}
        {!matches.length && <Text style={ui.text}>{t("pos.noCustomersFound")}</Text>}
        {matches.map((c) => <Pressable key={c.id} accessibilityRole="button" accessibilityState={{ selected: c.id === customer?.id, disabled: pos.busy }} disabled={pos.busy} onPress={() => void select(c.id)} style={{ ...ui.card, flexDirection: "row", alignItems: "center", gap: 12, borderColor: c.id === customer?.id ? colors.primary : colors.border }}>
          <UserRound size={22} color={colors.primary} /><View style={{ flex: 1, gap: 4 }}><Text style={ui.subtitle}>{c.name}</Text>{!!c.phone && <Text style={ui.text}>{c.phone}</Text>}<Text style={ui.text}>{t("pos.customerBalance")}: {money(c.balance ?? 0)}</Text></View>{c.id === customer?.id && <Check size={22} color={colors.primary} />}
        </Pressable>)}
        <POSIssue issue={pos.issue} />
      </>}
    </InventorySheet>}
  </View>;
}
