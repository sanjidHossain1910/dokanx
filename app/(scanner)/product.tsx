import { Button, money, Screen, useUi } from "@/components/business/Screen";
import { useBusiness } from "@/src/store/BusinessProvider";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";
import { useEffect, useState } from "react";
import type { Product as ProductRecord } from "@/src/store/business";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useScanFeedback } from "@/src/scanner/ScanFeedbackProvider";
import { unitLabel } from "@/src/store/productUnits";
import { formatNumber } from "@/src/dashboard/format";
import { Image } from "expo-image";
import SquareFrame from "@/components/ui/SquareFrame";

export default function Product() {
  const ui = useUi();
  const { barcode, scanId } = useLocalSearchParams<{ barcode?: string; scanId?: string }>();
  const code = typeof barcode === "string" ? barcode : "";
  const { data, ready, error } = useBusiness();
  const { colors } = useTheme();
  const feedback = useScanFeedback();
  const [lookup, setLookup] = useState<{ code: string; products: ProductRecord[]; product?: ProductRecord }>();
  const { t, i18n } = useTranslation();
  useEffect(() => {
    if (typeof scanId === "string") feedback(scanId);
  }, [scanId, feedback]);
  useEffect(() => {
    if (!ready || error) return;
    // Start lookup after the product screen mounts; no camera stays open for this work.
    const task = requestAnimationFrame(() => {
      const product = code ? data.products.find((item) => !item.deletedAt && (item.barcode === code || item.id === code)) : undefined;
      console.info("[barcode] product lookup", { barcode: code, found: !!product, productId: product?.id });
      setLookup({ code, products: data.products, product });
    });
    return () => cancelAnimationFrame(task);
  }, [code, data.products, ready, error]);
  const loading = lookup?.code !== code || lookup?.products !== data.products;
  const product = loading ? undefined : lookup?.product;
  return <Screen back title={t(product ? "business.found" : "business.productDetails")}>
    {!!code && <Text style={ui.text}>{t("business.barcode")}: {code}</Text>}
    {loading ? <View accessibilityLiveRegion="polite" style={{ paddingVertical: 40, gap: 12, alignItems: "center" }}>
      <ActivityIndicator color={colors.primary} accessibilityLabel={t("business.findingProduct")} />
      <Text style={ui.text}>{t("business.findingProduct")}</Text>
    </View> : product ? <View style={ui.card}>
      {!!product.photoUri && <SquareFrame style={{ borderRadius: 12 }}><Image source={{ uri: product.photoUri }} contentFit="cover" accessibilityLabel={product.name} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} /></SquareFrame>}
      <Text style={ui.title}>{product.name}</Text>
      <Text selectable style={ui.text}>{t("business.productId")}: {product.id}</Text>
      <Text style={ui.text}>{money(product.price)} / {unitLabel(product.unit, i18n.language)} · {t("business.stock")}: {formatNumber(product.stock, i18n.language)} {unitLabel(product.unit, i18n.language)}</Text>
      <Button disabled={product.stock === 0} title={t(product.stock === 0 ? "business.outOfStock" : "business.newSale")} onPress={() => router.replace({ pathname: "/(tabs)/sales", params: { productId: product.id } })} />
    </View> : <>
      <Text style={ui.text}>{t(code ? "business.notFound" : "business.missingBarcode")}</Text>
      {!!code && <Button title={t("business.addProduct")} onPress={() => router.replace({ pathname: "/inventory/add-product", params: { barcode: code } })} />}
    </>}
    <Button secondary title={t("business.scanAgain")} onPress={() => router.replace("/(scanner)/scan")} />
  </Screen>;
}
