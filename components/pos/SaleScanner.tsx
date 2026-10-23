import Header from "@/components/ui/Header";
import { Button, money, useUi } from "@/components/business/Screen";
import { ProductPhoto, POSIssue } from "./Shared";
import { usePOS } from "@/src/store/usePOS";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useScanFeedback } from "@/src/scanner/ScanFeedbackProvider";
import { commitSaleScans, createSaleScanGuard, stageSaleScan, stepSaleScan, type ScannedSaleItem } from "@/src/scanner/saleScan";
import { formatNumber } from "@/src/dashboard/format";
import { lineAmount, unitLabel } from "@/src/store/productUnits";
import { CameraView, useCameraPermissions, type CameraViewProps } from "expo-camera";
import * as Crypto from "expo-crypto";
import { CheckCircle2, Flashlight, FlashlightOff, Minus, Plus, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, AppState, FlatList, Keyboard, KeyboardAvoidingView, Linking, Platform, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

const settings: CameraViewProps["barcodeScannerSettings"] = { barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "code93", "itf14", "codabar", "qr", "datamatrix", "pdf417", "aztec"] };

function ScanFrame({ running, color }: { running: boolean; color: string }) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0.5);
  const frameHeight = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(progress);
    if (running && !reducedMotion) {
      progress.set(0);
      progress.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true));
    } else progress.set(0.5);
    return () => cancelAnimation(progress);
  }, [running, reducedMotion, progress]);
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: progress.get() * Math.max(0, frameHeight.get() - 20) }] }));
  return <View pointerEvents="none" onLayout={event => frameHeight.set(event.nativeEvent.layout.height)} style={{ position: "absolute", left: "10%", right: "10%", top: "22%", bottom: "22%", borderWidth: 2, borderColor: color, borderRadius: 14, overflow: "hidden" }}>
    <Animated.View style={[{ position: "absolute", top: 8, left: 12, right: 12, height: 2, borderRadius: 1, backgroundColor: color }, lineStyle]} />
  </View>;
}

