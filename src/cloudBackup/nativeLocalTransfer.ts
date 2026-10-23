import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import type { createAccountController } from "../account/controller";
import type { BusinessData } from "../store/business";
import { canonical } from "./records";
import {
  cloudGenerationKey,
  cloudSettingsKey,
  CLOUD_GENERATION_KEY,
} from "./keys";
import { createNativePublisher } from "./nativePublisher";
import {
  transferLocalShop,
  validLocalTransfer,
  type TransferHead,
} from "./localTransfer";
import type { CloudShop, SyncPhase } from "./sync";

export function transferNativeLocalShop(deps: {
  userId: string;
  workspace: string;
  account: ReturnType<typeof createAccountController>;
  current: () => void;
  source: () => Promise<BusinessData>;
  target: () => Promise<BusinessData>;
  restore: (data: BusinessData, expected: string) => Promise<void>;
  safety: (data: BusinessData) => Promise<void>;
  progress: (phase: SyncPhase, progress: number) => void;
}) {
  const storageKey = (shop: CloudShop) =>
    cloudSettingsKey(deps.userId, shop.id, shop.localShopId);
  const recordKey = (shop: CloudShop) =>
    storageKey(shop) + "/local-transfer-v1";
  const generation = async () =>
    (await AsyncStorage.getItem(cloudGenerationKey(deps.workspace))) ??
    (await AsyncStorage.getItem(CLOUD_GENERATION_KEY)) ??
    "initial";
  const head = async (shop: CloudShop) => {
    const remote = (await deps.account.cloudRequest(
      `/backups/${shop.id}`,
    )) as TransferHead;
    deps.current();
    if (
      !remote ||
      typeof remote.canUpload !== "boolean" ||
      !Array.isArray(remote.versions) ||
      !Number.isSafeInteger(remote.epoch) ||
      remote.epoch < 0 ||
      !(remote.headId === null || typeof remote.headId === "string")
    )
      throw new Error("invalidResponse");
    return remote;
  };
  return transferLocalShop({
    ...deps,
    generation,
    head,
    fingerprint: (data) =>
      Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        canonical(data),
      ),
    begin: () => deps.account.beginSync(),
    link: async (data) => {
      await deps.account.linkShop(data.shopId!, data.shopName);
      deps.current();
      const shop = deps.account.snapshot().session?.binding;
      if (!shop) throw new Error("invalidResponse");
      return shop;
    },
    read: async (shop) => {
      const raw = await AsyncStorage.getItem(recordKey(shop));
      deps.current();
      if (!raw) return undefined;
      const record: unknown = JSON.parse(raw);
      if (!validLocalTransfer(record)) throw new Error("backupSettings");
      return record;
    },
    write: async (shop, record) => {
      deps.current();
      if (record)
        await AsyncStorage.setItem(recordKey(shop), JSON.stringify(record));
      else await AsyncStorage.removeItem(recordKey(shop));
      deps.current();
    },
    claim: async (shop, epoch) =>
      (await deps.account.cloudRequest(`/backups/${shop.id}/sync/claim-empty`, {
        body: { expectedEpoch: epoch },
      })) as { headId: string | null; epoch: number },
    publisher: async (shop, data, record) => {
      const key = storageKey(shop),
        raw = await AsyncStorage.getItem(key);
      deps.current();
      const settings = raw
        ? JSON.parse(raw)
        : { enabled: false, generation: record.generation, checkedAt: 0 };
      if (settings.generation !== record.generation)
        throw new Error("backupRestored");
      const remote = await head(shop);
      if (!remote.canUpload) throw new Error("backupDifferentDevice");
      if (remote.headId) {
        const version = remote.versions.find(
          (v) => v.id === remote.headId && v.status === "complete",
        );
        const acknowledged = settings.checkpoint?.id === remote.headId;
        const lostReply =
          settings.upload &&
          version &&
          version.archiveHash === settings.upload.archiveHash &&
          version.snapshotHash === settings.upload.signature;
        if (!acknowledged && !lostReply) throw new Error("syncHeadChanged");
      }
      if (!raw) {
        await AsyncStorage.setItem(key, JSON.stringify(settings));
        deps.current();
      }
      return createNativePublisher({
        storageKey: key,
        generation,
        current: () => {
          try {
            deps.current();
            return true;
          } catch {
            return false;
          }
        },
        capture: () => data,
        request: (path, options) =>
          deps.account.cloudRequest(`/backups/${shop.id}${path}`, options),
      });
    },
    finish: async (shop) => {
      const raw = await AsyncStorage.getItem(storageKey(shop));
      deps.current();
      if (!raw) throw new Error("backupSettings");
      const saved = JSON.parse(raw),
        remote = await head(shop);
      if (
        !remote.canUpload ||
        !saved.checkpoint?.id ||
        saved.checkpoint.id !== remote.headId ||
        saved.upload ||
        saved.generation !== (await generation())
      )
        throw new Error("syncHeadChanged");
      deps.current();
      await deps.account.completeSync(shop.id);
    },
  });
}
