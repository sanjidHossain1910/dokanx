import { Button, useUi } from "./Screen";
import Header from "@/components/ui/Header";
import { removeDraftPhoto, type ProductPhotoDraft } from "@/src/store/productPhotos";
import { useTheme } from "@/src/theme/ThemeProvider";
import { CameraView, useCameraPermissions, type CameraViewProps } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, AppState, Linking, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const barcodeSettings: CameraViewProps["barcodeScannerSettings"] = { barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "code93", "itf14", "codabar", "qr", "datamatrix", "pdf417", "aztec"] };

/** Mounted only while open. No dependency on an external camera app. */
export default function ProductCamera({ mode, onClose, onPhoto, onBarcode, onBusyChange }: { mode: "photo" | "barcode"; onClose: () => void; onPhoto: (photo: ProductPhotoDraft) => void; onBarcode: (barcode: string) => void; onBusyChange: (busy: boolean) => void }) {
  const { colors } = useTheme();
  const ui = useUi();
  const { t } = useTranslation();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [active, setActive] = useState(AppState.currentState === "active");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [session, setSession] = useState(0);
  const [torch, setTorch] = useState(false);
  const camera = useRef<CameraView>(null);
  const live = useRef(true);
  const accepted = useRef(false);
  const capturing = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    live.current = true;
    const subscription = AppState.addEventListener("change", (state) => {
      generation.current++; setReady(false); setTorch(false); setActive(state === "active");
      if (state === "active") void getPermission().catch(() => setError(true));
    });
    return () => { live.current = false; subscription.remove(); };
  }, [getPermission]);
  const allow = async () => {
    try {
      if (permission?.canAskAgain || Platform.OS === "web") await requestPermission();
      else await Linking.openSettings();
    } catch { setError(true); }
  };
  const takePhoto = async () => {
    const view = camera.current;
    if (!view || !ready || !active || capturing.current || accepted.current) return;
    capturing.current = true; setBusy(true); onBusyChange(true);
    const token = generation.current;
    try {
      const image = await view.takePictureAsync({ quality: 1 });
      if (!image || image.width < 1 || image.height < 1) throw new Error("captureFailed");
      if (!live.current || generation.current !== token) { removeDraftPhoto(image.uri); return; }
      accepted.current = true; setActive(false); setReady(false);
      onPhoto(image);
    } catch (cause) {
      if (live.current && token === generation.current) {
        console.info("[product-camera] capture failed", { message: cause instanceof Error ? cause.message : String(cause) });
        setReady(false); setError(true);
      }
    } finally { capturing.current = false; onBusyChange(false); if (live.current) setBusy(false); }
  };
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t(mode === "photo" ? "business.productPhoto" : "business.scanBarcodeField")} onBack={() => { if (!capturing.current) onClose(); }} />
      {!permission ? <ActivityIndicator color={colors.primary} /> : !permission.granted ? <View style={{ padding: 24, gap: 16 }}>
        <Text style={ui.text}>{t("business.productCameraPermission")}</Text>
        <Button title={t(permission.canAskAgain || Platform.OS === "web" ? "business.allowCamera" : "business.openSettings")} onPress={() => void allow()} />
      </View> : error ? <View style={{ padding: 24, gap: 16 }}>
        <Text accessibilityRole="alert" style={ui.error}>{t("business.cameraError")}</Text>
        <Button title={t("business.restartCamera")} onPress={() => { generation.current++; setReady(false); setError(false); setSession((value) => value + 1); }} />
      </View> : <View style={{ flex: 1 }}>
        {active && <CameraView key={session} ref={camera} collapsable={false} style={{ flex: 1 }} facing="back" mode="picture" enableTorch={torch}
          barcodeScannerSettings={mode === "barcode" ? barcodeSettings : undefined}
          onCameraReady={() => setReady(true)} onMountError={(event) => { setReady(false); setError(true); console.info("[product-camera] mount failed", event); }}
          onBarcodeScanned={mode === "barcode" ? (event) => {
            const value = event.data?.trim();
            if (!value || accepted.current || !live.current || !active) return;
            accepted.current = true; setActive(false); setReady(false);
            console.info("[product-barcode] detected", { data: event.data, type: event.type });
            onBarcode(value);
          } : undefined} />}
        {mode === "barcode" && <View pointerEvents="none" style={{ position: "absolute", left: "10%", top: "30%", width: "80%", aspectRatio: 1.6, borderWidth: 2, borderColor: colors.primary, borderRadius: 16 }} />}
        {!ready && active && <ActivityIndicator style={{ position: "absolute", alignSelf: "center", top: "45%" }} color={colors.primary} />}
        <View style={{ padding: 20, gap: 12, backgroundColor: colors.background }}>
          <Text style={ui.text}>{t(mode === "photo" ? "business.cameraPhotoHint" : "business.scanHint")}</Text>
          <Button secondary title={t("business.torch")} disabled={!ready || busy} onPress={() => setTorch((value) => !value)} />
          {mode === "photo" && <Button title={t("business.takeProductPhoto")} disabled={!ready || busy || !active} onPress={() => void takePhoto()} />}
        </View>
      </View>}
    </SafeAreaView>;
}
