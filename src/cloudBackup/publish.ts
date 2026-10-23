import type { BusinessData } from "../store/business.ts";
import type { CloudShop, SyncHead } from "./sync.ts";
import type { createCloudBackupController } from "./controller.ts";

export type PublicationReview = {
  expected: string;
  shop?: CloudShop;
  head: SyncHead;
};

export async function reviewLocalPublication(deps: {
  current: () => void;
  capture: () => BusinessData;
  shops: () => Promise<CloudShop[]>;
  head: (shop: CloudShop) => Promise<SyncHead>;
}): Promise<PublicationReview> {
  deps.current();
  const data = deps.capture(), expected = JSON.stringify(data);
  if (!data.shopActive || !data.shopId) throw new Error("invalidShop");
  const shops = await deps.shops();
  deps.current();
  const shop = shops.find(s => s.localShopId === data.shopId);
  const head = shop ? await deps.head(shop) : { headId: null, epoch: 0, versions: [] };
  deps.current();
  if (JSON.stringify(deps.capture()) !== expected) throw new Error("restoreStale");
  return { expected, shop, head };
}

/** Publish only the explicitly reviewed local snapshot. Never download or merge it. */
export async function publishLocalShop(deps: {
  current: () => void;
  capture: () => BusinessData;
  begin: () => Promise<void>;
  link: (data: BusinessData) => Promise<CloudShop>;
  head: (shop: CloudShop) => Promise<SyncHead>;
  claim: (shop: CloudShop, head: SyncHead) => Promise<{ headId: string | null; epoch: number }>;
  publisher: (shop: CloudShop, head: SyncHead) => Promise<ReturnType<typeof createCloudBackupController>>;
  finish: (shop: CloudShop) => Promise<void>;
}, review: PublicationReview) {
  const unchanged = () => {
    deps.current();
    if (JSON.stringify(deps.capture()) !== review.expected) throw new Error("restoreStale");
  };
  unchanged();
  await deps.begin();
  unchanged();
  const data = deps.capture(), shop = review.shop ?? await deps.link(data);
  unchanged();
  if (shop.localShopId !== data.shopId) throw new Error("invalidShop");
  const head = await deps.head(shop);
  unchanged();
  if (head.headId !== review.head.headId || head.epoch !== review.head.epoch)
    throw new Error("syncHeadChanged");
  const receipt = await deps.claim(shop, head);
  unchanged();
  const nextEpoch = head.epoch === 0 ? 1 : head.epoch + 1;
  if (receipt.headId !== head.headId || receipt.epoch !== nextEpoch)
    throw new Error("invalidResponse");
  const publisher = await deps.publisher(shop, head);
  unchanged();
  return completeLocalPublication(deps, publisher, shop);
}

export async function completeLocalPublication(deps: {
  current: () => void;
  finish: (shop: CloudShop) => Promise<void>;
}, publisher: ReturnType<typeof createCloudBackupController>, shop: CloudShop) {
  deps.current();
  await publisher.check(true);
  deps.current();
  const result = publisher.snapshot();
  if (result.error || !result.lastSuccess) throw new Error(result.error || "backupFailed");
  await publisher.setEnabled(true);
  deps.current();
  const enabled = publisher.snapshot();
  if (!enabled.enabled || enabled.error) throw new Error(enabled.error || "backupSettings");
  await deps.finish(shop);
  deps.current();
  return result.lastSuccess;
}

/** A remote base is not proof that these restored local records were uploaded. */
export function localPublicationSettings(generation: string, head: SyncHead) {
  const version = head.versions.find(v => v.id === head.headId && v.status === "complete");
  if (head.headId && (!version?.completedAt || !Number.isFinite(Date.parse(version.completedAt))))
    throw new Error("invalidResponse");
  return {
    enabled: false, generation, checkedAt: 0,
    ...(version ? { checkpoint: { id: version.id, signature: "", at: version.completedAt! } } : {}),
  };
}
