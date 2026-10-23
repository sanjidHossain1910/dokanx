import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useBusiness } from "@/src/store/BusinessProvider";
import { manualBackupKey } from "@/src/cloudBackup/keys";
import { createBackup, readBackup, saveBackup, shareBackup, stageRestore } from "@/src/store/backup";
import { formatBusinessDate } from "@/src/store/businessSettings";
import { Button, Screen, useUi } from "@/components/business/Screen";
import InventorySheet from "@/components/business/InventorySheet";
import { FinanceIssue } from "@/components/business/FinanceShared";
import { changeLanguage } from "@/src/i18n";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useAccount } from "@/src/account/AccountProvider";
type Review = Awaited<ReturnType<typeof readBackup>> & { expected: string };
export default function BackupScreen() {
  const { data, restore, workspace } = useBusiness(); const { t, i18n } = useTranslation(); const ui = useUi(); const lock = useRef(false); const [busy, setBusy] = useState(false); const [issue, setIssue] = useState(""); const [file, setFile] = useState<{ uri: string; createdAt: string }>(); const [safety, setSafety] = useState<string>(); const [review, setReview] = useState<Review>();
  const { setMode, colors } = useTheme();
  const [savedFile, setSavedFile] = useState("");
  const account = useAccount();
  useEffect(() => { let active = true; void AsyncStorage.getItem(manualBackupKey(workspace)).then((raw) => { if (!raw) return; const value = JSON.parse(raw); if (active && typeof value.uri === "string" && typeof value.createdAt === "string" && new File(value.uri).exists) setFile(value); }).catch(() => {}); return () => { active = false; }; }, [workspace]);
  const run = async (fn: () => Promise<void>) => { if (lock.current) return; lock.current = true; setBusy(true); setIssue(""); setSavedFile(""); try { await fn(); } catch (e) { const stage = (e as { backupStage?: string })?.backupStage;
      const detail: Record<string, string> = { file: "backupReadFailed", archive: "backupArchiveInvalid", manifest: "backupManifestInvalid", images: "backupImagesInvalid", records: "backupRecordsInvalid" };
      setIssue(e instanceof Error && e.message === "invalidBackup" && stage && detail[stage] ? detail[stage] : e instanceof Error && ["invalidBackup", "missingAsset", "restoreStale", "backupFileMissing", "backupSaveFailed", "backupShareUnavailable"].includes(e.message) ? e.message : "backupFailed"); } finally { lock.current = false; setBusy(false); } };
  const pick = async () => {
    const selected = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false }); if (selected.canceled) return;
    const uri = selected.assets[0].uri;
    try { const backup = await readBackup(uri); setReview({ ...backup, expected: JSON.stringify(data) }); }
    finally { if (uri.startsWith(Paths.cache.uri)) { try { const cached = new File(uri); if (cached.exists) cached.delete(); } catch {} } }
  };
  const apply = async () => {
    if (!review) return;
    if (review.expected !== JSON.stringify(data)) throw new Error("restoreStale");
    const safetyFile = await createBackup(data, { metadataKey: manualBackupKey(workspace) }); setSafety(safetyFile.uri);
    const staged = await stageRestore(review);
    try { await restore(staged.data, review.expected); } catch (e) { staged.cleanup(); throw e; }
    // Device addresses are local; a restored Bluetooth printer must be paired again.
    await AsyncStorage.removeItem("@dokanx/printer/v1").catch(() => {});
    if (review.manifest.preferences?.language) await changeLanguage(review.manifest.preferences.language).catch(() => {});
    if (review.manifest.preferences?.theme) await setMode(review.manifest.preferences.theme).catch(() => {});
    setReview(undefined); router.replace(staged.data.shopActive ? account.session && workspace === `account:${account.session.user.id}` ? "/settings/cloud-backup" : "/(tabs)" : "/setup");
  };
  return <Screen back title={t("flows.backup")}><Text style={ui.text}>{t("flows.backupHint")}</Text><View style={ui.card}><Text style={ui.subtitle}>{t("flows.createBackup")}</Text><Button title={t("flows.createBackup")} disabled={busy} onPress={() => { void run(async () => setFile(await createBackup(data, { metadataKey: manualBackupKey(workspace) }))); }} />{file && <><Text style={ui.text}>{t("flows.backupReady")} · {formatBusinessDate(file.createdAt, i18n.language, data.businessSettings)}</Text><View style={{ flexDirection: "row", gap: 10 }}><View style={{ flex: 1 }}><Button title={t("flows.saveBackup")} disabled={busy} onPress={() => { void run(async () => { const saved = await saveBackup(file.uri); if (saved) setSavedFile(saved.name); }); }} /></View><View style={{ flex: 1 }}><Button secondary title={t("flows.shareOnly")} disabled={busy} onPress={() => { void run(() => shareBackup(file.uri)); }} /></View></View><Text style={ui.text}>{t("flows.saveBackupHint")}</Text>{!!savedFile && <Text accessibilityLiveRegion="polite" style={{ color: colors.success, fontSize: 14, lineHeight: 22 }}>{t("flows.backupSaved", { name: savedFile })}</Text>}</>}</View><Button secondary title={t("flows.restore")} disabled={busy} onPress={() => { void run(pick); }} /><Button secondary title={t("cloudBackup.title")} onPress={() => router.push("/settings/cloud-backup")} /><FinanceIssue issue={issue} />{safety && <Button secondary title={t("flows.safetyBackup")} disabled={busy} onPress={() => { void run(() => shareBackup(safety)); }} />}
    {review && <InventorySheet title={t("flows.restoreReview")} busy={busy} onClose={() => setReview(undefined)}><Text style={ui.subtitle}>{review.manifest.data.shopName}</Text><Text style={ui.text}>{t("flows.created")}: {formatBusinessDate(review.manifest.createdAt, i18n.language)}</Text><Text style={ui.text}>{t("flows.products")}: {review.manifest.data.products.length} · {t("flows.invoices")}: {review.manifest.data.invoices?.length ?? 0} · {t("flows.photos")}: {review.manifest.assets.length}</Text><Text style={ui.error}>{t("flows.restoreWarning")}</Text><Text style={ui.text}>{data.shopName} · {t("flows.products")}: {data.products.length} · {t("flows.invoices")}: {data.invoices?.length ?? 0}</Text><FinanceIssue issue={issue} /><Button title={t("flows.restoreConfirm")} disabled={busy} onPress={() => { void run(apply); }} /><Button secondary title={t("flows.cancel")} disabled={busy} onPress={() => setReview(undefined)} /></InventorySheet>}
  </Screen>;
}
