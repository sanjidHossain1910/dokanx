import { Button, Field, useUi } from "./Screen";
import QrEditor from "@/components/payments/QrEditor";
import QrPreview from "@/components/payments/QrPreview";
import WalletLogo from "@/components/payments/WalletLogo";
import { useBusiness } from "@/src/store/BusinessProvider";
import { emptyPaymentSettings, saveWalletAccount, validWalletAccount, walletPhone, type WalletMethod } from "@/src/store/paymentSettings";
import { removePaymentQr, savePaymentQr } from "@/src/store/paymentQr";
import { removeDraftPhoto, type ProductPhotoDraft } from "@/src/store/productPhotos";
import type { QrAdjustment } from "@/src/store/paymentQrRules";
import { useTheme } from "@/src/theme/ThemeProvider";
import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image as NativeImage, Modal, Switch, Text, View } from "react-native";

export function WalletSetup({ method, onSaved, onBusyChange }: { method: WalletMethod; onSaved?: () => void; onBusyChange?: (busy: boolean) => void }) {
  const { data, update } = useBusiness();
  const saved = data.paymentSettings?.[method] ?? emptyPaymentSettings[method];
  const [enabled, setEnabled] = useState(onSaved ? true : saved.enabled);
  const [accountName, setAccountName] = useState(saved.accountName ?? "");
  const [isDefault, setIsDefault] = useState(saved.isDefault ?? false);
  const [phone, setPhone] = useState(saved.phone);
  const [qr, setQr] = useState(saved.qrUri);
  const [source, setSource] = useState<ProductPhotoDraft>();
  const [busy, setBusy] = useState(false);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const { colors } = useTheme(); const { t } = useTranslation(); const ui = useUi();
  const lock = useRef(false); const mounted = useRef(true);
  const savedQr = useRef(saved.qrUri); const draftQr = useRef(qr); const sourceRef = useRef<ProductPhotoDraft | undefined>(undefined);
  useEffect(() => { mounted.current = true; return () => {
    mounted.current = false;
    if (!lock.current) { if (draftQr.current !== savedQr.current) removePaymentQr(draftQr.current); removeDraftPhoto(sourceRef.current?.uri); }
  }; }, []);
  const finish = () => {
    lock.current = false;
    if (mounted.current) setBusy(false);
    else { if (draftQr.current !== savedQr.current) removePaymentQr(draftQr.current); removeDraftPhoto(sourceRef.current?.uri); }
  };
  const pick = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1 });
      if (!result.canceled && result.assets[0]) {
        const photo = result.assets[0];
        if (!mounted.current) { removeDraftPhoto(photo.uri); return; }
        sourceRef.current = { uri: photo.uri, width: photo.width, height: photo.height };
        setSource(sourceRef.current);
      }
    } catch { if (mounted.current) { setFailed(true); setMessage("pos.qrFailed"); } }
    finally { finish(); }
  };
  const edit = async () => {
    if (lock.current || !qr) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      const photo = await new Promise<ProductPhotoDraft>((resolve, reject) => { NativeImage.getSize(qr, (width, height) => resolve({ uri: qr, width, height }), reject); });
      if (mounted.current) { sourceRef.current = photo; setSource(photo); }
    } catch { if (mounted.current) { setFailed(true); setMessage("pos.qrFailed"); } }
    finally { finish(); }
  };
  const applyQr = async (adjustment: QrAdjustment) => {
    if (lock.current || !source) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      const uri = await savePaymentQr(source, Crypto.randomUUID(), adjustment);
      if (!mounted.current) { removePaymentQr(uri); return; }
      if (draftQr.current !== savedQr.current) removePaymentQr(draftQr.current);
      draftQr.current = uri; setQr(uri);
      removeDraftPhoto(source.uri); sourceRef.current = undefined; setSource(undefined);
    } catch { if (mounted.current) { setFailed(true); setMessage("pos.qrFailed"); } }
    finally { finish(); }
  };
  const closeEditor = () => {
    if (lock.current) return;
    removeDraftPhoto(sourceRef.current?.uri); sourceRef.current = undefined; setSource(undefined); setMessage("");
  };
  const save = async () => {
    if (lock.current) return;
    const account = { enabled, phone: walletPhone(phone), accountName: accountName.trim(), isDefault: enabled && isDefault, ...(qr ? { qrUri: qr } : {}) };
    if (!validWalletAccount(account)) { setFailed(true); setMessage("pos.walletInvalid"); return; }
    lock.current = true; setBusy(true); setMessage("");
    try {
      await update((current) => ({ ...current, paymentSettings: saveWalletAccount(current.paymentSettings ?? emptyPaymentSettings, method, account) }));
      const oldQr = savedQr.current; savedQr.current = qr;
      if (oldQr !== qr) removePaymentQr(oldQr);
      if (mounted.current) { setPhone(account.phone); setFailed(false); setMessage("business.saved"); onSaved?.(); }
    } catch { if (mounted.current) { setFailed(true); setMessage("business.saveFailed"); } }
    finally { finish(); }
  };
  return <View style={ui.card}>
    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><WalletLogo method={method} width={48} height={36} /><Text style={[ui.subtitle, { flex: 1 }]}>{t("pos.acceptWallet", { method: t(`pos.${method}`) })}</Text><Switch accessibilityLabel={t("pos.acceptWallet", { method: t(`pos.${method}`) })} value={enabled} disabled={busy} onValueChange={(value) => { setEnabled(value); setMessage(""); }} trackColor={{ true: colors.primary }} /></View>
    {enabled && <><Field label={t("setup.accountName")} value={accountName} onChangeText={setAccountName} maxLength={120} editable={!busy} /><Field label={t("pos.walletPhone", { method: t(`pos.${method}`) })} keyboardType="phone-pad" value={phone} onChangeText={(value) => { setPhone(value); setMessage(""); }} editable={!busy} />
      {qr && <><QrPreview uri={qr} label={t("pos.walletQr", { method: t(`pos.${method}`) })} number={phone} /><Button secondary disabled={busy} title={t("pos.editQr")} onPress={() => void edit()} /></>}
      <Button secondary disabled={busy} title={t(qr ? "pos.replaceQr" : "pos.uploadQr")} onPress={() => void pick()} /><Text style={ui.text}>{t("pos.qrHint")}</Text></>}
    {enabled && <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Text style={[ui.subtitle, { flex: 1 }]}>{t("profileSettings.setDefault")}</Text><Switch accessibilityLabel={t("profileSettings.setDefault")} value={isDefault} onValueChange={setIsDefault} disabled={busy} trackColor={{ true: colors.primary }} /></View>}
    <Button title={t(busy ? "pos.savingSettings" : "business.save")} disabled={busy} onPress={() => void save()} />
    {!!message && <Text accessibilityRole="alert" style={failed ? ui.error : ui.text}>{t(message)}</Text>}
    <Modal visible={!!source} animationType="slide" onRequestClose={closeEditor}>{source && <QrEditor key={source.uri} source={source} busy={busy} error={message ? t(message) : undefined} onCancel={closeEditor} onConfirm={(adjustment) => void applyQr(adjustment)} />}</Modal>
  </View>;
}
