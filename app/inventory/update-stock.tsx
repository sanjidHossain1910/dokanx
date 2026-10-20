import { Button, Field, Screen, useUi } from "@/components/business/Screen";
import SelectField from "@/components/ui/SelectField";
import { useBusiness } from "@/src/store/BusinessProvider";
import { adjustStock, stockResult, type StockMovement } from "@/src/store/inventory";
import { allowsFraction, parseQuantityInput, unitLabel } from "@/src/store/productUnits";
import { formatNumber } from "@/src/dashboard/format";
import { useTheme } from "@/src/theme/ThemeProvider";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

export default function UpdateStock() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const { data, update } = useBusiness();
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const ui = useUi();
  const p = data.products.find((item) => item.id === productId && !item.deletedAt);
  const [kind, setKind] = useState<StockMovement["kind"]>("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const saving = useRef(false);
  const parsed = parseQuantityInput(quantity, p?.unit, kind === "set");
  const preview = p && parsed !== null ? stockResult(p.stock, parsed, kind, p.unit) : null;
  const save = async () => {
    if (saving.current || !p) return;
    if (parsed === null || preview === null) { setMessage("inventory.invalidAdjustment"); return; }
    saving.current = true; setBusy(true); setMessage("");
    try {
      await update((current) => adjustStock(current, { id: Crypto.randomUUID(), productId: p.id, kind, quantity: parsed, reason: reason.trim(), notes: notes.trim(), createdAt: new Date().toISOString() }));
      router.dismissTo({ pathname: "/inventory/product", params: { productId: p.id, saved: "stock" } });
    } catch (cause) { setMessage(cause instanceof Error && cause.message === "invalidAdjustment" ? "inventory.invalidAdjustment" : "business.saveFailed"); }
    finally { saving.current = false; setBusy(false); }
  };
  if (!p) return <Screen back title={t("inventory.updateStock")}><Text style={ui.text}>{t("inventory.missing")}</Text></Screen>;
  const unit = unitLabel(p.unit, i18n.language);
  return <Screen back title={t("inventory.updateStock")} description={p.name}>
    <View style={ui.card}><Text style={ui.text}>{t("inventory.stock")}</Text><Text style={{ color: colors.text, fontSize: 28, lineHeight: 38, fontWeight: "700" }}>{formatNumber(p.stock, i18n.language)} {unit}</Text></View>
    <SelectField label={t("inventory.adjustment")} value={kind} disabled={busy} onChange={(value) => { setKind(value as StockMovement["kind"]); setMessage(""); }} options={[{ id: "add", label: t("inventory.addStock") }, { id: "remove", label: t("inventory.removeStock") }, { id: "set", label: t("inventory.setStock") }]} />
    <Field label={`${t("inventory.quantity")} (${unit}) *`} value={quantity} onChangeText={setQuantity} keyboardType={allowsFraction(p.unit) ? "decimal-pad" : "number-pad"} editable={!busy} />
    <Text style={ui.text}>{t(allowsFraction(p.unit) ? "business.fractionalQuantityHint" : "business.wholeQuantityHint", { unit })}</Text>
    <View style={{ ...ui.card, backgroundColor: colors.primarySoft }}><Text style={ui.text}>{t("inventory.newStock")}</Text><Text accessibilityLiveRegion="polite" style={{ ...ui.subtitle, color: colors.primary }}>{preview === null ? "—" : `${formatNumber(preview, i18n.language)} ${unit}`}</Text></View>
    <Field label={t("inventory.reason")} value={reason} onChangeText={setReason} editable={!busy} /><Field label={t("inventory.notes")} value={notes} onChangeText={setNotes} multiline editable={!busy} />
    {!!message && <Text accessibilityRole="alert" style={ui.error}>{t(message)}</Text>}
    <Button title={t(busy ? "business.savingProduct" : "inventory.saveAdjustment")} disabled={busy} onPress={() => void save()} />
  </Screen>;
}
