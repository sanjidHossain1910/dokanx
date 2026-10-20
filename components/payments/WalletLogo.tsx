import { Image } from "expo-image";
import { View } from "react-native";
import type { WalletMethod } from "@/src/store/paymentSettings";

const LOGOS = { bkash: require("@/assets/payments/bkash.svg"), nagad: require("@/assets/payments/nagad.svg") };
export default function WalletLogo({ method, width = 64, height = 44 }: { method: WalletMethod; width?: number; height?: number }) {
  return <View style={{ width, height, padding: 3, borderRadius: 7, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}><Image source={LOGOS[method]} accessibilityLabel={method === "bkash" ? "bKash" : "Nagad"} contentFit="contain" style={{ width: width - 6, height: height - 6 }} /></View>;
}
