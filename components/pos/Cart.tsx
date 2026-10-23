import { Button, Field, money, useUi } from "@/components/business/Screen";
import SelectField from "@/components/ui/SelectField";
import CustomerSelector from "./CustomerSelector";
import { ClearCartButton, POSFrame, POSIssue, SummaryRow } from "./Shared";
import CartItem from "./CartItem";
import { usePOS } from "@/src/store/usePOS";
import { changeCartQuantity, setCartPriceType } from "@/src/store/pos";
import { hasWholesalePrice } from "@/src/store/productPricing";
import { sellableStock } from "@/src/store/expiry";
import CartPriceOptions from "./CartPriceOptions";
import HoldSaleButton from "./HoldSaleButton";
import { parseMoneyInput, parseQuantityInput } from "@/src/store/productUnits";
import { useTheme } from "@/src/theme/ThemeProvider";
import { router } from "expo-router";
import { ShoppingBag, UserRound } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

export default function Cart() {
  const pos = usePOS();
  const ui = useUi();
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState("cart");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [discountInput, setDiscountInput] = useState<string>();
  const [taxInput, setTaxInput] = useState<string>();
  const d = pos.draft;
  const invalidQuantity = d?.lines.some((l) => {
    const product = pos.data.products.find((p) => p.id === l.productId && !p.deletedAt);
    if (!product || sellableStock(pos.data, product.id) < l.quantity || (product.unit ?? "piece") !== l.unit) return true;
    const value = inputs[l.productId];
    if (value === undefined) return false;
    const parsed = parseQuantityInput(value, l.unit, false);
    return parsed === null || parsed !== l.quantity;
  });
  const invalidWholesale = d?.lines.some((l) => l.priceType === "wholesale" && !pos.data.products.some((p) => p.id === l.productId && !p.deletedAt && hasWholesalePrice(p)));
  const discount = discountInput === undefined ? d?.discount.value ?? 0 : parseMoneyInput(discountInput);
  const tax = taxInput === undefined ? d?.taxRate ?? 0 : parseMoneyInput(taxInput);
  const invalidRate = discount === null || tax === null || tax > 10000 || (d?.discount.kind === "percent" && discount > 10000);
  const change = (id: string, quantity: number) => {
    if (!d) return;
    void pos.run((data) => changeCartQuantity(data, d.id, id, quantity)).then((saved) => { if (saved) setInputs((old) => { const next = { ...old }; delete next[id]; return next; }); });
  };
  return <POSFrame title={t("pos.currentSale")} right={<ClearCartButton />}>
    {!d?.lines.length ? <><Text style={ui.subtitle}>{t("pos.emptyCart")}</Text><Button title={t("pos.addMore")} onPress={() => router.dismissTo("/(tabs)/sales")} /></> : <>
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: colors.border }}>{[{ id: "cart", Icon: ShoppingBag, label: `${t("pos.cart")} (${d.lines.length.toLocaleString(i18n.language)})` }, { id: "customer", Icon: UserRound, label: t("pos.customer") }].map(({ id, Icon, label }) => <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)} style={{ flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, borderBottomWidth: 2, borderBottomColor: tab === id ? colors.primary : "transparent" }}><Icon size={19} color={tab === id ? colors.primary : colors.muted} /><Text style={{ color: tab === id ? colors.primary : colors.muted, fontWeight: "600" }}>{label}</Text></Pressable>)}</View>
      {tab === "customer" ? <CustomerSelector /> : d.lines.map((l) => <CartItem key={l.productId} line={l} priceOptions={<CartPriceOptions line={l} disabled={pos.busy} onChange={(type) => { void pos.run((current) => setCartPriceType(current, d.id, l.productId, type)); }} />} value={inputs[l.productId] ?? String(l.quantity)} busy={pos.busy} onStep={(quantity) => change(l.productId, quantity)} onInput={(value) => {
        setInputs((old) => ({ ...old, [l.productId]: value }));
        const quantity = parseQuantityInput(value, l.unit, false);
        if (quantity !== null) void pos.run((data) => changeCartQuantity(data, d.id, l.productId, quantity));
      }} onRemove={() => void pos.run((data) => data.saleDraft?.id === d.id ? { ...data, saleDraft: { ...data.saleDraft, lines: data.saleDraft.lines.filter((item) => item.productId !== l.productId) } } : data)} />)}
      <Button secondary title={t("pos.addMore")} onPress={() => router.dismissTo("/(tabs)/sales")} />
      <View style={{ ...ui.card, gap: 12 }}><Text style={{ ...ui.subtitle, fontSize: 18 }}>{t("pos.bill")}</Text>
        <SelectField label={t("pos.discountType")} value={d.discount.kind} disabled={pos.busy} options={[{ id: "fixed", label: t("pos.fixed") }, { id: "percent", label: t("pos.percent") }]} onChange={(value) => { setDiscountInput(undefined); void pos.run((data) => data.saleDraft ? { ...data, saleDraft: { ...data.saleDraft, discount: { kind: value as "fixed" | "percent", value: 0 } } } : data); }} />
        <Field label={t("pos.discountValue")} value={discountInput ?? (d.discount.value / 100).toFixed(2)} keyboardType="decimal-pad" onChangeText={(value) => { setDiscountInput(value); const amount = parseMoneyInput(value); if (amount !== null && (d.discount.kind !== "percent" || amount <= 10000)) void pos.run((data) => data.saleDraft ? { ...data, saleDraft: { ...data.saleDraft, discount: { ...data.saleDraft.discount, value: amount } } } : data); }} />
        <Field label={t("pos.taxRate")} value={taxInput ?? (d.taxRate / 100).toFixed(2)} keyboardType="decimal-pad" onChangeText={(value) => { setTaxInput(value); const amount = parseMoneyInput(value); if (amount !== null && amount <= 10000) void pos.run((data) => data.saleDraft ? { ...data, saleDraft: { ...data.saleDraft, taxRate: amount } } : data); }} />
        <POSIssue issue={tax === null || tax > 10000 ? "invalidRate" : invalidRate ? "invalidDiscount" : pos.totalError} />
        {pos.totals && <><SummaryRow label={t("pos.subtotal")} value={money(pos.totals.subtotal)} /><SummaryRow label={t("pos.discount")} value={`− ${money(pos.totals.discount)}`} /><SummaryRow label={t("pos.tax")} value={money(pos.totals.tax)} /><View style={{ borderTopWidth: 1, borderColor: colors.border }}><SummaryRow label={t("pos.total")} value={money(pos.totals.total)} strong /></View></>}
      </View>
      <POSIssue issue={invalidWholesale ? "wholesaleUnavailable" : invalidQuantity ? "invalidQuantity" : pos.issue} /><Text style={ui.text}>{t("pos.draftHint")}</Text>
      <HoldSaleButton disabled={pos.busy || !pos.totals || !!invalidQuantity || invalidRate} />
      <Button title={t("pos.proceed")} disabled={pos.busy || !pos.totals || !!invalidQuantity || !!invalidWholesale || invalidRate} onPress={() => router.push("/(tabs)/sales/payment")} />
    </>}
  </POSFrame>;
}


