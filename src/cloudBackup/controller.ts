export type CloudVersion = {
  id: string;
  snapshotHash: string;
  archiveHash: string;
  bytes: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
  products: number | null;
  invoices: number | null;
  assets: number | null;
};
export type PendingUpload = {
  requestKey: string;
  baseId?: string;
  signature: string;
  archiveHash: string;
  bytes: number;
  uri: string;
};
type Settings = {
  enabled: boolean;
  generation: string;
  checkedAt: number;
  checkpoint?: { id: string; signature: string; at: string };
  upload?: PendingUpload;
};
export type BackupState = {
  ready: boolean;
  busy: boolean;
  enabled: boolean;
  error: string;
  lastSuccess?: string;
  pending: boolean;
  versions: CloudVersion[];
  canUpload: boolean;
};
type Dependencies = {
  diagnostic?: (stage: string, error: string) => void;
  read: () => Promise<string | null>;
  write: (settings: string) => Promise<void>;
  generation: () => Promise<string>;
  current: () => boolean;
  now?: () => number;
  signature: () => Promise<string>;
  prepare: (baseId?: string) => Promise<PendingUpload>;
  exists: (uri: string) => boolean;
  remove: (uri: string) => void;
  request: (
    path: string,
    options?: { body?: unknown; fileUri?: string; saveTo?: string },
  ) => Promise<unknown>;
};
const INTERVAL = 10 * 60_000;
const validVersion = (v: unknown): v is CloudVersion => {
  const x = v as CloudVersion;
  return (
    !!x &&
    typeof x.id === "string" &&
    /^[a-f0-9]{64}$/.test(x.snapshotHash) &&
    /^[a-f0-9]{64}$/.test(x.archiveHash) &&
    Number.isSafeInteger(x.bytes) &&
    x.bytes > 0 &&
    x.bytes <= 60_000_000 &&
    ["created", "complete"].includes(x.status)
  );
};
export function createCloudBackupController(deps: Dependencies) {
  let settings: Settings = { enabled: false, generation: "", checkedAt: 0 },
    loaded: Promise<void> | undefined,
    failures = 0,
    retryAt = 0;
  let state: BackupState = {
    ready: false,
    busy: false,
    enabled: false,
    error: "",
    pending: true,
    versions: [],
    canUpload: true,
  };
  const listeners = new Set<() => void>(),
    now = deps.now ?? Date.now;
  const set = (patch: Partial<BackupState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };
  const current = () => {
    if (!deps.current()) throw new Error("backupContextChanged");
  };
  const save = async () => {
    await deps.write(JSON.stringify(settings));
  };
  const load = () =>
    (loaded ??= (async () => {
      try {
        const raw = await deps.read();
        const generation = await deps.generation();
        if (raw) {
          const parsed = JSON.parse(raw) as Settings;
          if (
            typeof parsed.enabled !== "boolean" ||
            typeof parsed.generation !== "string" ||
            !Number.isFinite(parsed.checkedAt) ||
            (parsed.checkpoint &&
              (typeof parsed.checkpoint.id !== "string" ||
                typeof parsed.checkpoint.signature !== "string" ||
                !Number.isFinite(Date.parse(parsed.checkpoint.at)))) ||
            (parsed.upload &&
              (typeof parsed.upload.requestKey !== "string" ||
                typeof parsed.upload.uri !== "string" ||
                !/^[a-f0-9]{64}$/.test(parsed.upload.archiveHash) ||
                !/^[a-f0-9]{64}$/.test(parsed.upload.signature) ||
                !Number.isSafeInteger(parsed.upload.bytes)))
          )
            throw new Error("backupSettings");
          settings = parsed;
        } else settings.generation = generation;
        set({
          ready: true,
          enabled: settings.enabled,
          lastSuccess: settings.checkpoint?.at,
          ...(settings.generation !== generation
            ? { enabled: false, error: "backupRestored" }
            : {}),
        });
      } catch {
        set({ ready: true, error: "backupSettings" });
      }
    })());
  const refresh = async () => {
    current();
    const response = (await deps.request("")) as {
      headId: string | null;
      canUpload: boolean;
      versions: CloudVersion[];
    };
    current();
    if (
      !response ||
      typeof response.canUpload !== "boolean" ||
      !Array.isArray(response.versions) ||
      response.versions.some((v) => !validVersion(v) || v.status !== "complete")
    )
      throw new Error("invalidResponse");
    set({ versions: response.versions, canUpload: response.canUpload });
    return response;
  };
  return {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load,
    async setEnabled(enabled: boolean) {
      await load();
      if (state.busy) return;
      if (settings.generation !== (await deps.generation())) {
        set({ enabled: false, error: "backupRestored" });
        return;
      }
      current();
      settings = { ...settings, enabled, checkedAt: now() };
      await save();
      set({ enabled, error: "" });
    },
    async refresh() {
      await load();
      if (state.busy) return;
      set({ busy: true, error: "" });
      try {
        await refresh();
      } catch (e) {
        set({ error: e instanceof Error ? e.message : "backupFailed" });
      } finally {
        set({ busy: false });
      }
    },
    async check(manual = false) {
      await load();
      if (
        state.busy ||
        !deps.current() ||
        (!manual &&
          (!state.enabled ||
            now() < retryAt ||
            now() - settings.checkedAt < INTERVAL))
      )
        return;
      set({ busy: true, error: "" });
      let stage = "check";
      try {
        current();
        if (settings.generation !== (await deps.generation())) {
          set({ enabled: false });
          throw new Error("backupRestored");
        }
        const signature = await deps.signature();
        current();
        if (!settings.upload && signature === settings.checkpoint?.signature) {
          settings = { ...settings, checkedAt: now() };
          await save();
          set({ pending: false, lastSuccess: settings.checkpoint?.at });
          return;
        }
        stage = "list";
        const remote = await refresh();
        if (!remote.canUpload) throw new Error("backupDifferentDevice");
        if (!settings.upload) {
          if (remote.headId !== (settings.checkpoint?.id ?? null))
            throw new Error("backupHeadChanged");
          stage = "prepare";
          const upload = await deps.prepare(settings.checkpoint?.id);
          current();
          settings = { ...settings, upload };
          try {
            await save();
          } catch (error) {
            settings = { ...settings, upload: undefined };
            deps.remove(upload.uri);
            throw error;
          }
        }
        const pending = settings.upload!;
        current();
        stage = "create upload";
        const created = await deps.request("", {
          body: {
            requestKey: pending.requestKey,
            baseId: pending.baseId,
            snapshotHash: pending.signature,
            archiveHash: pending.archiveHash,
            bytes: pending.bytes,
          },
        });
        current();
        if (
          !validVersion(created) ||
          created.archiveHash !== pending.archiveHash ||
          created.snapshotHash !== pending.signature
        )
          throw new Error("invalidResponse");
        let complete = created;
        if (created.status !== "complete") {
          if (!deps.exists(pending.uri)) {
            settings = { ...settings, upload: undefined };
            await save();
            throw new Error("backupTempMissing");
          }
          current();
          stage = "upload";
          const result = await deps.request(`/${created.id}/upload`, {
            fileUri: pending.uri,
          });
          current();
          if (
            !validVersion(result) ||
            result.id !== created.id ||
            result.archiveHash !== pending.archiveHash ||
            result.snapshotHash !== pending.signature ||
            result.status !== "complete"
          )
            throw new Error("invalidResponse");
          complete = result;
        }
        if (
          !complete.completedAt ||
          !Number.isFinite(Date.parse(complete.completedAt))
        )
          throw new Error("invalidResponse");
        stage = "save checkpoint";
        const previous = settings;
        settings = {
          ...settings,
          upload: undefined,
          checkedAt: now(),
          checkpoint: {
            id: complete.id,
            signature: pending.signature,
            at: complete.completedAt,
          },
        };
        try {
          await save();
        } catch (error) {
          settings = previous;
          throw error;
        }
        deps.remove(pending.uri);
        failures = 0;
        retryAt = 0;
        set({
          lastSuccess: complete.completedAt,
          pending: (await deps.signature()) !== pending.signature,
        });
        await refresh();
      } catch (e) {
        let error = e instanceof Error ? e.message : "backupFailed";
        deps.diagnostic?.(stage, /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(error) ? error : "nativeOperationFailed");
        if (
          ["backupExpired", "invalidBackup"].includes(error) &&
          settings.upload
        ) {
          const previous = settings;
          settings = { ...settings, upload: undefined };
          try {
            await save();
            deps.remove(previous.upload!.uri);
          } catch {
            settings = previous;
            error = "backupSettings";
          }
        }
        failures++;
        retryAt =
          now() + Math.min(INTERVAL, 30_000 * 2 ** Math.min(failures - 1, 5));
        set({ error, pending: true });
      } finally {
        set({ busy: false });
      }
    },
  };
}
