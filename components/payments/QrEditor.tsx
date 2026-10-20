import Header from "@/components/ui/Header";
import SquareFrame from "@/components/ui/SquareFrame";
import { Button, useUi } from "@/components/business/Screen";
import type { ProductPhotoDraft } from "@/src/store/productPhotos";
import { qrSquareCrop, rotatedQrSize, type QrAdjustment } from "@/src/store/paymentQrRules";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Image } from "expo-image";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react-native";
import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, PanResponder, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function QrEditor({ source, busy, error, onCancel, onConfirm }: { source: ProductPhotoDraft; busy: boolean; error?: string; onCancel: () => void; onConfirm: (adjustment: QrAdjustment) => void }) {
  const { colors } = useTheme(); const ui = useUi(); const { t } = useTranslation();
  const [size, setSize] = useState(280); const [rotation, setRotation] = useState(0); const [cropping, setCropping] = useState(false);
  const [zoom, setZoom] = useState(1); const [position, setPosition] = useState({ x: 0.5, y: 0.5 });
  const rotated = rotatedQrSize(source.width, source.height, rotation);
  const crop = qrSquareCrop(rotated.width, rotated.height, zoom, position.x, position.y);
  const scale = size / (cropping ? crop.width : Math.max(rotated.width, rotated.height));
  const current = useRef({ crop, scale, position, rotated, busy, cropping });
  const start = useRef(position);
  useLayoutEffect(() => { current.current = { crop, scale, position, rotated, busy, cropping }; }, [crop, scale, position, rotated, busy, cropping]);
  // Handlers read refs only when gestures occur, after layout commits the current geometry.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => current.current.cropping && !current.current.busy,
    onMoveShouldSetPanResponder: () => current.current.cropping && !current.current.busy,
    onPanResponderGrant: () => { start.current = current.current.position; },
    onPanResponderMove: (_, gesture) => {
      const state = current.current;
      if (state.busy || !state.cropping) return;
      setPosition({ x: state.rotated.width > state.crop.width ? Math.max(0, Math.min(1, start.current.x - gesture.dx / state.scale / (state.rotated.width - state.crop.width))) : 0.5,
        y: state.rotated.height > state.crop.height ? Math.max(0, Math.min(1, start.current.y - gesture.dy / state.scale / (state.rotated.height - state.crop.height))) : 0.5 });
    },
  }));
  const resetPosition = () => { setZoom(1); setPosition({ x: 0.5, y: 0.5 }); };
  const left = cropping ? -crop.originX * scale : (size - rotated.width * scale) / 2;
  const top = cropping ? -crop.originY * scale : (size - rotated.height * scale) / 2;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <Header title={t("pos.editQr")} description={t("pos.qrEditHint")} onBack={() => { if (!busy) onCancel(); }} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", gap: 16, padding: 20, maxWidth: 480, width: "100%", alignSelf: "center" }}>
      <SquareFrame maxSize={420} onSizeChange={setSize} {...pan.panHandlers} style={{ borderRadius: 12, backgroundColor: "#FFFFFF" }}>
        <View pointerEvents="none" style={{ position: "absolute", left, top, width: rotated.width * scale, height: rotated.height * scale }}><Image source={{ uri: source.uri }} contentFit="fill" accessibilityLabel={t("pos.qrEditPreview")} style={{ position: "absolute", width: source.width * scale, height: source.height * scale, left: (rotated.width - source.width) * scale / 2, top: (rotated.height - source.height) * scale / 2, transform: [{ rotate: `${rotation}deg` }] }} /></View>
        <View pointerEvents="none" style={{ position: "absolute", inset: 0, borderWidth: cropping ? 2 : 1, borderColor: cropping ? colors.primary : colors.border, borderRadius: 12 }} />
      </SquareFrame>
      <View style={{ flexDirection: "row", gap: 10 }}><View style={{ flex: 1 }}><Button title={t("pos.fitQr")} secondary={cropping} disabled={busy} onPress={() => { setCropping(false); resetPosition(); }} /></View><View style={{ flex: 1 }}><Button title={t("pos.cropQr")} secondary={!cropping} disabled={busy} onPress={() => { setCropping(true); resetPosition(); }} /></View></View>
      {cropping && <><View style={{ flexDirection: "row", gap: 10 }}><View style={{ flex: 1 }}><Button secondary title={t("business.zoomOut")} disabled={busy || zoom <= 1} onPress={() => setZoom((n) => Math.max(1, n - 0.25))} /></View><View style={{ flex: 1 }}><Button secondary title={t("business.zoomIn")} disabled={busy || zoom >= 8} onPress={() => setZoom((n) => Math.min(8, n + 0.25))} /></View></View>
        <View style={{ flexDirection: "row", gap: 12, justifyContent: "center" }}>{[{ key: "left", Icon: ArrowLeft, x: -0.1, y: 0 }, { key: "up", Icon: ArrowUp, x: 0, y: -0.1 }, { key: "down", Icon: ArrowDown, x: 0, y: 0.1 }, { key: "right", Icon: ArrowRight, x: 0.1, y: 0 }].map(({ key, Icon, x, y }) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={t(`pos.qrMove_${key}`)} disabled={busy} onPress={() => setPosition((p) => ({ x: Math.max(0, Math.min(1, p.x + x)), y: Math.max(0, Math.min(1, p.y + y)) }))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.elevated }}><Icon size={20} color={colors.primary} /></Pressable>)}</View></>}
      <View style={{ flexDirection: "row", gap: 10 }}><View style={{ flex: 1 }}><Button secondary title={t("pos.rotateQr")} disabled={busy} onPress={() => { setRotation((n) => (n + 90) % 360); resetPosition(); }} /></View><View style={{ flex: 1 }}><Button secondary title={t("pos.resetQr")} disabled={busy} onPress={() => { setRotation(0); setCropping(false); resetPosition(); }} /></View></View>
      <Text style={ui.text}>{t("pos.qrMarginHint")}</Text>
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}{busy && <ActivityIndicator color={colors.primary} />}
      <Button title={t("pos.useQr")} disabled={busy} onPress={() => onConfirm({ rotation, ...(cropping ? { crop } : {}) })} />
    </ScrollView>
  </SafeAreaView>;
}
