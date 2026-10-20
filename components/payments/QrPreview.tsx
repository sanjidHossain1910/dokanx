import SquareFrame from "@/components/ui/SquareFrame";
import { Button } from "@/components/business/Screen";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Image } from "expo-image";
import { Maximize2, X } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

function QrImage({ uri, label }: { uri: string; label: string }) { return <Image source={{ uri }} contentFit="contain" accessibilityLabel={label} style={{ position: "absolute", top: 14, left: 14, right: 14, bottom: 14 }} />; }
export default function QrPreview({ uri, label, number }: { uri: string; label: string; number?: string }) {
  const [full, setFull] = useState(false);
  const { colors } = useTheme(); const { t } = useTranslation(); const { width, height } = useWindowDimensions(); const insets = useSafeAreaInsets();
  return <>
    <SquareFrame maxSize={600} style={{ borderRadius: 14, backgroundColor: "#FFFFFF" }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("pos.openQrFullscreen")} accessibilityHint={label} onPress={() => setFull(true)} style={{ position: "absolute", inset: 0 }}><QrImage uri={uri} label={label} /><View style={{ position: "absolute", right: 8, top: 8, padding: 7, borderRadius: 8, backgroundColor: "#FFFFFF" }}><Maximize2 size={18} color="#334155" /></View></Pressable>
    </SquareFrame>
    <Text style={{ color: colors.muted, textAlign: "center", fontSize: 12, lineHeight: 20 }}>{t("pos.tapQrFullscreen")}</Text>
    <Modal visible={full} animationType="fade" onRequestClose={() => setFull(false)}>{full && <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }}><Text style={{ flex: 1, color: colors.text, fontSize: 18, lineHeight: 28, fontWeight: "700" }}>{label}</Text><Pressable accessibilityRole="button" accessibilityLabel={t("pos.closeQrFullscreen")} onPress={() => setFull(false)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><X color={colors.text} size={25} /></Pressable></View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, gap: 16 }}><SquareFrame maxSize={Math.max(100, Math.min(900, width - 32, height - insets.top - insets.bottom - 220))} style={{ borderRadius: 12, backgroundColor: "#FFFFFF" }}><QrImage uri={uri} label={label} /></SquareFrame>{!!number && <Text selectable style={{ color: colors.text, fontSize: 25, fontWeight: "700", textAlign: "center" }}>{number}</Text>}</View>
      <View style={{ padding: 20 }}><Button title={t("pos.closeQrFullscreen")} onPress={() => setFull(false)} /></View>
    </SafeAreaView>}</Modal>
  </>;
}
