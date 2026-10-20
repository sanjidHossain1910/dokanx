import { Button, Field, money, useUi } from "@/components/business/Screen";
import CustomerSelector from "./CustomerSelector";
import { POSFrame, POSIssue, SummaryRow } from "./Shared";
import { usePOS } from "@/src/store/usePOS";
import { completeSale, quickAmounts, type PaymentMethod } from "@/src/store/pos";
import { parseMoneyInput } from "@/src/store/productUnits";
import { useTheme } from "@/src/theme/ThemeProvider";
import { router } from "expo-router";
import WalletLogo from "@/components/payments/WalletLogo";
import QrPreview from "@/components/payments/QrPreview";
import { Banknote, HandCoins } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import Animated, { LinearTransition, ReduceMotion } from "react-native-reanimated";

const METHODS = [{ id: "cash", Icon: Banknote }, { id: "bkash", Icon: Banknote }, { id: "nagad", Icon: Banknote }, { id: "due", Icon: HandCoins }] as const;
export default function PaymentScreen() {
  const pos = usePOS();
  const { colors } = useTheme();
  const ui = useUi();
  const { t } = useTranslation();
  const [method, setMethod] = useState<PaymentMethod>(() => pos.data.paymentSettings?.bkash.enabled && pos.data.paymentSettings.bkash.isDefault ? "bkash" : pos.data.paymentSettings?.nagad.enabled && pos.data.paymentSettings.nagad.isDefault ? "nagad" : "cash");
  const [receivedInput, setReceivedInput] = useState<string>();
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const methods = METHODS.filter(({ id }) => id !== "bkash" && id !== "nagad" || pos.data.paymentSettings?.[id].enabled);
  const wallet = method === "bkash" || method === "nagad" ? pos.data.paymentSettings?.[method] : undefined;
  const lock = useRef(false);
  const total = pos.totals?.total ?? 0;
  const receivedText = receivedInput ?? (method === "due" ? "0" : (total / 100).toFixed(2));
  const received = parseMoneyInput(receivedText);
  const due = method === "due" && received !== null ? Math.max(0, total - received) : 0;
  const change = method === "cash" && received !== null ? Math.max(0, received - total) : 0;
  const valid = methods.some(({ id }) => id === method) && received !== null && (method === "cash" ? received >= total : method === "due" ? received <= total && !!pos.draft?.customerId : received === total);
  const complete = async () => {
    if (lock.current || !pos.draft || !pos.totals) return;
    if (!valid || received === null) { pos.setIssue(method === "due" && !pos.draft.customerId ? "customerRequired" : "invalidPayment"); return; }
    lock.current = true;
    const id = pos.draft.id;
    const saved = await pos.run((data) => completeSale(data, id, { method, received, note: note.trim(), reference: reference.trim(), createdAt: new Date().toISOString() }));
    if (saved) router.replace({ pathname: "/(tabs)/sales/receipt", params: { saleId: id, success: "1" } });
    lock.current = false;
  };
  return <POSFrame title={t("pos.payment")}>
    {!pos.draft?.lines.length ? <><Text style={ui.subtitle}>{t("pos.emptyCart")}</Text><Button title={t("pos.newSale")} onPress={() => router.dismissTo("/(tabs)/sales")} /></> : <>
      <View style={{ ...ui.card, backgroundColor: colors.elevated }}><SummaryRow label={t("pos.totalAmount")} value={money(total)} strong /></View>
      <Text style={ui.subtitle}>{t(method === "cash" ? "pos.quickAmount" : method === "due" ? "pos.paid" : "pos.received")}</Text>
      <Field label={t("pos.customAmount")} value={receivedText} keyboardType="decimal-pad" onChangeText={setReceivedInput} editable={!pos.busy} />
      {method === "cash" && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{quickAmounts(total).map((amount) => <Pressable key={amount} accessibilityRole="button" accessibilityLabel={money(amount)} disabled={pos.busy} onPress={() => setReceivedInput((amount / 100).toFixed(2))} style={{ width: "30%", flexGrow: 1, padding: 12, minHeight: 48, alignItems: "center", borderRadius: 12, backgroundColor: received === amount ? colors.primary : colors.elevated }}><Text style={{ color: received === amount ? colors.onPrimary : colors.text, fontWeight: "600", fontSize: 14 }}>{money(amount)}</Text></Pressable>)}</View>}
      <Text style={ui.subtitle}>{t("pos.method")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{methods.map(({ id, Icon }) => <Animated.View key={id} layout={LinearTransition.duration(150).reduceMotion(ReduceMotion.System)} style={{ flexGrow: 1, flexBasis: "28%" }}><Pressable accessibilityRole="button" accessibilityLabel={t(`pos.${id}`)} accessibilityState={{ selected: method === id }} disabled={pos.busy} onPress={() => { setMethod(id); setReceivedInput(undefined); pos.setIssue(""); }} style={{ minHeight: 90, alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 16, borderWidth: 1.5, borderColor: method === id ? colors.primary : colors.border, backgroundColor: method === id ? colors.primarySoft : colors.card }}>{id === "bkash" || id === "nagad" ? <WalletLogo method={id} /> : <Icon size={28} color={method === id ? colors.primary : colors.muted} />}<Text style={{ color: method === id ? colors.primary : colors.text, fontSize: 12, fontWeight: "600" }}>{t(`pos.${id}`)}</Text></Pressable></Animated.View>)}</View>
      {wallet?.enabled && <View style={ui.card}>
        <Text style={ui.subtitle}>{t("pos.payToWallet", { method: t(`pos.${method}`) })}</Text>
        <Text selectable style={[ui.subtitle, { color: colors.primary, fontSize: 22 }]}>{wallet.phone}</Text>
        {wallet.qrUri && <QrPreview uri={wallet.qrUri} label={t("pos.walletQr", { method: t(`pos.${method}`) })} number={wallet.phone} />}
        <Text style={ui.text}>{t("pos.walletPayHint")}</Text>
      </View>}
      {method === "due" ? <><Text style={ui.text}>{t("pos.dueHint")}</Text><CustomerSelector required /></> : method !== "cash" && <Text style={ui.text}>{t("pos.manualHint")}</Text>}
      <SummaryRow label={t(method === "due" ? "pos.remaining" : "pos.change")} value={money(method === "due" ? due : change)} strong positive={method !== "due"} />
      {method !== "cash" && method !== "due" && <><Text style={ui.text}>{t("pos.exactHint")}</Text><Field label={t("pos.reference")} value={reference} onChangeText={setReference} editable={!pos.busy} /></>}
      <Field label={t("pos.note")} value={note} onChangeText={setNote} multiline editable={!pos.busy} />
      <POSIssue issue={pos.issue || pos.totalError} />
      <Button title={t(pos.busy ? "pos.saving" : "pos.complete")} disabled={pos.busy || !pos.totals || !valid} onPress={() => void complete()} />
    </>}
  </POSFrame>;
}
