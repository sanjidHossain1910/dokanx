import { memo, useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { Minus, Plus, Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/src/theme/ThemeProvider";
import type { Product } from "@/src/store/business";
import type { CartLine } from "@/src/store/pos";
import { hasWholesalePrice, type PriceType } from "@/src/store/productPricing";
import { allowsFraction, lineAmount, parseQuantityInput, unitLabel } from "@/src/store/productUnits";
import { saleCardStep } from "@/src/store/inlineCart";
import { stockStatus } from "@/src/store/inventory";
import { formatNumber } from "@/src/dashboard/format";
import { money } from "@/components/business/Screen";
import { ProductPhoto } from "./Shared";

type Props = { product: Product; width: number; line?: CartLine; expanded: boolean; disabled: boolean; onQuantity: (id: string, quantity: number, type?: PriceType) => Promise<boolean>; onFavorite: (id: string, favorite: boolean) => void; onEditing: (id: string, editing: boolean) => void };
export default memo(function SaleProductCard({ product, width, line, expanded, disabled, onQuantity, onFavorite, onEditing }: Props) {
  const { colors, isDark } = useTheme(); const { t, i18n } = useTranslation();
  const [input, setInput] = useState<string>(); const [issue, setIssue] = useState("");
  const lock = useRef(false), skipEnd = useRef(false); const inputRef = useRef<TextInput>(null);
  const quantity = line?.quantity ?? 0, unit = unitLabel(product.unit, i18n.language), mode = line?.priceType ?? "retail";
  const value = input ?? String(quantity), parsed = parseQuantityInput(value, product.unit);
  const price = line?.unitPrice ?? product.price;
  const total = parsed === null ? null : lineAmount(price, parsed);
  const wholesale = hasWholesalePrice(product), open = expanded || !!line;
  const favoriteDisabled = disabled || input !== undefined;
  const state = stockStatus(product);
  const stockColor = state === "out" ? colors.danger : state === "low" ? isDark ? colors.warning : "#92400E" : isDark ? colors.success : "#15803D";
  useEffect(() => () => onEditing(product.id, false), [onEditing, product.id]);
  useEffect(() => { if (expanded) inputRef.current?.focus(); }, [expanded]);
  const reset = () => { skipEnd.current = true; Keyboard.dismiss(); setInput(undefined); setIssue(""); onEditing(product.id, false); };
  const save = async (amount: number | null, type?: PriceType) => {
    if (lock.current) return;
    if (line && amount === quantity && (type === undefined || type === mode)) { setInput(undefined); setIssue(""); onEditing(product.id, false); return; }
    if (disabled) return;
    if (amount === null || amount > product.stock) { setIssue("invalidQuantity"); onEditing(product.id, true); return; }
    lock.current = true; setIssue(""); onEditing(product.id, true);
    try {
      if (await onQuantity(product.id, amount, type)) { setInput(undefined); onEditing(product.id, false); }
      else setIssue("saveFailed");
    } finally { lock.current = false; }
  };
  const step = (direction: -1 | 1) => {
    skipEnd.current = true; Keyboard.dismiss();
    const next = saleCardStep(parsed ?? quantity, product.stock, product.unit, direction);
    setInput(String(next)); void save(next);
  };
  return <Animated.View entering={FadeIn.duration(120).reduceMotion(ReduceMotion.System)} style={{ width, alignSelf: "flex-start", borderWidth: 1, borderColor: line ? colors.primary : colors.border, backgroundColor: colors.card, borderRadius: 14, padding: 8, gap: 3 }}>
    <View style={{ alignItems: "center", marginBottom: 2 }}><ProductPhoto uri={product.photoUri} name={product.name} size={Math.max(40, width - 18)} /></View>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!product.isFavorite, disabled: favoriteDisabled }} accessibilityLabel={t(product.isFavorite ? "selling.removeFavorite" : "selling.addFavorite", { name: product.name })} disabled={favoriteDisabled} onPress={() => onFavorite(product.id, !product.isFavorite)} style={{ position: "absolute", top: 0, right: 0, width: 44, height: 44, zIndex: 1, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.5 : 1 }}><Star size={21} strokeWidth={1.8} color={product.isFavorite ? "#F5A800" : colors.muted} fill={product.isFavorite ? "#F5A800" : "transparent"} /></Pressable>
    <Text numberOfLines={2} style={{ fontSize: 13, lineHeight: 18, fontWeight: "600", color: colors.text }}>{product.name}</Text>
    <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: "700" }}>{money(price)}<Text style={{ fontSize: 11, fontWeight: "400", color: colors.muted }}> / {unit}</Text></Text>
    <Text style={{ color: stockColor, fontSize: 11, lineHeight: 16 }}>{product.stock ? t("pos.available", { quantity: formatNumber(product.stock, i18n.language), unit }) : t("pos.out")}</Text>
    {!open ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Text style={{ flex: 1, color: colors.muted, fontSize: 11 }}>{unit}</Text><Pressable accessibilityRole="button" accessibilityLabel={t("pos.add", { name: product.name })} disabled={disabled || product.stock <= 0} onPress={() => { void save(Math.min(1, product.stock)); }} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: disabled || product.stock <= 0 ? 0.4 : 1 }}><View style={{ backgroundColor: colors.primary, borderRadius: 18, padding: 6 }}><Plus size={22} color={colors.onPrimary} /></View></Pressable></View> : <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 5, marginTop: 2, gap: 4 }}>
      {wholesale && <View accessibilityRole="radiogroup" accessibilityLabel={t("selling.pricingHint")} style={{ flexDirection: "row", gap: 3 }}>{(["retail", "wholesale"] as const).map((type) => <Pressable key={type} accessibilityRole="radio" accessibilityState={{ checked: mode === type, disabled }} disabled={disabled} onPress={() => { skipEnd.current = true; Keyboard.dismiss(); void save(parsed, type); }} style={{ flex: 1, minHeight: 36, justifyContent: "center", alignItems: "center", borderRadius: 7, backgroundColor: mode === type ? colors.primary : colors.elevated, opacity: disabled ? 0.5 : 1 }}><Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 11, color: mode === type ? colors.onPrimary : colors.text }}>{t(`selling.${type}`)}</Text></Pressable>)}</View>}
      {!wholesale && mode === "wholesale" && <Pressable disabled={disabled} onPress={() => { void save(parsed, "retail"); }} style={{ minHeight: 36, justifyContent: "center" }}><Text style={{ fontSize: 11, color: colors.danger }}>{t("selling.wholesaleUnavailable")}</Text></Pressable>}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("pos.decrease", { name: product.name })} disabled={disabled || (parsed ?? quantity) <= 0} onPress={() => step(-1)} style={{ width: 34, height: 44, justifyContent: "center", alignItems: "center", opacity: disabled || (parsed ?? quantity) <= 0 ? 0.4 : 1 }}><Minus size={20} color={colors.primary} /></Pressable>
        <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", backgroundColor: colors.elevated, borderRadius: 8, paddingHorizontal: 4 }}><TextInput ref={inputRef} accessibilityLabel={t("pos.quantity", { unit })} value={value} editable={!disabled} selectTextOnFocus keyboardType={allowsFraction(product.unit) ? "decimal-pad" : "number-pad"} keyboardAppearance={isDark ? "dark" : "light"} returnKeyType="done" submitBehavior="blurAndSubmit" onFocus={() => { skipEnd.current = false; onEditing(product.id, true); }} onChangeText={(text) => { setInput(text); setIssue(""); onEditing(product.id, true); }} onEndEditing={(event) => { if (skipEnd.current) { skipEnd.current = false; return; } void save(parseQuantityInput(event.nativeEvent.text, product.unit)); }} style={{ flex: 1, minWidth: 0, height: 44, padding: 0, textAlign: "center", color: colors.text, fontSize: 14, fontWeight: "600" }} /><Text numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: 38, color: colors.muted, fontSize: 10 }}>{unit}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={t("pos.increase", { name: product.name })} disabled={disabled || (parsed ?? quantity) >= product.stock} onPress={() => step(1)} style={{ width: 34, height: 44, justifyContent: "center", alignItems: "center", opacity: disabled || (parsed ?? quantity) >= product.stock ? 0.4 : 1 }}><Plus size={20} color={colors.primary} /></Pressable>
      </View>
      <Text style={{ color: colors.primary, fontSize: 12, lineHeight: 17, fontWeight: "600", textAlign: "center" }}>{t("pos.total")}: {total === null ? "—" : money(total)}</Text>
    </View>}
    {!!issue && <View><Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 11, lineHeight: 16 }}>{t(`pos.${issue}`)}</Text><Pressable accessibilityRole="button" accessibilityLabel={t("selling.resetQuantity")} onPress={reset} style={{ minHeight: 36, justifyContent: "center" }}><Text style={{ color: colors.primary, fontSize: 11 }}>{t("selling.resetQuantity")}</Text></Pressable></View>}
  </Animated.View>;
});
