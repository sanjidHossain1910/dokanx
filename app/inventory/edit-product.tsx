import ProductForm from "@/components/business/ProductForm";
import { Button, Screen, useUi } from "@/components/business/Screen";
import { useBusiness } from "@/src/store/BusinessProvider";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

export default function EditProductScreen() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const { data, ready } = useBusiness();
  const { t } = useTranslation();
  const ui = useUi();
  const product = data.products.find((p) => p.id === productId && !p.deletedAt);
  if (!ready || !product) return <Screen back title={t("inventory.edit")}><Text style={ui.text}>{t("inventory.missing")}</Text><Button title={t("inventory.returnProducts")} onPress={() => router.replace("/(tabs)/packege")} /></Screen>;
  return <ProductForm key={product.id} product={product} />;
}
