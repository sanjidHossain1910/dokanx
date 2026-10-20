import { Button, Field, useUi } from "@/components/business/Screen";
import ProductPhotoCrop from "@/components/business/ProductPhotoCrop";
import { useBusiness } from "@/src/store/BusinessProvider";
import { saveShopDetails } from "@/src/store/shop";
import { removeDraftPhoto, removeUnsavedProductPhoto, saveProductPhoto, type PreparedProductPhoto, type ProductPhotoDraft } from "@/src/store/productPhotos";
import { useTheme } from "@/src/theme/ThemeProvider";
import * as Crypto from "expo-crypto";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Camera, Store } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, Text, View } from "react-native";
import SetupFrame from "./SetupFrame";

export default function ShopBasic({ editing = false }: { editing?: boolean }) {
  const { data, update } = useBusiness(); const { t } = useTranslation(); const ui = useUi(); const { colors } = useTheme();
  const [name, setName] = useState(data.shopId || data.shopName !== "DokanX" ? data.shopName : "");
  const [owner, setOwner] = useState(data.ownerName ?? ""); const [phone, setPhone] = useState(data.shopPhone ?? ""); const [address, setAddress] = useState(data.shopAddress ?? "");
  const [photo, setPhoto] = useState<PreparedProductPhoto>(); const [source, setSource] = useState<ProductPhotoDraft>();
  const [busy, setBusy] = useState(false); const [cropBusy, setCropBusy] = useState(false); const [error, setError] = useState("");
  const lock = useRef(false); const mounted = useRef(true); const photoRef = useRef(photo); const sourceRef = useRef(source);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; removeDraftPhoto(photoRef.current?.uri); removeDraftPhoto(sourceRef.current?.uri); }; }, []);
  const pick = async (camera: boolean) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) { setError(t("business.productCameraPermission")); return; }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: false, quality: 1 };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (!mounted.current) { removeDraftPhoto(asset.uri); return; }
        sourceRef.current = asset; setSource(asset);
      }
    } catch { if (mounted.current) setError(t("business.photoPickFailed")); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const save = async () => {
    if (lock.current || cropBusy) return;
    lock.current = true; setBusy(true); setError(""); let newUri: string | undefined; let committed = false;
    try {
      const input = { shopName: name, ownerName: owner, shopPhone: phone, shopAddress: address, shopPhotoUri: data.shopPhotoUri };
      const id = data.shopId ?? Crypto.randomUUID();
      saveShopDetails(data, input, id);
      if (photo) newUri = await saveProductPhoto(photo, `SHOP-${Crypto.randomUUID()}`);
      await update((current) => saveShopDetails(current, { ...input, shopPhotoUri: newUri ?? input.shopPhotoUri }, id));
      committed = true;
      if (newUri && data.shopPhotoUri) removeUnsavedProductPhoto(data.shopPhotoUri);
      if (mounted.current) {
        if (editing) router.replace("/(tabs)/profile");
        else router.push("/setup/payments");
      }
    } catch (cause) {
      if (newUri && !committed) removeUnsavedProductPhoto(newUri);
      if (mounted.current) setError(t(cause instanceof Error && cause.message === "invalidShop" ? "setup.invalidShop" : "business.saveFailed"));
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const uri = photo?.uri ?? data.shopPhotoUri;
  return <SetupFrame title={t(editing ? "profileSettings.editProfile" : "setup.basic")} onBack={() => { if (!busy && !cropBusy) { if (router.canGoBack()) router.back(); else router.replace(editing ? "/(tabs)/profile" : "/setup"); } }} footer={<Button title={t(busy ? "setup.saving" : editing ? "business.save" : "setup.continue")} disabled={busy || cropBusy} onPress={() => void save()} />}>
    <View style={{ alignItems: "center", gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("setup.addPhoto")} disabled={busy} onPress={() => void pick(false)} style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
        {uri ? <Image source={{ uri }} contentFit="cover" style={{ width: 112, height: 112, borderRadius: 56 }} /> : <Store size={55} color={colors.primary} />}
        <View style={{ position: "absolute", bottom: 0, right: 0, backgroundColor: colors.primary, borderRadius: 22, padding: 9, borderWidth: 3, borderColor: colors.background }}><Camera size={20} color={colors.onPrimary} /></View>
      </Pressable><Text style={{ color: colors.primary }}>{t("setup.addPhoto")}</Text>
      <View style={{ flexDirection: "row", gap: 10 }}><Button secondary title={t("business.camera")} disabled={busy} onPress={() => void pick(true)} /><Button secondary title={t("business.gallery")} disabled={busy} onPress={() => void pick(false)} /></View>
    </View>
    <Field label={`${t("business.shopName")} *`} value={name} onChangeText={setName} maxLength={160} editable={!busy} autoCapitalize="words" />
    <Field label={`${t("setup.ownerName")} *`} value={owner} onChangeText={setOwner} maxLength={120} editable={!busy} autoCapitalize="words" />
    <Field label={t("setup.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!busy} />
    <Field label={t("setup.address")} value={address} onChangeText={setAddress} maxLength={500} editable={!busy} multiline />
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    <Modal visible={!!source} animationType="slide" onRequestClose={() => { if (!cropBusy) { removeDraftPhoto(sourceRef.current?.uri); sourceRef.current = undefined; setSource(undefined); } }}>{source && <ProductPhotoCrop source={source} onBusyChange={setCropBusy} onCancel={() => { removeDraftPhoto(source.uri); sourceRef.current = undefined; setSource(undefined); }} onDone={(next) => { removeDraftPhoto(photoRef.current?.uri); photoRef.current = next; setPhoto(next); removeDraftPhoto(source.uri); sourceRef.current = undefined; setSource(undefined); }} />}</Modal>
  </SetupFrame>;
}
