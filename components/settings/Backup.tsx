import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useBusiness } from "@/src/store/BusinessProvider";
import { createBackup, readBackup, shareBackup, stageRestore } from "@/src/store/backup";
import { formatBusinessDate } from "@/src/store/businessSettings";
import { Button, Screen, useUi } from "@/components/business/Screen";
import InventorySheet from "@/components/business/InventorySheet";
import { FinanceIssue } from "@/components/business/FinanceShared";
import { changeLanguage } from "@/src/i18n";
import { useTheme } from "@/src/theme/ThemeProvider";
type Review = Awaited<ReturnType<typeof readBackup>> & { expected: string };
export default function BackupScreen() {
  const { data, restore } = useBusiness(); const { t, i18n } = useTranslation(); const ui = useUi(); const lock = useRef(false); const [busy, setBusy] = useState(false); const [issue, setIssue] = useState(""); const [file, setFile] = useState<{ uri: string; createdAt: string }>(); const [safety, setSafety] = useState<string>(); const [review, setReview] = useState<Review>();
  const { setMode } = useTheme();
  useEffect(() => { let active = true; void AsyncStorage.getItem("@dokanx/last-backup/v1").then((raw) => { if (!raw) return; const value = JSON.parse(raw); if (active && typeof value.uri === "string" && typeof value.createdAt === "string" && new File(value.uri).exists) setFile(value); }).catch(() => {}); return () => { active = false; }; }, []);
  const run = async (fn: () => Promise<void>) => { if (lock.current) return; lock.current = true; setBusy(true); setIssue(""); try { await fn(); } catch (e) { setIssue(e instanceof Error && ["invalidBackup", "missingAsset", "restoreStale"].includes(e.message) ? e.message : "backupFailed"); } finally { lock.current = false; setBusy(false); } };
  const pick = async () => {
    const selected = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false }); if (selected.canceled) return;
    const uri = selected.assets[0].uri;
    try { const backup = await readBackup(uri); setReview({ ...backup, expected: JSON.stringify(data) }); }
    finally { if (uri.startsWith(Paths.cache.uri)) { try { const cached = new File(uri); if (cached.exists) cached.delete(); } catch {} } }
  };
  const apply = async () => {
    if (!review) return;
    if (review.expected !== JSON.stringify(data)) throw new Error("restoreStale");
    const safetyFile = await createBackup(data); setSafety(safetyFile.uri);
    const staged = await stageRestore(review);
    try { await restore(staged.data, review.expected); } catch (e) { staged.cleanup(); throw e; }
    // Device addresses are local; a restored Bluetooth printer must be paired again.
    await AsyncStorage.removeItem("@dokanx/printer/v1").catch(() => {});
    if (review.manifest.preferences?.language) await changeLanguage(review.manifest.preferences.language).catch(() => {});
    if (review.manifest.preferences?.theme) await setMode(review.manifest.preferences.theme).catch(() => {});
    setReview(undefined); router.replace(staged.data.shopActive ? "/(tabs)" : "/setup");
  };
  return <Screen back title={t("flows.backup")}><Text style={ui.text}>{t("flows.backupHint")}</Text><View style={ui.card}><Text style={ui.subtitle}>{t("flows.createBackup")}</Text><Button title={t("flows.createBackup")} disabled={busy} onPress={() => { void run(async () => setFile(await createBackup(data))); }} />{file && <><Text style={ui.text}>{t("flows.backupReady")} · {formatBusinessDate(file.createdAt, i18n.language, data.businessSettings)}</Text><Button secondary title={t("flows.shareBackup")} disabled={busy} onPress={() => { void run(() => shareBackup(file.uri)); }} /></>}</View><Button secondary title={t("flows.restore")} disabled={busy} onPress={() => { void run(pick); }} /><Button secondary title={t("flows.cloud")} disabled onPress={() => {}} /><FinanceIssue issue={issue} />{safety && <Button secondary title={t("flows.safetyBackup")} disabled={busy} onPress={() => { void run(() => shareBackup(safety)); }} />}
    {review && <InventorySheet title={t("flows.restoreReview")} busy={busy} onClose={() => setReview(undefined)}><Text style={ui.subtitle}>{review.manifest.data.shopName}</Text><Text style={ui.text}>{t("flows.created")}: {formatBusinessDate(review.manifest.createdAt, i18n.language)}</Text><Text style={ui.text}>{t("flows.products")}: {review.manifest.data.products.length} · {t("flows.invoices")}: {review.manifest.data.invoices?.length ?? 0} · {t("flows.photos")}: {review.manifest.assets.length}</Text><Text style={ui.error}>{t("flows.restoreWarning")}</Text><Text style={ui.text}>{data.shopName} · {t("flows.products")}: {data.products.length} · {t("flows.invoices")}: {data.invoices?.length ?? 0}</Text><FinanceIssue issue={issue} /><Button title={t("flows.restoreConfirm")} disabled={busy} onPress={() => { void run(apply); }} /><Button secondary title={t("flows.cancel")} disabled={busy} onPress={() => setReview(undefined)} /></InventorySheet>}
  </Screen>;
}
