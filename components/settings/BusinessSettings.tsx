import { Button, Field, Screen, useUi } from "@/components/business/Screen";
import InventorySheet from "@/components/business/InventorySheet";
import { useBusiness } from "@/src/store/BusinessProvider";
import { amountVisibilitySettings, defaultBusinessSettings, formatBusinessDate, validBusinessSettings, type BusinessSettings as Preferences } from "@/src/store/businessSettings";
import { parseMoneyInput, parseQuantityInput } from "@/src/store/productUnits";
import { useTheme } from "@/src/theme/ThemeProvider";
import { router } from "expo-router";
import { EyeOff, ShieldCheck, BellRing, CalendarDays, CircleDollarSign, Folder, Percent, ReceiptText, Ruler } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Switch, Text, View } from "react-native";
import MenuRow from "./MenuRow";

type Panel = "invoice" | "currency" | "discount" | "stock" | "date" | "amountPrivacy";
export default function BusinessSettings() {
  const { data, update } = useBusiness(); const { t, i18n } = useTranslation(); const ui = useUi(); const { colors } = useTheme();
  const settings = data.businessSettings ?? defaultBusinessSettings;
  const [seconds, setSeconds] = useState("20");
  const privacy = amountVisibilitySettings(settings);
  const [panel, setPanel] = useState<Panel>(); const [draft, setDraft] = useState(settings); const [discount, setDiscount] = useState(""); const [stock, setStock] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const open = (id: Panel) => { setDraft(settings); setSeconds(String(privacy.seconds)); setDiscount(String(settings.defaultDiscountPercent / 100)); setStock(String(settings.lowStockDefault)); setError(""); setPanel(id); };
  const save = async () => {
    if (busy) return;
    const percent = parseMoneyInput(discount), limit = parseQuantityInput(stock, "piece");
    const next: Preferences = { ...draft, invoicePrefix: draft.invoicePrefix.trim().toUpperCase(), receiptFooter: draft.receiptFooter.trim(), defaultDiscountPercent: percent ?? -1, lowStockDefault: limit ?? -1, ...(panel === "amountPrivacy" ? { amountHideSeconds: draft.hideAmounts === false ? privacy.seconds : parseQuantityInput(seconds, "piece") ?? -1 } : {}) };
    if (!validBusinessSettings(next)) { setError(t(panel === "amountPrivacy" ? "profileSettings.invalidAmountSeconds" : "profileSettings.invalidSettings")); return; }
    setBusy(true); setError("");
    try { await update((current) => ({ ...current, businessSettings: next })); setPanel(undefined); }
    catch { setError(t("business.saveFailed")); }
    finally { setBusy(false); }
  };
  return <Screen back title={t("profileSettings.businessSettings")} fallbackHref="/(tabs)/profile">
    <MenuRow title={t("profileSettings.amountPrivacy")} subtitle={t(privacy.enabled ? "profileSettings.amountPrivacyOn" : "profileSettings.amountPrivacyOff", { seconds: privacy.seconds.toLocaleString(i18n.language) })} Icon={EyeOff} color={colors.primary} onPress={() => open("amountPrivacy")} />
    <MenuRow title={t("security.title")} subtitle={t("security.menuHint")} Icon={ShieldCheck} onPress={() => router.push("/settings/security")} />
    <MenuRow title={t("profileSettings.units")} subtitle={t("profileSettings.unitsHint")} Icon={Ruler} color="#3B82F6" onPress={() => router.push("/settings/units")} />
    <MenuRow title={t("inventory.manageCategories")} subtitle={t("profileSettings.categoriesHint")} Icon={Folder} color="#F59E0B" onPress={() => router.push("/inventory/categories")} />
    <MenuRow title={t("profileSettings.invoice")} subtitle={t("profileSettings.invoiceHint")} Icon={ReceiptText} color="#6366F1" onPress={() => open("invoice")} />
    <MenuRow title={t("profileSettings.currency")} subtitle={t("profileSettings.bdt")} Icon={CircleDollarSign} color="#64745D" onPress={() => open("currency")} />
    <MenuRow title={t("profileSettings.discount")} subtitle={t("profileSettings.discountHint")} Icon={Percent} color="#F43F5E" onPress={() => open("discount")} />
    <MenuRow title={t("profileSettings.stock")} subtitle={t("profileSettings.stockHint")} Icon={BellRing} color="#F59E0B" onPress={() => open("stock")} />
    <MenuRow title={t("profileSettings.date")} subtitle={t("profileSettings.dateHint")} Icon={CalendarDays} color="#22C55E" onPress={() => open("date")} />
    {panel && <InventorySheet title={t(`profileSettings.${panel}`)} busy={busy} onClose={() => setPanel(undefined)}>
      {panel === "amountPrivacy" && <>
        <View style={ui.row}><Text style={[ui.subtitle, { flex: 1 }]}>{t("profileSettings.hideAmounts")}</Text><Switch accessibilityLabel={t("profileSettings.hideAmounts")} disabled={busy} value={draft.hideAmounts !== false} onValueChange={hideAmounts => setDraft({ ...draft, hideAmounts })} trackColor={{ true: colors.primary }} /></View>
        <Text style={ui.text}>{t("profileSettings.amountPrivacyHint")}</Text>
        {draft.hideAmounts !== false && <>
          <Field label={t("profileSettings.amountSeconds")} value={seconds} onChangeText={setSeconds} keyboardType="number-pad" editable={!busy} maxLength={4} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{[10, 20, 30, 60].map(value => <Pressable key={value} disabled={busy} accessibilityRole="button" accessibilityState={{ selected: parseQuantityInput(seconds, "piece") === value }} onPress={() => setSeconds(String(value))} style={{ minHeight: 44, padding: 10, borderRadius: 10, backgroundColor: parseQuantityInput(seconds, "piece") === value ? colors.primarySoft : colors.elevated }}><Text style={{ color: colors.text }}>{t("profileSettings.secondsOption", { seconds: value.toLocaleString(i18n.language) })}</Text></Pressable>)}</View>
          <Text style={ui.text}>{t("profileSettings.amountSecondsHint")}</Text>
        </>}
        <Text style={ui.text}>{t("profileSettings.amountSecurityHint")}</Text>
      </>}
      {panel === "invoice" && <><Field label={t("profileSettings.prefix")} value={draft.invoicePrefix} onChangeText={(invoicePrefix) => setDraft({ ...draft, invoicePrefix })} autoCapitalize="characters" maxLength={12} editable={!busy} /><Text style={ui.text}>{t("flows.fixedFooter")}</Text><Text style={ui.text}>{t("profileSettings.futureInvoices")}</Text></>}
      {panel === "currency" && <><Text style={ui.subtitle}>{t("profileSettings.bdt")}</Text><Text style={ui.text}>{t("profileSettings.currencyHint")}</Text></>}
      {panel === "discount" && <><Field label={t("profileSettings.defaultDiscount")} value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" editable={!busy} /><Text style={ui.text}>{t("profileSettings.newSalesOnly")}</Text></>}
      {panel === "stock" && <><Field label={t("profileSettings.defaultStock")} value={stock} onChangeText={setStock} keyboardType="number-pad" editable={!busy} /><Text style={ui.text}>{t("profileSettings.newProductsOnly")}</Text></>}
      {panel === "date" && <><View accessibilityRole="radiogroup" accessibilityLabel={t("profileSettings.date")}>{(["locale", "dmy", "ymd"] as const).map((dateFormat) => <Pressable key={dateFormat} disabled={busy} accessibilityRole="radio" aria-checked={draft.dateFormat === dateFormat} accessibilityState={{ checked: draft.dateFormat === dateFormat }} onPress={() => setDraft({ ...draft, dateFormat })} style={{ ...ui.card, marginBottom: 10, backgroundColor: draft.dateFormat === dateFormat ? colors.primarySoft : colors.card }}><Text style={ui.subtitle}>{t(`profileSettings.${dateFormat}`)}</Text></Pressable>)}</View><View style={ui.row}><Text style={[ui.subtitle, { flex: 1 }]}>{t("profileSettings.hour12")}</Text><Switch accessibilityLabel={t("profileSettings.hour12")} disabled={busy} value={draft.hour12} onValueChange={(hour12) => setDraft({ ...draft, hour12 })} trackColor={{ true: colors.primary }} /></View><Text style={ui.text}>{formatBusinessDate(new Date(), i18n.language, draft)}</Text></>}
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      <Button title={t(panel === "currency" ? "profileSettings.close" : "business.save")} disabled={busy} onPress={() => panel === "currency" ? setPanel(undefined) : void save()} />
    </InventorySheet>}
  </Screen>;
}