export default function SaleScanner({ onClose, onBusyChange }: { onClose: () => void; onBusyChange: (busy: boolean) => void }) {
  const pos = usePOS();
  const { colors, isDark } = useTheme();
  const ui = useUi();
  const { t, i18n } = useTranslation();
  const feedback = useScanFeedback();
  const { height } = useWindowDimensions();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [active, setActive] = useState(AppState.currentState === "active");
  const [cameraError, setCameraError] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [session, setSession] = useState(0);
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState("");
  const [rows, setRows] = useState<ScannedSaleItem[]>([]);
  const rowsRef = useRef(rows);
  const list = useRef<FlatList<ScannedSaleItem>>(null);
  const [notice, setNotice] = useState("");
  const [issue, setIssue] = useState("");
  const [latest, setLatest] = useState("");
  const [guard] = useState(createSaleScanGuard);
  const [expectedDraftId] = useState(pos.draft?.id);
  const [workspace] = useState(pos.workspace);
  const [restoreEpoch] = useState(pos.restoreEpoch);
  const saving = useRef(false);
  const live = useRef(true);
  const activeRef = useRef(active);

  useEffect(() => {
    live.current = true;
    const subscription = AppState.addEventListener("change", state => {
      activeRef.current = state === "active"; setActive(activeRef.current); setTorch(false); setCameraReady(false);
      if (state === "active") void getPermission().catch(() => setCameraError(true));
    });
    return () => { live.current = false; activeRef.current = false; subscription.remove(); };
  }, [getPermission]);
  useEffect(() => { if (pos.workspace !== workspace || pos.restoreEpoch !== restoreEpoch) onClose(); }, [pos.workspace, workspace, pos.restoreEpoch, restoreEpoch, onClose]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => { setNotice(""); setLatest(""); }, 2400);
    return () => clearTimeout(timer);
  }, [notice, rows]);

  const scan = (raw: string, source: "camera" | "manual") => {
    const barcode = raw.trim();
    if (!barcode || !live.current || !activeRef.current || saving.current || !pos.ready || pos.error || pos.workspace !== workspace || pos.restoreEpoch !== restoreEpoch) return;
    if (source === "camera" && !guard(barcode, Date.now())) return;
    const product = pos.data.products.find(p => !p.deletedAt && (p.barcode === barcode || p.id === barcode));
    console.info("[barcode] sale lookup", { barcode, source, found: !!product, productId: product?.id });
    try {
      if (!product) throw new Error("productNotFound");
      if (pos.draft?.id !== expectedDraftId) throw new Error("invalidCart");
      const next = stageSaleScan(pos.data, rowsRef.current, product.id);
      rowsRef.current = next; setRows(next); setIssue(""); setNotice(t("pos.scanAdded", { name: product.name })); setLatest(product.id);
      feedback(Crypto.randomUUID());
      requestAnimationFrame(() => { if (live.current) list.current?.scrollToOffset({ offset: 0, animated: true }); });
      if (source === "manual") setManual("");
    } catch (error) { setNotice(""); setIssue(error instanceof Error ? error.message : "invalidCart"); }
  };
  const close = () => { if (!saving.current) onClose(); };
  const stepQuantity = (productId: string, direction: -1 | 1) => {
    if (saving.current || !pos.ready || pos.error || pos.workspace !== workspace || pos.restoreEpoch !== restoreEpoch) return;
    try {
      if (pos.draft?.id !== expectedDraftId) throw new Error("invalidCart");
      const next = stepSaleScan(pos.data, rowsRef.current, productId, direction);
      rowsRef.current = next; setRows(next); setNotice(""); setLatest(""); setIssue("");
    } catch (error) { setNotice(""); setIssue(error instanceof Error ? error.message : "invalidCart"); }
  };
  const done = async () => {
    if (saving.current || !rowsRef.current.length || pos.workspace !== workspace || pos.restoreEpoch !== restoreEpoch) return;
    saving.current = true; onBusyChange(true); setTorch(false); setActive(false);
    try {
      const items = rowsRef.current;
      const draftId = expectedDraftId ?? Crypto.randomUUID();
      const saved = await pos.run(current => commitSaleScans(current, items, expectedDraftId, draftId));
      if (saved) onClose(); else if (live.current) setActive(activeRef.current);
    } finally { saving.current = false; onBusyChange(false); }
  };
  const allow = async () => {
    try { if (permission?.canAskAgain || Platform.OS === "web") await requestPermission(); else await Linking.openSettings(); }
    catch { setCameraError(true); }
  };
  const total = rows.reduce((sum, r) => sum + (lineAmount(r.unitPrice, r.quantity) ?? 0), 0);
  const cameraUsable = !!permission?.granted && active && cameraReady && !cameraError && !pos.busy;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <Header title={t("pos.scanTitle")} description={t("pos.scanSubtitle")} onBack={close} rightSection={<Pressable accessibilityRole="button" accessibilityLabel={t("business.torch")} accessibilityState={{ selected: torch, disabled: !cameraUsable }} disabled={!cameraUsable} onPress={() => setTorch(value => !value)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: torch ? colors.primary : colors.card, opacity: cameraUsable ? 1 : 0.45 }}>{torch ? <Flashlight size={22} color={colors.onPrimary} /> : <FlashlightOff size={22} color={colors.text} />}</Pressable>} />
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, width: "100%", maxWidth: 720, alignSelf: "center" }}>
      <View style={{ flexDirection: "row", gap: 8, padding: 12 }}>
        <TextInput value={manual} onChangeText={setManual} accessibilityLabel={t("business.barcode")} placeholder={t("business.manualBarcode")} placeholderTextColor={colors.muted} editable={!pos.busy} autoCapitalize="none" autoCorrect={false} keyboardAppearance={isDark ? "dark" : "light"} returnKeyType="search" onSubmitEditing={() => { Keyboard.dismiss(); scan(manual, "manual"); }} style={{ flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.card, color: colors.text, fontSize: 16 }} />
        <Button secondary title={t("pos.scanFind")} disabled={!manual.trim() || pos.busy || !pos.ready} onPress={() => { Keyboard.dismiss(); scan(manual, "manual"); }} />
      </View>
      <View style={{ height: Math.min(240, Math.max(140, height * 0.25)), marginHorizontal: 12, borderRadius: 16, overflow: "hidden", backgroundColor: colors.elevated }}>
        {!permission ? <ActivityIndicator style={{ flex: 1 }} color={colors.primary} /> : !permission.granted || cameraError ? <View style={{ flex: 1, justifyContent: "center", padding: 12, gap: 8 }}><Text style={ui.text}>{t(cameraError ? "business.cameraError" : "business.cameraPermission")}</Text><Button secondary title={t(cameraError ? "business.restartCamera" : permission.canAskAgain ? "business.allowCamera" : "business.openSettings")} onPress={() => { if (cameraError) { setCameraError(false); setCameraReady(false); setSession(n => n + 1); } else void allow(); }} /></View> : <>
          {active && <CameraView key={session} style={{ flex: 1 }} facing="back" enableTorch={torch} barcodeScannerSettings={settings} onCameraReady={() => setCameraReady(true)} onMountError={() => { setCameraReady(false); setCameraError(true); setTorch(false); }} onBarcodeScanned={event => scan(event.data, "camera")} />}
          <ScanFrame running={cameraUsable} color={colors.primary} />
          {!cameraReady && active && <ActivityIndicator style={{ position: "absolute", alignSelf: "center", top: "45%" }} color={colors.primary} />}
        </>}
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, minHeight: 32 }} accessibilityLiveRegion="polite">{notice ? <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}><CheckCircle2 size={16} color={colors.success} /><Text numberOfLines={1} style={{ color: colors.success, flex: 1, fontSize: 12 }}>{notice}</Text></View> : <POSIssue issue={issue || pos.issue} />}</View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8 }}><View><Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{t("pos.scanProducts")}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{t("pos.scanLatest")}</Text></View><Text style={{ color: colors.muted }}>{formatNumber(rows.length, i18n.language)}</Text></View>
      <FlatList ref={list} style={{ flex: 1 }} data={rows} keyExtractor={r => r.productId} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8, gap: 8 }} ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: "center", padding: 16 }}>{t("pos.scanEmpty")}</Text>} renderItem={({ item }) => {
        const product = pos.data.products.find(p => p.id === item.productId);
        return <View style={{ padding: 8, borderRadius: 12, borderWidth: 1, borderColor: latest === item.productId ? colors.primary : colors.border, backgroundColor: colors.card }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ProductPhoto size={44} uri={product?.photoUri} name={product?.name ?? item.productId} />
          <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={2} style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>{product?.name ?? item.productId}</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{money(item.unitPrice)} / {unitLabel(item.unit, i18n.language)}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={t("pos.remove", { name: product?.name ?? item.productId })} disabled={pos.busy} onPress={() => { const next = rowsRef.current.filter(r => r.productId !== item.productId); rowsRef.current = next; setRows(next); setNotice(""); setIssue(""); }} style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }}><X size={18} color={colors.muted} /></Pressable>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.elevated, borderRadius: 10 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={t("pos.decrease", { name: product?.name ?? item.productId })} disabled={pos.busy} onPress={() => stepQuantity(item.productId, -1)} style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pos.busy ? 0.4 : pressed ? 0.6 : 1 })}><Minus size={17} color={colors.primary} /></Pressable>
              <Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: 13, fontWeight: "600", textAlign: "center", maxWidth: 112 }}>{formatNumber(item.quantity, i18n.language)} {unitLabel(item.unit, i18n.language)}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t("pos.increase", { name: product?.name ?? item.productId })} disabled={pos.busy} onPress={() => stepQuantity(item.productId, 1)} style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pos.busy ? 0.4 : pressed ? 0.6 : 1 })}><Plus size={17} color={colors.primary} /></Pressable>
            </View>
            <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13, flexShrink: 1, textAlign: "right" }}>{money(lineAmount(item.unitPrice, item.quantity) ?? 0)}</Text>
          </View>
        </View>;
      }} />
      <View style={{ padding: 12, gap: 10, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}><View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: colors.muted }}>{t("pos.scanSessionTotal")}</Text><Text style={{ color: colors.text, fontWeight: "700" }}>{money(total)}</Text></View><View style={{ flexDirection: "row", gap: 10 }}><View style={{ flex: 1 }}><Button secondary title={t("pos.cancel")} disabled={pos.busy} onPress={close} /></View><View style={{ flex: 1.5 }}><Button title={t("pos.scanDone")} disabled={!rows.length || pos.busy || !pos.ready || !!pos.error} onPress={() => void done()} /></View></View>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
