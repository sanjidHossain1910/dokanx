import { Button, useUi } from "@/components/business/Screen";
import Header from "@/components/ui/Header";
import { CameraView, useCameraPermissions, type CameraViewProps } from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import { Flashlight, FlashlightOff } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, AppState, Keyboard, Linking, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme/ThemeProvider";
import { createCaptureGuard } from "@/src/scanner/captureGuard";
import { createScanFlow, type BarcodeEvent, type ScanSource } from "@/src/scanner/scanFlow";
import { decodeLocalImage, removeCapturedImage } from "@/src/scanner/decodeLocalImage";

const BARCODE_SETTINGS: CameraViewProps["barcodeScannerSettings"] = {
  barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "code93", "itf14", "codabar", "qr", "datamatrix", "pdf417", "aztec"],
};

export default function Scan() {
  const ui = useUi();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [focused, setFocused] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [cameraSession, setCameraSession] = useState(0);
  const [manualBarcode, setManualBarcode] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const camera = useRef<CameraView>(null);
  const [captureGuard] = useState(createCaptureGuard);
  const screenActive = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const [autoReadEnabled, setAutoReadEnabled] = useState(Platform.OS === "android");
  const invalidateCapture = useCallback(() => {
    captureGuard.reset();
    setCameraReady(false);
  }, [captureGuard]);
  const attachCamera = useCallback((view: CameraView | null) => {
    camera.current = view;
    invalidateCapture();
  }, [invalidateCapture]);
  const [scanFlow] = useState(() => createScanFlow({
    stopCamera: () => {
      invalidateCapture();
      setTorch(false);
      setFocused(false);
      setLeaving(true);
    },
    log: (scan) => console.info("[barcode] detected", scan),
    navigate: ({ barcode, id }) => router.replace({ pathname: "/(scanner)/product", params: { barcode, scanId: id } }),
  }));
  useFocusEffect(useCallback(() => {
    screenActive.current = true;
    scanFlow.reset();
    setLeaving(false);
    setCameraReady(false);
    setFocused(true);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        invalidateCapture();
        setFocused(false);
      } else if (state === "active") {
        setFocused(true);
        void getPermission().catch(() => setCameraError(true));
      }
    });
    return () => { screenActive.current = false; invalidateCapture(); subscription.remove(); setFocused(false); setTorch(false); };
  }, [getPermission, invalidateCapture, scanFlow]));
  const allow = async () => {
    try {
      setCameraError(false);
      if (permission?.canAskAgain || Platform.OS === "web") await requestPermission();
      else await Linking.openSettings();
    } catch { setCameraError(true); }
  };
  const handleBarcodeScanned = useCallback((event: BarcodeEvent, source: ScanSource = "camera") => {
    if (screenActive.current) scanFlow.accept(event, source);
  }, [scanFlow]);
  const findProduct = () => {
    Keyboard.dismiss();
    handleBarcodeScanned({ data: manualBarcode }, "manual");
  };
  const scanCurrentImage = useCallback(async () => {
    const currentCamera = camera.current;
    if (!currentCamera || !cameraReady || !screenActive.current || scanFlow.hasAccepted()) return;
    const captureToken = captureGuard.begin();
    if (captureToken === undefined) return;
    let capturedUri: string | undefined;
    try {
      const picture = await currentCamera.takePictureAsync({ quality: 0.9 });
      capturedUri = picture?.uri;
      if (!picture || !captureGuard.isCurrent(captureToken) || !screenActive.current || scanFlow.hasAccepted()) return;
      const result = await decodeLocalImage(picture);
      if (!captureGuard.isCurrent(captureToken) || !screenActive.current || scanFlow.hasAccepted()) return;
      if (result) handleBarcodeScanned(result, "photo");
    } catch (error) {
      if (captureGuard.isCurrent(captureToken) && screenActive.current && !scanFlow.hasAccepted()) {
        setAutoReadEnabled(false);
        const message = error instanceof Error ? error.message : String(error);
        console.info("[barcode] snapshot unavailable", { message });
        if (message.includes("Unable to find") && message.includes("ExpoCameraView")) {
          invalidateCapture();
          setCameraSession((session) => session + 1);
        }
      }
    } finally {
      removeCapturedImage(capturedUri);
      captureGuard.finish(captureToken);
    }
  }, [cameraReady, captureGuard, handleBarcodeScanned, invalidateCapture, scanFlow]);
  useEffect(() => {
    if (!autoReadEnabled || !focused || !cameraReady || leaving) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const nextFrame = async () => {
      if (!active) return;
      await scanCurrentImage();
      if (active && !scanFlow.hasAccepted()) timer = setTimeout(() => void nextFrame(), 2500);
    };
    timer = setTimeout(() => void nextFrame(), 1500);
    return () => { active = false; clearTimeout(timer); };
  }, [autoReadEnabled, focused, cameraReady, leaving, scanCurrentImage, scanFlow]);

  if (leaving) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <Header title={t("business.scan")} />
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
      <ActivityIndicator color={colors.primary} accessibilityLabel={t("business.findingProduct")} />
      <Text style={ui.text}>{t("business.findingProduct")}</Text>
    </View>
  </SafeAreaView>;

  const canUseCamera = !!permission?.granted && !cameraError && focused;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <Header title={t("business.scan")} />
    <View style={{ padding: 16, gap: 8, borderBottomWidth: 1, borderColor: colors.border, width: "100%", maxWidth: 720, alignSelf: "center" }}>
      <Text style={{ color: colors.muted, fontSize: 13 }}>{t("business.barcode")}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TextInput accessibilityLabel={t("business.barcode")} value={manualBarcode} onChangeText={setManualBarcode}
          placeholder={t("business.manualBarcode")} placeholderTextColor={colors.muted}
          autoCapitalize="none" autoCorrect={false} returnKeyType="search" onSubmitEditing={findProduct}
          keyboardAppearance={isDark ? "dark" : "light"} selectionColor={colors.primary}
          style={{ flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.card, fontSize: 16 }} />
        <Button title={t("business.findProduct")} disabled={!manualBarcode.trim()} onPress={findProduct} />
      </View>
    </View>
    <View style={{ flex: 1 }}>
      {!permission ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View> : !permission.granted || cameraError ?
        <View style={{ flex: 1, justifyContent: "center", padding: 24, paddingBottom: 100, gap: 16 }}>
          <Text style={ui.title}>{t(cameraError ? "business.cameraError" : "business.cameraPermission")}</Text>
          <Text style={ui.text}>{t(Platform.OS === "web" && !permission.canAskAgain ? "business.browserCameraHelp" : "business.cameraHelp")}</Text>
          {!permission.granted && <Button title={t(permission.canAskAgain || Platform.OS === "web" ? "business.allowCamera" : "business.openSettings")} onPress={() => void allow()} />}
        </View> : <>
          {focused && <CameraView ref={attachCamera} key={cameraSession} collapsable={false} style={{ flex: 1 }} facing="back" mode="picture" barcodeScannerSettings={BARCODE_SETTINGS} enableTorch={torch} onCameraReady={() => { captureGuard.markReady(); setCameraReady(true); }} onMountError={() => { invalidateCapture(); setCameraError(true); }} onBarcodeScanned={handleBarcodeScanned} />}
          <View pointerEvents="none" style={{ position: "absolute", top: "30%", left: "12%", width: "76%", aspectRatio: 1.6, borderWidth: 3, borderColor: colors.primary, borderRadius: 18 }} />
        </>}
      <View pointerEvents="box-none" style={{ position: "absolute", bottom: 24, left: 0, right: 0, alignItems: "center" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("business.torch")} accessibilityState={{ selected: torch, disabled: !canUseCamera }}
          aria-pressed={torch} disabled={!canUseCamera} onPress={() => setTorch((value) => !value)}
          style={({ pressed }) => ({ width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: torch ? colors.warning : colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", opacity: !canUseCamera ? 0.45 : pressed ? 0.7 : 1 })}>
          {torch ? <Flashlight size={25} color={colors.warning} /> : <FlashlightOff size={25} color={colors.text} />}
        </Pressable>
      </View>
    </View>
  </SafeAreaView>;
}
