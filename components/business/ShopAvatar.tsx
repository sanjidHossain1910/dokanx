import { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "@/src/theme/ThemeProvider";
export default function ShopAvatar({ uri, name, size = 96 }: { uri?: string; name: string; size?: number }) {
  const { colors } = useTheme(); const [failedUri, setFailedUri] = useState<string>();
  return <View style={{ width: size, height: size, flexShrink: 0, borderRadius: size / 2, overflow: "hidden", backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
    {uri && failedUri !== uri ? <Image key={uri} source={{ uri }} accessibilityLabel={name} contentFit="cover" recyclingKey={uri} onError={() => setFailedUri(uri)} style={{ width: size, height: size }} /> : <Image source={require("@/assets/logo/app-icon-square.png")} accessibilityLabel={name} contentFit="cover" style={{ width: size, height: size }} />}
  </View>;
}
