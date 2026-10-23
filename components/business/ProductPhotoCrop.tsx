import { Button, useUi } from "./Screen";
import Header from "@/components/ui/Header";
import SquareFrame from "@/components/ui/SquareFrame";
import { prepareProductPhoto, type ProductPhotoDraft, type PreparedProductPhoto } from "@/src/store/productPhotos";
import { squareCrop } from "@/src/store/photoRules";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Image } from "expo-image";
import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, PanResponder, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProductPhotoCrop({ source, onCancel, onDone, onBusyChange }: { source: ProductPhotoDraft; onCancel: () => void; onDone: (photo: PreparedProductPhoto) => void; onBusyChange: (busy: boolean) => void }) {
  const { colors } = useTheme();
  const ui = useUi();
  const { t } = useTranslation();
  const [size, setSize] = useState(280);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const start = useRef(position);
  const crop = squareCrop(source.width, source.height, zoom, position.x, position.y);
  const scale = size / crop.width;
  const current = useRef({ position, crop, scale });
  useLayoutEffect(() => { current.current = { position, crop, scale }; }, [position, crop, scale]);
  // PanResponder stores these handlers; refs are read later during gestures, never during construction.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !locked.current,
    onMoveShouldSetPanResponder: () => !locked.current,
    onPanResponderGrant: () => { start.current = current.current.position; },
    onPanResponderMove: (_, gesture) => {
      if (locked.current) return;
      const { crop: rect, scale: factor } = current.current;
      setPosition({ x: source.width > rect.width ? Math.max(0, Math.min(1, start.current.x - gesture.dx / factor / (source.width - rect.width))) : 0.5,
        y: source.height > rect.height ? Math.max(0, Math.min(1, start.current.y - gesture.dy / factor / (source.height - rect.height))) : 0.5 });
    },
  }));
  const confirm = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(""); onBusyChange(true);
    try { onDone(await prepareProductPhoto(source, zoom, position.x, position.y)); }
    catch (cause) { setError(cause instanceof Error && cause.message === "photoTooLarge" ? "photoTooLarge" : "photoSaveFailed"); }
    finally { locked.current = false; setBusy(false); onBusyChange(false); }
  };
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t("business.cropPhoto")} description={t("business.cropHint")} onBack={() => { if (!locked.current) onCancel(); }} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20, gap: 16, width: "100%", maxWidth: 440, alignSelf: "center" }}>
        <SquareFrame maxSize={400} onSizeChange={setSize} {...pan.panHandlers} style={{ borderRadius: 12, backgroundColor: colors.productPhoto }}>
          <Image pointerEvents="none" source={{ uri: source.uri }} contentFit="fill" accessibilityLabel={t("business.cropPhoto")} style={{ position: "absolute", width: source.width * scale, height: source.height * scale, left: -crop.originX * scale, top: -crop.originY * scale }} />
          <View pointerEvents="none" style={{ position: "absolute", inset: 0, borderWidth: 2, borderColor: colors.primary }} />
        </SquareFrame>
        <View style={{ flexDirection: "row", gap: 12 }}><View style={{ flex: 1 }}><Button secondary title={t("business.zoomOut")} disabled={busy || zoom <= 1} onPress={() => setZoom((value) => Math.max(1, value - 0.25))} /></View><View style={{ flex: 1 }}><Button secondary title={t("business.zoomIn")} disabled={busy || zoom >= 3} onPress={() => setZoom((value) => Math.min(3, value + 0.25))} /></View></View>
        <Text style={ui.text}>{t("business.photoLimitHint")}</Text>
        {!!error && <Text accessibilityRole="alert" style={ui.error}>{t(`business.${error}`)}</Text>}
        {busy && <ActivityIndicator color={colors.primary} />}
        <Button title={t("business.usePhoto")} disabled={busy} onPress={() => void confirm()} />
      </ScrollView>
    </SafeAreaView>;
}
