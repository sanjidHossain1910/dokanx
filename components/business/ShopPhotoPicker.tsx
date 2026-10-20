import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import { Camera } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";
import { useBusiness } from "@/src/store/BusinessProvider";
import { removeDraftPhoto, removeUnsavedProductPhoto, saveProductPhoto, type PreparedProductPhoto, type ProductPhotoDraft } from "@/src/store/productPhotos";
import { useTheme } from "@/src/theme/ThemeProvider";
import ProductCamera from "./ProductCamera";
import ProductPhotoCrop from "./ProductPhotoCrop";
import ShopAvatar from "./ShopAvatar";
import { useUi } from "./Screen";
export default function ShopPhotoPicker() {
  const { data, update } = useBusiness(); const { colors } = useTheme(); const { t } = useTranslation(); const ui = useUi();
  const [source, setSource] = useState<ProductPhotoDraft>(); const [camera, setCamera] = useState(false); const [busy, setBusy] = useState(false); const [mediaBusy, setMediaBusy] = useState(false); const [error, setError] = useState(""); const lock = useRef(false); const live = useRef(true); const sourceRef = useRef(source);
  useEffect(() => { live.current = true; return () => { live.current = false; removeDraftPhoto(sourceRef.current?.uri); }; }, []);
  const crop = (next: ProductPhotoDraft | undefined) => { sourceRef.current = next; setSource(next); };
  const gallery = async () => {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1 }); if (!result.canceled && result.assets[0]) { const asset = result.assets[0]; if (asset.width < 1 || asset.height < 1) throw new Error("invalidImage"); if (live.current) crop(asset); else removeDraftPhoto(asset.uri); } }
    catch { if (live.current) setError("photoPickFailed"); }
    finally { lock.current = false; if (live.current) setBusy(false); }
  };
  const save = async (photo: PreparedProductPhoto) => {
    if (lock.current) { removeDraftPhoto(photo.uri); return; } lock.current = true; setBusy(true); setError(""); let uri: string | undefined; let committed = false;
    try { uri = await saveProductPhoto(photo, `SHOP-${Crypto.randomUUID()}`); const savedUri = uri; await update((current) => ({ ...current, shopPhotoUri: savedUri })); committed = true; removeDraftPhoto(sourceRef.current?.uri); if (live.current) crop(undefined); }
    catch { if (uri && !committed) removeUnsavedProductPhoto(uri); if (live.current) { removeDraftPhoto(sourceRef.current?.uri); crop(undefined); setError("photoSaveFailed"); } }
    finally { removeDraftPhoto(photo.uri); lock.current = false; if (live.current) setBusy(false); }
  };
  const label = t(data.shopPhotoUri ? "profileSettings.changeShopPhoto" : "setup.addPhoto");
  return <View style={{ alignItems: "center", gap: 10, paddingTop: 6 }}><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy || mediaBusy} onPress={() => Alert.alert(label, undefined, [{ text: t("business.camera"), onPress: () => { setError(""); setCamera(true); } }, { text: t("business.gallery"), onPress: () => { void gallery(); } }, { text: t("business.cancel"), style: "cancel" }])} style={{ alignItems: "center", gap: 10, minHeight: 44 }}><View><ShopAvatar uri={data.shopPhotoUri} name={data.shopName} size={104} /><View style={{ position: "absolute", bottom: 0, right: -2, borderWidth: 3, borderColor: colors.background, borderRadius: 22, backgroundColor: colors.primary, padding: 9 }}><Camera size={18} color={colors.onPrimary} /></View></View><Text style={{ color: colors.primary, fontSize: 13, lineHeight: 22 }}>{label}</Text></Pressable>{busy && <ActivityIndicator color={colors.primary} />}{!!error && <Text accessibilityRole="alert" style={ui.error}>{t(`business.${error}`)}</Text>}
    <Modal visible={camera || !!source} animationType="slide" onRequestClose={() => { if (!busy && !mediaBusy) { setCamera(false); removeDraftPhoto(sourceRef.current?.uri); crop(undefined); } }}>
      {camera && <ProductCamera mode="photo" onBusyChange={setMediaBusy} onClose={() => setCamera(false)} onBarcode={() => {}} onPhoto={(next) => { setCamera(false); crop(next); }} />}
      {source && <ProductPhotoCrop source={source} onBusyChange={setMediaBusy} onCancel={() => { if (!lock.current) { removeDraftPhoto(source.uri); crop(undefined); } }} onDone={(photo) => { void save(photo); }} />}
      {busy && <View accessibilityViewIsModal style={{ position: "absolute", inset: 0, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center" }}><ActivityIndicator size="large" color={colors.primary} accessibilityLabel={t("common.loading")} /></View>}
    </Modal>
  </View>;
}
