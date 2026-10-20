import { WalletSetup } from "@/components/business/PaymentSettings";
import { Button, useUi } from "@/components/business/Screen";
import WalletLogo from "@/components/payments/WalletLogo";
import { useBusiness } from "@/src/store/BusinessProvider";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import SetupFrame from "./SetupFrame";

export default function ShopWallet() {
  const { method } = useLocalSearchParams<{ method?: string }>(); const { data } = useBusiness(); const { t } = useTranslation(); const ui = useUi();
  if (!data.shopId || !data.ownerName) return <Redirect href="/setup/basic" />;
  if (method !== "bkash" && method !== "nagad") return <Redirect href="/setup/payments" />;
  return <SetupFrame title={t("setup.addWalletTitle", { method: t(`pos.${method}`) })} footer={<Button secondary title={t("pos.cancel")} onPress={() => router.back()} />}>
    <View style={{ alignItems: "center", gap: 12 }}><WalletLogo method={method} width={90} height={80} /><Text style={ui.title}>{t(`pos.${method}`)}</Text><Text style={[ui.text, { textAlign: "center" }]}>{t("setup.walletHint")}</Text></View>
    <WalletSetup key={method} method={method} onSaved={() => router.dismissTo({ pathname: "/setup/payments", params: { list: "1" } })} />
  </SetupFrame>;
}
