import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { CartLine } from "@/src/store/pos";
import { hasWholesalePrice, type PriceType } from "@/src/store/productPricing";
import { useBusiness } from "@/src/store/BusinessProvider";
import { Button, useUi } from "@/components/business/Screen";
import PriceSelector from "./PriceSelector";
export default function CartPriceOptions({ line, disabled, onChange }: { line: CartLine; disabled?: boolean; onChange: (type: PriceType) => void }) {
  const { data } = useBusiness(); const { t } = useTranslation(); const ui = useUi();
  const product = data.products.find((p) => p.id === line.productId && !p.deletedAt);
  if (!product) return null;
  if (!hasWholesalePrice(product)) return line.priceType === "wholesale" ? <View style={{ gap: 8 }}><Text style={ui.error}>{t("selling.wholesaleUnavailable")}</Text><Button secondary title={t("selling.retail")} disabled={disabled} onPress={() => onChange("retail")} /></View> : null;
  const type = line.priceType ?? "retail";
  return <PriceSelector value={type} retailPrice={type === "retail" ? line.unitPrice : product.price} wholesalePrice={type === "wholesale" ? line.unitPrice : product.wholesalePrice!} unit={line.unit} disabled={disabled} onChange={onChange} />;
}
