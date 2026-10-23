import { useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { useTranslation } from "react-i18next";
import { useAccount } from "@/src/account/AccountProvider";
import { useBusiness } from "@/src/store/BusinessProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import { cloudGenerationKey, cloudSettingsKey, CLOUD_GENERATION_KEY } from "@/src/cloudBackup/keys";
import { completeLocalPublication, localPublicationSettings, publishLocalShop, reviewLocalPublication, type PublicationReview } from "@/src/cloudBackup/publish";
import { createNativePublisher } from "@/src/cloudBackup/nativePublisher";
import type { CloudShop, SyncHead } from "@/src/cloudBackup/sync";
import { formatBusinessDate } from "@/src/store/businessSettings";
import InventorySheet from "../business/InventorySheet";
import { Button, useUi } from "../business/Screen";

export default function PublishLocalBackup({ disabled, prominent, onBusyChange }: {
  disabled: boolean; prominent: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const account = useAccount(), business = useBusiness(), ui = useUi();
  const { colors } = useTheme(), { t, i18n } = useTranslation();
  const [review, setReview] = useState<PublicationReview>(), [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState(""), [success, setSuccess] = useState("");
  const [retryable, setRetryable] = useState(false);
  const pending = useRef<{ publisher: ReturnType<typeof createNativePublisher>; shop: CloudShop } | null>(null);
  const lock = useRef(false), live = useRef({ account, business, active: true });
  useLayoutEffect(() => {
    live.current = { account, business, active: true };
    return () => { live.current.active = false; };
  }, [account, business]);
  const userId = account.session?.user.id, sessionId = account.session?.sessionId;
  const scope = business.workspace, epoch = business.restoreEpoch;
  const current = () => {
    const value = live.current;
    if (!userId || !value.active || value.account.session?.user.id !== userId ||
      value.account.session?.sessionId !== sessionId || value.business.workspace !== scope ||
      scope !== `account:${userId}` || value.business.restoreEpoch !== epoch)
      throw new Error("backupContextChanged");
  };
  const head = async (shop: CloudShop) => {
    const response = await account.controller.cloudRequest(`/backups/${shop.id}`) as SyncHead;
    current();
    if (!response || !Number.isSafeInteger(response.epoch) || response.epoch < 0 ||
      !(response.headId === null || typeof response.headId === "string") || !Array.isArray(response.versions))
      throw new Error("invalidResponse");
    return response;
  };
  const message = (code: string) => t(
    i18n.exists(`cloudBackup.errors.${code}`) ? `cloudBackup.errors.${code}` :
      i18n.exists(`accountSync.errors.${code}`) ? `accountSync.errors.${code}` :
        i18n.exists(`account.errors.${code}`) ? `account.errors.${code}` : "cloudBackup.errors.backupFailed",
  );
  const run = async (operation: () => Promise<void>) => {
    if (disabled || lock.current) return;
    lock.current = true; setBusy(true); onBusyChange(true); setIssue(""); setSuccess("");
    try { current(); await operation(); }
    catch (error) {
      if (live.current.active) {
        const code = error instanceof Error ? error.message : "backupFailed";
        if (["restoreStale", "backupContextChanged"].includes(code)) { pending.current = null; setRetryable(false); }
        setIssue(code);
      }
    }
    finally { lock.current = false; if (live.current.active) { setBusy(false); onBusyChange(false); } }
  };
  const inspect = () => void run(async () => {
    const result = await reviewLocalPublication({
      current, capture: () => live.current.business.data, head,
      shops: async () => {
        const response = await account.controller.cloudRequest("/auth/shops") as { shops: CloudShop[] };
        if (!Array.isArray(response?.shops) || response.shops.some(s => !s.id || !s.localShopId || !s.name))
          throw new Error("invalidResponse");
        return response.shops;
      },
    });
    current(); pending.current = null; setRetryable(false); setReview(result);
  });
  const completed = (at: string) => {
    current(); setSuccess(at); setReview(undefined); pending.current = null; setRetryable(false);
  };
  const retry = () => void run(async () => {
    const saved = pending.current;
    if (!saved) throw new Error("backupFailed");
    completed(await completeLocalPublication({ current, finish: shop => account.controller.completeSync(shop.id) }, saved.publisher, saved.shop));
  });
  const publish = () => void run(async () => {
    if (!review || !userId) return;
    const completed = await publishLocalShop({
      current, capture: () => live.current.business.data, head,
      begin: () => account.controller.beginSync(),
      link: async data => {
        await account.controller.linkShop(data.shopId!, data.shopName);
        const shop = account.controller.snapshot().session?.binding;
        if (!shop) throw new Error("invalidResponse");
        return shop;
      },
      claim: async (shop, remote) => {
        const path = remote.headId ? "activate" : "claim-empty";
        return await account.controller.cloudRequest(`/backups/${shop.id}/sync/${path}`, {
          body: remote.headId
            ? { requestKey: Crypto.randomUUID(), versionId: remote.headId, expectedEpoch: remote.epoch }
            : { expectedEpoch: remote.epoch },
        }) as { headId: string | null; epoch: number };
      },
      publisher: async (shop, remote) => {
        const generation = async () => (await AsyncStorage.getItem(cloudGenerationKey(scope))) ??
          (await AsyncStorage.getItem(CLOUD_GENERATION_KEY)) ?? "initial";
        const storageKey = cloudSettingsKey(userId, shop.id, shop.localShopId);
        const settings = localPublicationSettings(await generation(), remote);
        current();
        await AsyncStorage.setItem(storageKey, JSON.stringify(settings));
        current();
        const publisher = createNativePublisher({
          storageKey, generation,
          current: () => { try { current(); return true; } catch { return false; } },
          capture: () => live.current.business.data,
          request: (path, options) => account.controller.cloudRequest(`/backups/${shop.id}${path}`, options),
        });
        pending.current = { publisher, shop }; setRetryable(true);
        return publisher;
      },
      finish: shop => account.controller.completeSync(shop.id),
    }, review);
    current(); setSuccess(completed); setReview(undefined); pending.current = null; setRetryable(false);
  });
  const remote = review?.head.versions.find(v => v.id === review.head.headId);
  return <>
    {prominent ? <View style={ui.card}>
      <Text style={ui.subtitle}>{t("cloudBackup.publish.title")}</Text>
      <Text style={ui.text}>{t("cloudBackup.publish.hint")}</Text>
      <Button title={t(busy ? "cloudBackup.working" : "cloudBackup.publish.review")} disabled={disabled || busy} onPress={inspect} />
    </View> : <Pressable accessibilityRole="button" disabled={disabled || busy} onPress={inspect} style={{ minHeight: 44, justifyContent: "center" }}>
      <Text style={{ color: colors.primary, fontSize: 14 }}>{t("cloudBackup.publish.review")}</Text>
    </Pressable>}
    {busy && <ActivityIndicator color={colors.primary} accessibilityLabel={t("cloudBackup.working")} />}
    {!!issue && !review && <Text accessibilityLiveRegion="polite" style={ui.error}>{message(issue)}</Text>}
    {!!success && <Text accessibilityLiveRegion="polite" style={{ color: colors.success, fontSize: 14, lineHeight: 22 }}>{t("cloudBackup.publish.success")} · {formatBusinessDate(success, i18n.language)}</Text>}
    {review && <InventorySheet title={t("cloudBackup.publish.title")} busy={busy} onClose={() => setReview(undefined)}>
      <Text style={ui.subtitle}>{business.data.shopName}</Text>
      <Text style={ui.text}>{account.session?.user.phone}</Text>
      <Text style={ui.text}>{business.data.products.filter(p => !p.deletedAt).length} {t("cloudBackup.products")} · {business.data.invoices?.length ?? 0} {t("cloudBackup.invoices")}</Text>
      <Text style={ui.text}>{t(remote ? "cloudBackup.publish.replace" : "cloudBackup.publish.first")}</Text>
      {remote && <Text style={ui.text}>{t("cloudBackup.last")}: {formatBusinessDate(remote.completedAt ?? remote.createdAt, i18n.language)} · {remote.products ?? 0} {t("cloudBackup.products")}</Text>}
      <Text style={ui.text}>{t("cloudBackup.publish.device")}</Text>
      {!!issue && <Text accessibilityLiveRegion="polite" style={ui.error}>{message(issue)}</Text>}
      <Button title={t(busy ? "cloudBackup.working" : "cloudBackup.publish.confirm")} disabled={busy || disabled || !!issue} onPress={publish} />
      {!!issue && retryable && <Button title={t("cloudBackup.publish.retry")} disabled={busy || disabled} onPress={retry} />}
      {!!issue && <Button secondary title={t("cloudBackup.publish.review")} disabled={busy || disabled} onPress={inspect} />}
      <Button secondary title={t("business.cancel")} disabled={busy} onPress={() => setReview(undefined)} />
    </InventorySheet>}
  </>;
}
