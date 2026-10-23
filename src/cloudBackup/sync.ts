import type { BusinessData } from "../store/business.ts";
import type { CloudVersion } from "./controller.ts";
import type { BackupManifest } from "../store/backupFormat.ts";
export type CloudShop = { id: string; localShopId: string; name: string };
export type SyncHead = {
  headId: string | null;
  epoch: number;
  versions: CloudVersion[];
};
export type SyncPhase =
  "download" | "upload" | "validate" | "safety" | "activate" | "save" | "complete";
type ParsedBackup = {
  manifest: BackupManifest;
  assets: Record<string, Uint8Array>;
};
export async function synchronizeAccountShop(
  deps: {
    begin: () => Promise<void>;
    assertCurrent: () => void;
    capture: () => BusinessData;
    head: () => Promise<SyncHead>;
    download: (
      version: CloudVersion,
      progress: (received: number, total: number) => void,
    ) => Promise<string>;
    validate: (uri: string, version: CloudVersion) => Promise<ParsedBackup>;
    safety: (data: BusinessData) => Promise<void>;
    stage: (
      backup: ParsedBackup,
    ) => Promise<{ data: BusinessData; cleanup: () => void }>;
    activate: (version: CloudVersion, epoch: number) => Promise<void>;
    restore: (data: BusinessData, expected: string) => Promise<void>;
    finish: (
      version: CloudVersion,
      data: BusinessData,
      preferences: ParsedBackup["manifest"]["preferences"],
    ) => Promise<void>;
    remove: (uri: string) => void;
    progress: (phase: SyncPhase, progress: number) => void;
  },
  shop: CloudShop,
) {
  deps.assertCurrent();
  await deps.begin();
  deps.assertCurrent();
  const before = deps.capture(),
    expected = JSON.stringify(before);
  const head = await deps.head();
  deps.assertCurrent();
  const version = head.versions.find(
    (v) => v.id === head.headId && v.status === "complete",
  );
  if (!version || !Number.isSafeInteger(head.epoch) || head.epoch < 1)
    throw new Error("syncNoBackup");
  let uri: string | undefined,
    staged: Awaited<ReturnType<typeof deps.stage>> | undefined,
    applied = false;
  try {
    deps.progress("download", 0);
    uri = await deps.download(version, (received, total) => {
      if (total > 0)
        deps.progress("download", Math.min(0.85, (received / total) * 0.85));
    });
    deps.assertCurrent();
    deps.progress("validate", 0.87);
    const backup = await deps.validate(uri, version);
    deps.assertCurrent();
    if (backup.manifest.data.shopId !== shop.localShopId)
      throw new Error("invalidBackup");
    if (JSON.stringify(deps.capture()) !== expected)
      throw new Error("restoreStale");
    deps.progress("safety", 0.9);
    await deps.safety(before);
    deps.assertCurrent();
    staged = await deps.stage(backup);
    deps.assertCurrent();
    if (JSON.stringify(deps.capture()) !== expected)
      throw new Error("restoreStale");
    deps.progress("activate", 0.93);
    await deps.activate(version, head.epoch);
    deps.assertCurrent();
    deps.progress("save", 0.96);
    await deps.restore(staged.data, expected);
    applied = true;
    deps.assertCurrent();
    await deps.finish(version, staged.data, backup.manifest.preferences);
    deps.assertCurrent();
    deps.progress("complete", 1);
    return staged.data;
  } finally {
    if (staged && !applied) staged.cleanup();
    if (uri) deps.remove(uri);
  }
}
