import InventorySheet from "@/components/business/InventorySheet";
import { Button, Field, money, useUi } from "@/components/business/Screen";
import type { Product } from "@/src/store/business";
import { addCartProduct } from "@/src/store/pos";
import { allowsFraction, lineAmount, parseQuantityInput, quantityTicks, unitLabel } from "@/src/store/productUnits";
import { usePOS } from "@/src/store/usePOS";
import { formatNumber } from "@/src/dashboard/format";
import { useTheme } from "@/src/theme/ThemeProvider";
import * as Crypto from "expo-crypto";
import { Minus, Plus } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { POSIssue } from "./Shared";

export default function QuantityPicker({ product, onClose }: { product: Product; onClose: () => void }) {
  const pos = usePOS();
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const ui = useUi();
  const reserved = pos.draft?.lines.find((l) => l.productId === product.id);
  const remaining = Math.max(0, (quantityTicks(product.stock)! - quantityTicks(reserved?.quantity ?? 0)!) / 1000);
  const [input, setInput] = useState(String(Math.min(1, remaining)));
  const lock = useRef(false);
  const amount = parseQuantityInput(input, product.unit, false);
  const valid = amount !== null && amount <= remaining;
  const total = valid ? lineAmount(reserved?.unitPrice ?? product.price, amount) : null;
  const add = async () => {
    if (lock.current || !valid || amount === null) return;
    lock.current = true;
    if (await pos.run((data) => addCartProduct(data, product.id, Crypto.randomUUID(), amount))) onClose();
    lock.current = false;
  };
  return <InventorySheet title={product.name} busy={pos.busy} onClose={onClose}>
    <Text style={ui.text}>{t("pos.available", { quantity: formatNumber(remaining, i18n.language), unit: unitLabel(product.unit, i18n.language) })}</Text>
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
      {!allowsFraction(product.unit) && <Pressable accessibilityRole="button" accessibilityLabel={t("pos.decrease", { name: product.name })} disabled={pos.busy || amount === null || amount <= 1} onPress={() => setInput(String(amount! - 1))} style={{ width: 48, height: 50, justifyContent: "center", alignItems: "center", borderRadius: 12, backgroundColor: colors.elevated }}><Minus color={colors.primary} size={22} /></Pressable>}
      <View style={{ flex: 1 }}><Field autoFocus label={t("pos.quantity", { unit: unitLabel(product.unit, i18n.language) })} value={input} onChangeText={setInput} editable={!pos.busy} keyboardType={allowsFraction(product.unit) ? "decimal-pad" : "number-pad"} /></View>
      {!allowsFraction(product.unit) && <Pressable accessibilityRole="button" accessibilityLabel={t("pos.increase", { name: product.name })} disabled={pos.busy || amount === null || amount >= remaining} onPress={() => setInput(String(amount! + 1))} style={{ width: 48, height: 50, justifyContent: "center", alignItems: "center", borderRadius: 12, backgroundColor: colors.elevated }}><Plus color={colors.primary} size={22} /></Pressable>}
    </View>
    {!valid && <Text style={ui.error}>{t("pos.invalidQuantity")}</Text>}
    {total !== null && <Text style={ui.subtitle}>{t("pos.total")}: {money(total)}</Text>}
    <POSIssue issue={pos.issue} />
    <Button title={t("pos.addQuantity")} disabled={pos.busy || !valid || total === null} onPress={() => void add()} />
  </InventorySheet>;
}
