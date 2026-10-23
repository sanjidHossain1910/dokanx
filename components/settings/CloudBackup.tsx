import { useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import { useTranslation } from "react-i18next";
import { useCloudBackup } from "@/src/cloudBackup/CloudBackupProvider";
import type { CloudVersion } from "@/src/cloudBackup/controller";
import { useAccount } from "@/src/account/AccountProvider";
import { useBusiness } from "@/src/store/BusinessProvider";
import { readBackup, saveBackup } from "@/src/store/backup";
import { formatBusinessDate } from "@/src/store/businessSettings";
import { Button, Field, Screen, useUi } from "../business/Screen";
import InventorySheet from "../business/InventorySheet";
import { parseQuantityInput } from "@/src/store/productUnits";
import { validSyncMinutes } from "@/src/cloudBackup/incremental";
import { ChevronRight } from "lucide-react-native";
import PublishLocalBackup from "./PublishLocalBackup";
export default function CloudBackupScreen() {
  const backup = useCloudBackup(),
    account = useAccount(),
    { data, workspace } = useBusiness(),
    { t, i18n } = useTranslation(),
    ui = useUi();
  const [intervalOpen, setIntervalOpen] = useState(false);
  const [intervalDraft, setIntervalDraft] = useState("10");
  const [intervalSaving, setIntervalSaving] = useState(false);
  const [intervalIssue, setIntervalIssue] = useState("");
  const [downloading, setDownloading] = useState(false),
    [publishing, setPublishing] = useState(false),
    [issue, setIssue] = useState("");
  const controller = backup.controller,
    busy = backup.busy || downloading || account.busy || publishing || intervalSaving;
  const canPublish = !!account.session && workspace === `account:${account.session.user.id}` && !!data.shopActive;
  const restored = backup.error === "backupRestored";
  useEffect(() => {
    if (controller) void controller.refresh();
  }, [controller]);
  const report = (error: string) =>
    t(
      i18n.exists(`cloudBackup.errors.${error}`)
        ? `cloudBackup.errors.${error}`
        : i18n.exists(`account.errors.${error}`)
          ? `account.errors.${error}`
          : "cloudBackup.errors.backupFailed",
    );
  const saveInterval = async () => {
    if (!controller || busy) return;
    const value = parseQuantityInput(intervalDraft, "piece");
    if (!validSyncMinutes(value)) { setIntervalIssue(t("cloudBackup.errors.invalidSyncInterval")); return; }
    setIntervalSaving(true); setIntervalIssue("");
    try { await controller.setIntervalMinutes(value); setIntervalOpen(false); }
    catch(error) { setIntervalIssue(report(error instanceof Error ? error.message : "backupSettings")); }
    finally { setIntervalSaving(false); }
  };
  const download = async (version: CloudVersion) => {
    const shop = account.session?.binding;
    if (!shop || busy) return;
    setDownloading(true);
    setIssue("");
    const file = new File(
      Paths.cache,
      `DokanX-cloud-${Crypto.randomUUID()}.dokanx`,
    );
    try {
      await account.controller.cloudRequest(
        `/backups/${shop.id}/${version.id}/download`,
        { saveTo: file.uri, expectedBytes: version.bytes },
      );
      const bytes = await file.bytes(),
        digest = await Crypto.digest(
          Crypto.CryptoDigestAlgorithm.SHA256,
          new Uint8Array(bytes).buffer,
        );
      if (
        bytes.length !== version.bytes ||
        Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("") !== version.archiveHash
      )
        throw new Error("invalidBackup");
      await readBackup(file.uri);
      await saveBackup(file.uri);
    } catch (e) {
      setIssue(e instanceof Error ? e.message : "backupFailed");
    } finally {
      try {
        if (file.exists) file.delete();
      } catch {}
      setDownloading(false);
    }
  };
  return (
    <Screen back title={t("cloudBackup.title")}>
      <Text style={ui.text}>{t("cloudBackup.intro")}</Text>
      {canPublish && <PublishLocalBackup disabled={backup.busy || downloading || account.busy} prominent={!controller || restored} onBusyChange={setPublishing} />}
      {!controller ? (
        <View style={ui.card}>
          <Text style={ui.text}>{t(canPublish ? "cloudBackup.publish.downloadAlternative" : "cloudBackup.accountHint")}</Text>
          <Button
            title={t(
              account.session?.needsSync ? 'accountSync.button' : account.session ? "cloudBackup.link" : "cloudBackup.account",
            )}
            onPress={() => router.push(account.session?.needsSync ? '/account-sync' : "/account")}
          />
        </View>
      ) : (
        <>
          <View style={ui.card}>
            <Text style={ui.subtitle}>{data.shopName}</Text>
            <Text style={ui.text}>{t("cloudBackup.last")}</Text>
            <Text style={ui.subtitle}>
              {backup.lastSuccess
                ? formatBusinessDate(
                    backup.lastSuccess,
                    i18n.language,
                    data.businessSettings,
                  )
                : t("cloudBackup.never")}
            </Text>
            <Text style={ui.text}>{t("cloudBackup.queue", backup.queueCounts)}</Text>
            {backup.queueCounts.conflict > 0 && <Text style={ui.text}>{t("conflicts.partialSync")}</Text>}
            <Button
              title={t(busy ? "cloudBackup.working" : "cloudBackup.now")}
              disabled={busy || !backup.ready || !backup.canUpload || restored}
              onPress={() => void controller.check(true).then(() => controller.refresh())}
            />
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Text style={[ui.subtitle, { flex: 1 }]}>
                {t("cloudBackup.auto")}
              </Text>
              <Switch
                accessibilityLabel={t("cloudBackup.auto")}
                value={backup.enabled}
                disabled={busy || !backup.ready || !backup.canUpload || restored}
                onValueChange={(value) => {
                  void controller
                    .setEnabled(value)
                    .catch((e) =>
                      setIssue(e instanceof Error ? e.message : "backupFailed"),
                    );
                }}
              />
            </View>
            <Text style={ui.text}>
              {t(backup.enabled ? "cloudBackup.on" : "cloudBackup.off")}
            </Text>
            {backup.enabled && <Text style={ui.text}>{t("cloudBackup.interval", { minutes: backup.intervalMinutes.toLocaleString(i18n.language) })}</Text>}
            {backup.enabled && <Pressable accessibilityRole="button" accessibilityLabel={t("cloudBackup.intervalTitle")} disabled={busy || !backup.ready || restored} onPress={() => { setIntervalDraft(String(backup.intervalMinutes)); setIntervalIssue(""); setIntervalOpen(true); }} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 }}><Text style={[ui.text, { flex: 1 }]}>{t("cloudBackup.intervalTitle")}</Text><Text style={ui.subtitle}>{t("cloudBackup.everyMinutes", { minutes: backup.intervalMinutes.toLocaleString(i18n.language) })}</Text><ChevronRight size={18} color={ui.text.color} /></Pressable>}
            <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
              <Text style={[ui.subtitle,{flex:1}]}>{t('cloudBackup.autoRestore')}</Text>
              <Switch accessibilityLabel={t('cloudBackup.autoRestore')} value={backup.autoRestore} disabled={busy || restored} onValueChange={value=>void controller.setAutoRestore(value).catch(e=>setIssue(e instanceof Error?e.message:'backupFailed'))}/>
            </View>
            <Text style={ui.text}>{t('cloudBackup.autoRestoreHint')}</Text>
          </View>
          {!backup.canUpload && (
            <Text style={ui.text}>{t("cloudBackup.otherDevice")}</Text>
          )}
          {(issue || backup.error) && (
            <Text accessibilityLiveRegion="polite" style={ui.error}>
              {report(issue || backup.error)}
            </Text>
          )}
          {__DEV__ && backup.error && backup.failureStage && <Text selectable style={ui.text}>{backup.failureStage}: {backup.error.replace(/(?:file|content|https?):\/\/[^\s'"\)]+|\/data\/[^\s'"\)]+/g,'<local-file>').slice(0,320)}</Text>}
          {(backup.queueCounts.conflict > 0 || ['syncConflict','syncInvalidMerge'].includes(backup.error)) && <Button title={t('conflicts.open')} disabled={busy} onPress={()=>router.push('/settings/sync-conflicts')}/>}
          {['syncReset','backupRestored'].includes(backup.error) && <Button secondary title={t('cloudBackup.reviewCloud')} disabled={busy} onPress={()=>router.push('/account-sync')}/>}
          <View style={ui.card}>
            <Text style={ui.subtitle}>{t("cloudBackup.versions")}</Text>
            <Button
              secondary
              title={t("cloudBackup.refresh")}
              disabled={busy}
              onPress={() => void controller.refresh()}
            />
            <Text style={ui.text}>{t("cloudBackup.downloadHint")}</Text>
            {backup.versions.length === 0 && (
              <Text style={ui.text}>{t("cloudBackup.empty")}</Text>
            )}
            {backup.versions.map((version) => (
              <View key={version.id} style={[ui.card, { marginTop: 4 }]}>
                <Text style={ui.subtitle}>
                  {formatBusinessDate(
                    version.completedAt ?? version.createdAt,
                    i18n.language,
                    data.businessSettings,
                  )}
                </Text>
                <Text style={ui.text}>
                  {version.products ?? 0} {t("cloudBackup.products")} ·{" "}
                  {version.invoices ?? 0} {t("cloudBackup.invoices")} ·{" "}
                  {version.assets ?? 0} {t("cloudBackup.photos")} ·{" "}
                  {(version.bytes / 1_000_000).toFixed(2)} MB
                </Text>
                <Button
                  secondary
                  title={t("cloudBackup.download")}
                  disabled={busy}
                  onPress={() => void download(version)}
                />
              </View>
            ))}
          </View>
        </>
      )}
      {intervalOpen && <InventorySheet title={t("cloudBackup.intervalTitle")} busy={intervalSaving} onClose={() => setIntervalOpen(false)}>
        <Field label={t("cloudBackup.intervalInput")} value={intervalDraft} onChangeText={setIntervalDraft} keyboardType="number-pad" maxLength={4} editable={!busy} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{[2, 5, 10, 15, 30, 60].map(minutes => <Pressable key={minutes} accessibilityRole="button" accessibilityState={{ selected: parseQuantityInput(intervalDraft, "piece") === minutes }} disabled={busy} onPress={() => setIntervalDraft(String(minutes))} style={{ borderWidth: 1, borderColor: ui.input.borderColor, borderRadius: 10, padding: 10, minHeight: 44 }}><Text style={parseQuantityInput(intervalDraft, "piece") === minutes ? ui.subtitle : ui.text}>{t("cloudBackup.minutesOption", { minutes: minutes.toLocaleString(i18n.language) })}</Text></Pressable>)}</View>
        <Text style={ui.text}>{t("cloudBackup.intervalHint")}</Text>
        {!!intervalIssue && <Text accessibilityRole="alert" style={ui.error}>{intervalIssue}</Text>}
        <Button title={t("business.save")} disabled={busy} onPress={() => void saveInterval()} />
      </InventorySheet>}
      <Text style={ui.text}>{t("cloudBackup.privacy")}</Text>
      {__DEV__ && <Text style={ui.text}>{t("cloudBackup.dev")}</Text>}
    </Screen>
  );
}
