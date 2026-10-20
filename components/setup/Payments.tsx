import { Button, useUi } from "@/components/business/Screen";
import InventorySheet from "@/components/business/InventorySheet";
import WalletLogo from "@/components/payments/WalletLogo";
import { useBusiness } from "@/src/store/BusinessProvider";
import { emptyPaymentSettings, saveWalletAccount, type WalletMethod } from "@/src/store/paymentSettings";
import { removePaymentQr } from "@/src/store/paymentQr";
import { activateShop } from "@/src/store/shop";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { ChevronRight, CreditCard, Info, MoreVertical } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import SetupFrame from "./SetupFrame";

const methods = ["bkash", "nagad"] as const;
export default function ShopPayments({ manage = false }: { manage?: boolean }) {
  const { data, update } = useBusiness(); const { t } = useTranslation(); const ui = useUi(); const { colors } = useTheme();
  const params = useLocalSearchParams<{ list?: string }>();
  const settings = data.paymentSettings ?? emptyPaymentSettings;
  const added = methods.filter((method) => !!settings[method].phone);
  const list = manage || params.list === "1";
  const [menu, setMenu] = useState<WalletMethod>(); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const lock = useRef(false);
  const edit = (method: WalletMethod) => { setMenu(undefined); router.push({ pathname: manage ? "/settings/add-payment" : "/setup/wallet", params: { method } }); };
  const finish = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await update((current) => activateShop(current, new Date().toISOString())); }
    catch { setError(t("business.saveFailed")); }
    finally { lock.current = false; setBusy(false); }
  };
  const change = async (method: WalletMethod, remove: boolean) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    const old = settings[method];
    try {
      await update((current) => {
        const values = current.paymentSettings ?? emptyPaymentSettings;
        return { ...current, paymentSettings: saveWalletAccount(values, method, remove ? { enabled: false, phone: "" } : { ...values[method], enabled: !values[method].enabled, isDefault: false }) };
      });
      if (remove) removePaymentQr(old.qrUri);
      setMenu(undefined);
    } catch { setError(t("business.saveFailed")); }
    finally { lock.current = false; setBusy(false); }
  };
  if (!data.shopId || !data.ownerName) return <Redirect href="/setup/basic" />;
  return <SetupFrame title={t(list ? "setup.paymentMethods" : "setup.addPayments")} onBack={() => { if (!busy) { if (manage) router.dismissTo("/(tabs)/profile"); else if (list) router.replace("/setup/payments"); else router.replace("/setup/basic"); } }}
    right={list && !manage ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.setParams({ list: "0" })} style={{ paddingVertical: 10 }}><Text style={{ color: colors.primary }}>{t("setup.addNew")}</Text></Pressable> : undefined}
    footer={<>{!manage && <Button title={t(busy ? "setup.saving" : added.length ? "setup.done" : "setup.skipPayments")} disabled={busy} onPress={() => void finish()} />}{!!error && !menu && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}</>}>
    {manage && <Text style={[ui.text, { textAlign: "center" }]}>{t("setup.paymentHint")}</Text>}
    {!list && <><Text style={[ui.text, { textAlign: "center" }]}>{t("setup.paymentHint")}</Text>{methods.map((method) => <Pressable key={method} accessibilityRole="button" accessibilityLabel={t("setup.addWallet", { method: t(`pos.${method}`) })} disabled={busy} onPress={() => edit(method)} style={{ ...ui.card, flexDirection: "row", gap: 14, alignItems: "center" }}><WalletLogo method={method} width={48} height={42} /><View style={{ flex: 1 }}><Text style={ui.subtitle}>{t(`pos.${method}`)}</Text><Text style={ui.text}>{t("setup.addWallet", { method: t(`pos.${method}`) })}</Text></View><ChevronRight color={colors.muted} size={22} /></Pressable>)}<Text style={ui.subtitle}>{t("setup.addedMethods")}</Text></>}
    {!added.length ? <View style={[ui.card, { alignItems: "center", paddingVertical: 38, gap: 14 }]}><CreditCard size={36} color={colors.muted} /><Text style={[ui.text, { textAlign: "center" }]}>{t("setup.noMethods")}</Text></View> : added.map((method) => <View key={method} style={{ ...ui.card, flexDirection: "row", alignItems: "center", gap: 12 }}><WalletLogo method={method} width={42} height={40} /><View style={{ flex: 1, gap: 3 }}><Text style={ui.subtitle}>{t(`pos.${method}`)}</Text><Text selectable style={ui.text}>{settings[method].phone}</Text>{!!settings[method].accountName && <Text style={ui.text}>{settings[method].accountName}</Text>}{settings[method].isDefault && <Text style={{ color: colors.primary, fontSize: 11 }}>{t("profileSettings.default")}</Text>}</View><View style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: settings[method].enabled ? colors.successSoft : colors.elevated }}><Text style={{ color: settings[method].enabled ? colors.success : colors.muted, fontSize: 11 }}>{t(settings[method].enabled ? "setup.active" : "setup.inactive")}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={t("setup.manageWallet", { method: t(`pos.${method}`) })} disabled={busy} onPress={() => setMenu(method)} style={{ minWidth: 36, minHeight: 44, alignItems: "center", justifyContent: "center" }}><MoreVertical color={colors.muted} size={20} /></Pressable></View>)}
    {manage && <Button secondary title={`+ ${t("profileSettings.addPayment")}`} disabled={busy} onPress={() => router.push("/settings/add-payment")} />}
    <View style={[ui.card, { backgroundColor: colors.primarySoft, borderWidth: 0, flexDirection: "row", gap: 12 }]}><Info size={21} color={colors.primary} /><Text style={[ui.text, { flex: 1 }]}>{t("setup.paymentInfo")}</Text></View>
    {menu && <InventorySheet title={t(`pos.${menu}`)} busy={busy} onClose={() => setMenu(undefined)}><Button title={t("setup.editMethod")} onPress={() => edit(menu)} disabled={busy} /><Button secondary title={t(settings[menu].enabled ? "setup.disable" : "setup.enable")} onPress={() => void change(menu, false)} disabled={busy} /><Button secondary title={t("setup.removeMethod")} onPress={() => void change(menu, true)} disabled={busy} />{!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}</InventorySheet>}
  </SetupFrame>;
}

