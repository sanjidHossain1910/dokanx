import {
  emptyBusiness,
  parseBusiness,
  type BusinessData,
} from "../store/business.ts";
import { canonical } from "./records.ts";
import type { CloudShop, SyncHead, SyncPhase } from "./sync.ts";
import type { createCloudBackupController } from "./controller.ts";
import { completeLocalPublication } from "./publish.ts";

export type LocalTransferRecord = {
  version: 1;
  sourceHash: string;
  generation: string;
  claimBefore: number;
  claimed: boolean;
};
export type TransferHead = SyncHead & { canUpload: boolean };
export function validLocalTransfer(
  value: unknown,
): value is LocalTransferRecord {
  const r = value as LocalTransferRecord;
  return (
    !!r &&
    r.version === 1 &&
    typeof r.sourceHash === "string" &&
    /^[a-f0-9]{64}$/.test(r.sourceHash) &&
    typeof r.generation === "string" &&
    !!r.generation &&
    Number.isSafeInteger(r.claimBefore) &&
    r.claimBefore >= 0 &&
    typeof r.claimed === "boolean"
  );
}
function occupied(data: BusinessData) {
  return Object.entries(data).some(([key, value]) =>
    key in emptyBusiness
      ? canonical(value) !== canonical(emptyBusiness[key as keyof BusinessData])
      : value !== undefined &&
        value !== null &&
        value !== false &&
        value !== "" &&
        !(Array.isArray(value) && !value.length),
  );
}

/** Copies a complete local shop and publishes it without merging or overwriting a cloud shop. */
export async function transferLocalShop(deps: {
  current: () => void;
  source: () => Promise<BusinessData>;
  target: () => Promise<BusinessData>;
  fingerprint: (data: BusinessData) => Promise<string>;
  generation: () => Promise<string>;
  begin: () => Promise<void>;
  link: (data: BusinessData) => Promise<CloudShop>;
  head: (shop: CloudShop) => Promise<TransferHead>;
  read: (shop: CloudShop) => Promise<LocalTransferRecord | undefined>;
  write: (
    shop: CloudShop,
    record: LocalTransferRecord | undefined,
  ) => Promise<void>;
  safety: (data: BusinessData) => Promise<void>;
  restore: (data: BusinessData, expected: string) => Promise<void>;
  claim: (
    shop: CloudShop,
    epoch: number,
  ) => Promise<{ headId: string | null; epoch: number }>;
  publisher: (
    shop: CloudShop,
    data: BusinessData,
    record: LocalTransferRecord,
  ) => Promise<ReturnType<typeof createCloudBackupController>>;
  finish: (shop: CloudShop) => Promise<void>;
  progress: (phase: SyncPhase, progress: number) => void;
}) {
  deps.current();
  deps.progress("validate", 0.05);
  // Copy the entire versioned payload, including newly added supported shop fields.
  const source = parseBusiness(JSON.stringify(await deps.source()));
  if (!source.shopActive || !source.shopId) throw new Error("invalidShop");
  const sourceHash = await deps.fingerprint(source);
  const before = await deps.target(),
    expected = JSON.stringify(before);
  const same = (await deps.fingerprint(before)) === sourceHash;
  deps.current();
  if (!same && occupied(before)) throw new Error("localTransferOccupied");
  await deps.begin();
  deps.current();
  const shop = await deps.link(source);
  deps.current();
  if (shop.localShopId !== source.shopId) throw new Error("invalidShop");
  let record = await deps.read(shop);
  let remote = await deps.head(shop);
  deps.current();
  if (
    !Number.isSafeInteger(remote.epoch) ||
    remote.epoch < 0 ||
    !Array.isArray(remote.versions) ||
    !(remote.headId === null || typeof remote.headId === "string")
  )
    throw new Error("invalidResponse");
  if (
    record &&
    (!validLocalTransfer(record) ||
      record.sourceHash !== sourceHash ||
      record.generation !== (await deps.generation()))
  )
    throw new Error("localTransferChanged");
  if (!record && remote.headId) throw new Error("syncAlreadyExists");
  const unchanged = async () => {
    deps.current();
    if ((await deps.fingerprint(await deps.source())) !== sourceHash)
      throw new Error("localTransferChanged");
    deps.current();
  };
  await unchanged();
  if (!record) {
    if (!same) {
      deps.progress("safety", 0.15);
      await deps.safety(before);
      await unchanged();
      deps.progress("save", 0.3);
      await deps.restore(source, expected);
      deps.current();
    }
    record = {
      version: 1,
      sourceHash,
      generation: await deps.generation(),
      claimBefore: remote.epoch,
      claimed: false,
    };
    await deps.write(shop, record);
    deps.current();
  }
  const targetUnchanged = async () => {
    await unchanged();
    if (
      (await deps.fingerprint(await deps.target())) !== sourceHash ||
      (await deps.generation()) !== record!.generation
    )
      throw new Error("localTransferChanged");
    deps.current();
  };
  await targetUnchanged();
  if (!record.claimed) {
    deps.progress("activate", 0.4);
    remote = await deps.head(shop);
    deps.current();
    if (remote.headId) throw new Error("syncHeadChanged");
    const nextEpoch = record.claimBefore === 0 ? 1 : record.claimBefore + 1;
    if (remote.epoch === record.claimBefore) {
      const receipt = await deps.claim(shop, record.claimBefore);
      deps.current();
      if (receipt.headId !== null || receipt.epoch !== nextEpoch)
        throw new Error("invalidResponse");
    } else if (remote.epoch !== nextEpoch || !remote.canUpload)
      throw new Error("syncHeadChanged");
    record = { ...record, claimed: true };
    await deps.write(shop, record);
    deps.current();
  }
  await targetUnchanged();
  deps.progress("upload", 0.55);
  const publisher = await deps.publisher(shop, source, record);
  deps.current();
  await completeLocalPublication(
    {
      current: deps.current,
      finish: async (selected) => {
        await targetUnchanged();
        await deps.finish(selected);
        deps.current();
      },
    },
    publisher,
    shop,
  );
  // Keep the small recovery record until publication AND account activation succeed.
  await deps.write(shop, undefined);
  deps.current();
  deps.progress("complete", 1);
  return shop;
}
