import { transferNativeLocalShop } from "@/src/cloudBackup/nativeLocalTransfer";
import { localBusinessRepository } from "@/src/store/repository";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useAccount } from "@/src/account/AccountProvider";
import { useBusiness } from "@/src/store/BusinessProvider";
import type { BusinessData } from "@/src/store/business";
import {
  createBackup,
  readBackup,
  shareBackup,
  stageRestore,
} from "@/src/store/backup";
import {
  synchronizeAccountShop,
  type CloudShop,
  type SyncHead,
  type SyncPhase,
} from "@/src/cloudBackup/sync";
import { adoptCloudSnapshot } from "@/src/cloudBackup/adopt";
import { manualBackupKey, cloudSettingsKey } from "@/src/cloudBackup/keys";
import { useCloudBackup } from "@/src/cloudBackup/CloudBackupProvider";
import { useTheme } from "@/src/theme/ThemeProvider";
import { changeLanguage } from "@/src/i18n";
import { Button, Screen } from "../business/Screen";
import SyncLayout from "./SyncLayout";
export default function AccountSync() {
  const account = useAccount(),
    business = useBusiness(),
    cloud = useCloudBackup(),
    { setMode } = useTheme(),
    { t, i18n } = useTranslation();
  const [shops, setShops] = useState<CloudShop[]>([]),
    [selected, setSelected] = useState<CloudShop>(),
    [head, setHead] = useState<SyncHead>(),
    [offline, setOffline] = useState<BusinessData>(),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [downloadBytes, setDownloadBytes] = useState({ received: 0, total: 0 }),
    [phase, setPhase] = useState<SyncPhase>("download"),
    [issue, setIssue] = useState(""),
    [safety, setSafety] = useState<string>(),
    [done, setDone] = useState(false);
  const lock = useRef(false),
    live = useRef({ account, business, active: true });
  const [attempt, setAttempt] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [offlineTransferAvailable, setOfflineTransferAvailable] =
    useState(false);
  useLayoutEffect(() => {
    live.current = { account, business, active: true };
    return () => {
      live.current.active = false;
    };
  }, [account, business]);
  const userId = account.session?.user.id,
    sessionId = account.session?.sessionId,
    workspace = userId ? `account:${userId}` : undefined;
  const scoped = !!userId && business.workspace === workspace;
  const businessWorkspace = business.workspace,
    readOffline = business.readOffline;
  const disabled = busy || loading || account.busy || cloud.busy || !scoped;
  const errorText = (code: string) =>
    t(
      i18n.exists(`accountSync.errors.${code}`)
        ? `accountSync.errors.${code}`
        : i18n.exists(`cloudBackup.errors.${code}`)
          ? `cloudBackup.errors.${code}`
          : i18n.exists(`account.errors.${code}`)
            ? `account.errors.${code}`
            : "accountSync.errors.syncFailed",
    );
  useEffect(() => {
    if (!userId || businessWorkspace !== `account:${userId}`) return;
    let active = true;
    void (async () => {
      try {
        const result = (await account.controller.cloudRequest(
          "/auth/shops",
        )) as { shops: CloudShop[] };
        if (
          !Array.isArray(result.shops) ||
          result.shops.some((s) => !s.id || !s.localShopId || !s.name)
        )
          throw new Error("invalidResponse");
        const local = await readOffline();
        if (!active) return;
        setShops(result.shops);
        setOffline(local);
        const matching = result.shops.find(
          (s) => s.localShopId === local.shopId,
        );
        const first =
          result.shops.find(
            (s) => s.id === account.controller.snapshot().session?.binding?.id,
          ) ??
          matching ??
          result.shops[0];
        let matchingHead: SyncHead | undefined;
        if (first) {
          const remote = (await account.controller.cloudRequest(
            `/backups/${first.id}`,
          )) as SyncHead;
          if (!active) return;
          setSelected(first);
          setHead(remote);
          if (first.id === matching?.id) matchingHead = remote;
        }
        if (matching && !matchingHead)
          matchingHead = (await account.controller.cloudRequest(
            `/backups/${matching.id}`,
          )) as SyncHead;
        const pendingTransfer = matching
          ? await AsyncStorage.getItem(
              cloudSettingsKey(userId, matching.id, matching.localShopId) +
                "/local-transfer-v1",
            )
          : null;
        if (active)
          setOfflineTransferAvailable(
            !!local.shopActive &&
              !!local.shopId &&
              (!matchingHead?.headId || !!pendingTransfer),
          );
      } catch (e) {
        if (active) setIssue(e instanceof Error ? e.message : "syncFailed");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, businessWorkspace, readOffline, account.controller, attempt]);
  const current = () => {
    const value = live.current;
    if (
      !value.active ||
      value.account.session?.user.id !== userId ||
      value.account.session?.sessionId !== sessionId ||
      value.business.workspace !== workspace
    )
      throw new Error("syncContextChanged");
  };
  const choose = async (shop: CloudShop) => {
    if (disabled) return;
    setLoading(true);
    setIssue("");
    try {
      const remote = (await account.controller.cloudRequest(
        `/backups/${shop.id}`,
      )) as SyncHead;
      current();
      setSelected(shop);
      setHead(remote);
    } catch (e) {
      setIssue(e instanceof Error ? e.message : "syncFailed");
    } finally {
      setLoading(false);
    }
  };
  const run = async (work: () => Promise<void>) => {
    if (disabled || lock.current) return;
    lock.current = true;
    setBusy(true);
    setDone(false);
    setIssue("");
    setProgress(0);
    setDownloadBytes({ received: 0, total: 0 });
    setPhase("download");
    try {
      current();
      await work();
    } catch (e) {
      if (live.current.active)
        setIssue(e instanceof Error ? e.message : "syncFailed");
    } finally {
      lock.current = false;
      if (live.current.active) setBusy(false);
    }
  };
  const sync = () =>
    void run(async () => {
      setUploading(false);
      if (!selected || !userId) return;
      const shop = selected;
      await synchronizeAccountShop(
        {
          begin: () => account.controller.beginSync(),
          assertCurrent: current,
          capture: () => live.current.business.data,
          head: async () =>
            (await account.controller.cloudRequest(
              `/backups/${shop.id}`,
            )) as SyncHead,
          download: async (version, onProgress) => {
            const file = new File(
              Paths.cache,
              `DokanX-sync-${Crypto.randomUUID()}.dokanx`,
            );
            try {
              await account.controller.cloudRequest(
                `/backups/${shop.id}/${version.id}/download`,
                {
                  saveTo: file.uri,
                  expectedBytes: version.bytes,
                  onProgress: (received, total) => {
                    if (live.current.active)
                      setDownloadBytes({ received, total });
                    onProgress(received, total);
                  },
                },
              );
              return file.uri;
            } catch (e) {
              if (file.exists) file.delete();
              throw e;
            }
          },
          validate: async (uri, version) => {
            const bytes = await new File(uri).bytes();
            const digest = await Crypto.digest(
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
            return readBackup(uri);
          },
          safety: async (data) => {
            const file = await createBackup(data, {
              metadataKey: manualBackupKey(workspace!),
            });
            setSafety(file.uri);
          },
          stage: stageRestore,
          activate: async (version, epoch) => {
            const receipt = (await account.controller.cloudRequest(
              `/backups/${shop.id}/sync/activate`,
              {
                body: {
                  requestKey: Crypto.randomUUID(),
                  versionId: version.id,
                  expectedEpoch: epoch,
                },
              },
            )) as { headId: string; epoch: number };
            if (receipt.headId !== version.id || receipt.epoch !== epoch + 1)
              throw new Error("invalidResponse");
          },
          restore: (data, expected) =>
            live.current.business.restore(data, expected),
          finish: async (version, data, preferences) => {
            await AsyncStorage.removeItem("@dokanx/printer/v1").catch(() => {});
            if (preferences?.language)
              await changeLanguage(preferences.language).catch(() => {});
            if (preferences?.theme)
              await setMode(preferences.theme).catch(() => {});
            current();
            await adoptCloudSnapshot(userId, shop, data, version);
            current();
            await account.controller.completeSync(shop.id);
          },
          remove: (uri) => {
            try {
              const file = new File(uri);
              if (file.exists) file.delete();
            } catch {}
          },
          progress: (stage, value) => {
            if (live.current.active) {
              setPhase(stage);
              setProgress(value);
            }
          },
        },
        shop,
      );
      current();
      setDone(true);
    });
  const startLocal = (copyOffline: boolean) =>
    void run(async () => {
      if (!userId || !workspace) return;
      setUploading(true);
      const target = localBusinessRepository.forWorkspace?.(workspace);
      if (!target) throw new Error("invalidWorkspace");
      const shop = await transferNativeLocalShop({
        userId,
        workspace,
        account: account.controller,
        current,
        source: copyOffline
          ? () => business.readOffline()
          : () => target.read(),
        target: () => target.read(),
        restore: (data, expected) =>
          live.current.business.restore(data, expected),
        safety: async (data) => {
          const file = await createBackup(data, {
            metadataKey: manualBackupKey(workspace),
          });
          if (live.current.active) setSafety(file.uri);
        },
        progress: (stage, value) => {
          if (live.current.active) {
            setPhase(stage);
            setProgress(value);
          }
        },
      });
      current();
      setSelected(shop);
      setDone(true);
    });
  const latest = head?.versions?.find((v) => v.id === head.headId);
  const goHome = () => router.replace("/(tabs)");
  if (!account.session)
    return (
      <Screen back title={t("accountSync.title")} fallbackHref="/account">
        <Button
          title={t("account.login")}
          onPress={() => router.replace("/account")}
        />
      </Screen>
    );
  const matchingShop = business.data.shopId === selected?.localShopId || done;
  return (
    <SyncLayout
      phone={account.session.user.phone}
      name={matchingShop ? business.data.ownerName : undefined}
      photo={matchingShop ? business.data.shopPhotoUri : undefined}
      shops={shops}
      selected={selected}
      latest={latest}
      uploading={uploading}
      offlineShop={offlineTransferAvailable ? offline : undefined}
      loading={loading}
      busy={busy}
      disabled={disabled}
      done={done}
      progress={progress}
      phase={phase}
      bytes={downloadBytes}
      issue={issue ? errorText(issue) : ""}
      canContinue={!!business.data.shopActive}
      localName={business.data.shopActive ? business.data.shopName : undefined}
      offlineName={offlineTransferAvailable ? offline?.shopName : undefined}
      hasSafety={!!safety}
      onChoose={(shop) => void choose(shop)}
      onRefresh={() => {
        if (disabled) return;
        setLoading(true);
        setIssue("");
        setAttempt((value) => value + 1);
      }}
      onSync={sync}
      onStart={startLocal}
      onRestore={() => router.push("/settings/backup")}
      onSetup={() => router.replace("/setup/basic")}
      onHome={goHome}
      onBack={() => {
        if (busy) return;
        if (router.canGoBack()) router.back();
        else router.replace("/account");
      }}
      onSafety={() => {
        if (safety)
          void shareBackup(safety).catch(() => setIssue("syncFailed"));
      }}
      onLogout={() => {
        if (busy || account.busy) return;
        void account.controller
          .logout()
          .then(() => router.replace("/"))
          .catch(() => setIssue("syncFailed"));
      }}
    />
  );
}
