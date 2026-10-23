import {
  applyChanges,
  canonical,
  changesSince,
  fingerprints,
  type Records,
} from "./records.ts";
import { latestChanges } from "./isolation.ts";
import type { LocalChange, OutboxAck } from "./outboxTypes.ts";
export const DEFAULT_SYNC_MINUTES = 10;
export function validSyncMinutes(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 2 &&
    value <= 1440
  );
}
export function syncFailureDetail(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error);
  return message
    .replace(
      /(?:file|content|https?):\/\/[^\s'"\)]+|(?:[A-Za-z]:\\|\/(?:data|storage)\/)[^\s'"\)]+/g,
      "<local-path>",
    )
    .replace(/\b(?:Bearer\s+)?[A-Za-z0-9_-]{43,}\b/g, "<redacted>")
    .slice(0, 300);
}
type Reply = {
  more?: boolean;
  ack?: OutboxAck;
  generation: string;
  cursor: number;
  changes: { key: string; value: unknown | null }[];
  uploaded: number;
};
type Pending = {
  incoming?: LocalChange[];
  ack?: OutboxAck;
  remote: Records;
  sent: Record<string, string>;
  generation: string;
  cursor: number;
};
export type IncrementalSettings = {
  deferred?: LocalChange[];
  intervalMinutes?: number;
  retryAt?: number;
  receipt?: OutboxAck;
  baselineVersion?: string;
  legacyCheckpointId?: string;
  generation: string;
  enabled: boolean;
  autoRestore: boolean;
  cursor: number;
  serverGeneration?: string;
  base: Record<string, string>;
  checkedAt: number;
  lastSuccess?: string;
  pending?: Pending;
};
export type IncrementalState = {
  intervalMinutes: number;
  draining?: boolean;
  ready: boolean;
  busy: boolean;
  enabled: boolean;
  autoRestore: boolean;
  error: string;
  pending: boolean;
  lastSuccess?: string;
  uploaded: number;
  downloaded: number;
  failureStage?: string;
};
export function createIncrementalSync(deps: {
  isolateConflicts?: () => boolean;
  reconcile?: (
    local: Records,
    changes: LocalChange[],
  ) => Promise<{
    records: Records;
    deferred: LocalChange[];
    protectedKeys: string[];
  }>;
  acknowledge?: (result: OutboxAck) => Promise<void>;
  release?: () => Promise<void>;
  baseline?: (
    id: string,
  ) => Promise<{ generation: string; hashes: Record<string, string> }>;
  diagnostic?: (stage: string, code: string, message?: string) => void;
  current: () => boolean;
  generation: () => Promise<string>;
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  capture: () => Promise<{
    records: Records;
    expected: string;
    queueSequence?: number;
    queueGeneration?: string;
  }>;
  hash: (s: string) => Promise<string>;
  exchange: (input: {
    generation?: string;
    cursor: number;
    changes: ReturnType<typeof changesSince>;
    pull: boolean;
    base?: Record<string, string>;
    queueSequence?: number;
    queueGeneration?: string;
  }) => Promise<Reply>;
  apply: (records: Records, expected: string) => Promise<void>;
  now?: () => number;
}) {
  const isolationEnabled = () =>
    !!deps.reconcile && (deps.isolateConflicts?.() ?? true);
  const now = deps.now ?? Date.now,
    listeners = new Set<() => void>();
  let settings: IncrementalSettings = {
      generation: "",
      enabled: false,
      autoRestore: false,
      cursor: 0,
      base: {},
      checkedAt: 0,
    },
    loading: Promise<void> | undefined;
  let healthy = false;
  let state: IncrementalState = {
    intervalMinutes: DEFAULT_SYNC_MINUTES,
    ready: false,
    busy: false,
    enabled: false,
    autoRestore: false,
    error: "",
    pending: true,
    uploaded: 0,
    downloaded: 0,
  };
  const set = (patch: Partial<IncrementalState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };
  const current = () => {
    if (!deps.current()) throw new Error("backupContextChanged");
  };
  const save = async () => {
    current();
    await deps.write(JSON.stringify(settings));
    current();
  };
  const checkGeneration = async () => {
    current();
    if ((await deps.generation()) !== settings.generation)
      throw new Error("backupRestored");
    current();
  };
  async function settle() {
    const pending = settings.pending;
    if (!pending) return;
    if (pending.ack) {
      // A prior checkpoint write may have failed while leaving this in memory.
      await save();
      await deps.acknowledge?.(pending.ack);
      // New unsent edits must start from the last accepted hash, even if they touch the same key.
      for (const change of pending.ack.acceptedChanges) {
        if (change.value === null) delete settings.base[change.key];
        else
          settings.base[change.key] = await deps.hash(canonical(change.value));
      }
    }
    const received =
      pending.incoming ??
      (isolationEnabled()
        ? changesSince(
            pending.remote,
            await fingerprints(pending.remote, deps.hash),
            pending.sent,
          ).map((c) => ({ key: c.key, value: c.value }))
        : undefined);
    const incoming = received
      ? latestChanges([...(settings.deferred ?? []), ...received])
      : undefined;
    const serverRecords = incoming
      ? applyChanges(pending.remote, incoming)
      : pending.remote;
    const remoteHashes = await fingerprints(serverRecords, deps.hash);
    for (let attempt = 0; attempt < 3; attempt++) {
      await checkGeneration();
      const local = await deps.capture(),
        hashes = await fingerprints(local.records, deps.hash);
      const isolated =
        isolationEnabled() && incoming
          ? await deps.reconcile!(local.records, incoming)
          : undefined;
      const merged =
        isolated?.records ??
        (Object.assign(Object.create(null), pending.remote) as Records);
      if (!isolated)
        for (const key of new Set([
          ...Object.keys(pending.sent),
          ...Object.keys(local.records),
        ])) {
          if (hashes[key] === pending.sent[key]) continue;
          if (
            remoteHashes[key] !== pending.sent[key] &&
            remoteHashes[key] !== hashes[key]
          )
            throw new Error("syncConflict");
          if (key in local.records) merged[key] = local.records[key];
          else delete merged[key];
        }
      current();
      try {
        await deps.apply(merged, local.expected);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "restoreStale" &&
          attempt < 2
        )
          continue;
        throw error;
      }
      if (isolated)
        for (const key of isolated.protectedKeys)
          if (settings.base[key] === undefined) delete remoteHashes[key];
      settings = {
        ...settings,
        base: isolated
          ? Object.assign(
              remoteHashes,
              Object.fromEntries(
                isolated.protectedKeys
                  .filter((key) => settings.base[key] !== undefined)
                  .map((key) => [key, settings.base[key]]),
              ),
            )
          : remoteHashes,
        deferred: isolated?.deferred ?? settings.deferred,
        cursor: pending.cursor,
        serverGeneration: pending.generation,
        pending: undefined,
        checkedAt: now(),
        retryAt: undefined,
        lastSuccess: new Date(now()).toISOString(),
      };
      await save();
      set({
        lastSuccess: settings.lastSuccess,
        pending:
          !!isolated?.deferred.length ||
          canonical(merged) !== canonical(pending.remote),
      });
      return;
    }
  }
  async function settleReceipt() {
    const receipt = settings.receipt;
    if (!receipt) return;
    await save();
    await deps.acknowledge?.(receipt);
    const base = { ...settings.base };
    for (const change of receipt.acceptedChanges) {
      if (change.value === null) delete base[change.key];
      else base[change.key] = await deps.hash(canonical(change.value));
    }
    settings = { ...settings, base, receipt: undefined };
    await save();
    return receipt.rejected.find(
      (r) => r.status !== "conflict" || !isolationEnabled(),
    )?.code;
  }
  async function configure(
    patch: Partial<
      Pick<IncrementalSettings, "enabled" | "autoRestore" | "intervalMinutes">
    >,
  ): Promise<void> {
    await api.load();
    if (!healthy) throw new Error("backupSettings");
    if (state.busy) throw new Error("backupBusy");
    await checkGeneration();
    if (state.busy) throw new Error("backupBusy");
    set({ busy: true });
    const previous = settings;
    try {
      settings = { ...settings, ...patch };
      await save();
      set(patch);
    } catch (error) {
      settings = previous;
      throw error;
    } finally {
      set({ busy: false });
    }
  }
  const api = {
    snapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load() {
      loading ??= (async () => {
        try {
          const raw = await deps.read();
          current();
          const generation = await deps.generation();
          if (raw) {
            settings = JSON.parse(raw) as IncrementalSettings;
            if (
              typeof settings.enabled !== "boolean" ||
              typeof settings.autoRestore !== "boolean" ||
              (settings.intervalMinutes !== undefined &&
                !validSyncMinutes(settings.intervalMinutes)) ||
              (settings.retryAt !== undefined &&
                (!Number.isFinite(settings.retryAt) || settings.retryAt < 0)) ||
              !Number.isSafeInteger(settings.cursor) ||
              settings.cursor < 0 ||
              !settings.base ||
              typeof settings.base !== "object" ||
              Array.isArray(settings.base) ||
              Object.values(settings.base).some(
                (value) =>
                  typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value),
              ) ||
              typeof settings.generation !== "string" ||
              !Number.isFinite(settings.checkedAt)
            )
              throw new Error("backupSettings");
          } else settings.generation = generation;
          healthy = true;
          set({
            intervalMinutes: settings.intervalMinutes ?? DEFAULT_SYNC_MINUTES,
            ready: true,
            enabled: settings.enabled,
            autoRestore: settings.autoRestore,
            lastSuccess: settings.lastSuccess,
            ...(settings.generation !== generation
              ? { error: "backupRestored" }
              : {}),
          });
        } catch {
          deps.diagnostic?.("settings", "backupSettings");
          loading = undefined;
          set({
            ready: true,
            error: "backupSettings",
          });
        }
      })();
      return loading;
    },
    async prepareReview() {
      await api.load();
      if (!healthy) throw new Error("backupSettings");
      if (state.busy) throw new Error("backupBusy");
      await checkGeneration();
      set({ busy: true });
      try {
        await settleReceipt();
        if (settings.pending?.ack) {
          await save();
          await deps.acknowledge?.(settings.pending.ack);
        }
        // Refetch remote records from the unchanged cursor after explicit review.
        settings = {
          ...settings,
          pending: undefined,
          deferred: settings.pending?.incoming
            ? latestChanges([
                ...(settings.deferred ?? []),
                ...settings.pending.incoming,
              ])
            : settings.deferred,
        };
        await save();
        if (!settings.serverGeneration) throw new Error("syncBaselineMissing");
        return {
          generation: settings.serverGeneration,
          cursor: settings.cursor,
          base: { ...settings.base },
          deferred: settings.deferred ?? [],
        };
      } finally {
        set({ busy: false });
      }
    },
    async setEnabled(value: boolean) {
      await configure({ enabled: value });
    },
    async setIntervalMinutes(value: number) {
      if (!validSyncMinutes(value)) throw new Error("invalidSyncInterval");
      await configure({ intervalMinutes: value });
    },
    async setAutoRestore(value: boolean) {
      await configure({ autoRestore: value });
    },
    async check(manual = false, continuation = false) {
      await api.load();
      if (
        !healthy ||
        state.busy ||
        !deps.current() ||
        (!manual &&
          [
            ...(isolationEnabled() ? [] : ["syncConflict", "syncInvalidMerge"]),
            "syncReset",
            "backupRestored",
          ].includes(state.error)) ||
        (!manual &&
          (!settings.enabled ||
            (!continuation &&
              (settings.retryAt !== undefined
                ? now() < settings.retryAt
                : now() - settings.checkedAt <
                  (settings.intervalMinutes ?? DEFAULT_SYNC_MINUTES) * 60000))))
      )
        return;
      set({ busy: true, error: "", failureStage: undefined, draining: false });
      let stage = "generation";
      try {
        await checkGeneration();
        const previousError = await settleReceipt();
        if (previousError) throw new Error(previousError);
        if (!settings.serverGeneration && settings.baselineVersion) {
          stage = "baselineFetch";
          if (!deps.baseline) throw new Error("syncBaselineMissing");
          const baseline = await deps.baseline(settings.baselineVersion);
          current();
          if (
            !baseline ||
            typeof baseline.generation !== "string" ||
            !baseline.hashes ||
            typeof baseline.hashes !== "object" ||
            Array.isArray(baseline.hashes) ||
            Object.values(baseline.hashes).some(
              (value) =>
                typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value),
            )
          )
            throw new Error("invalidResponse");
          settings = {
            ...settings,
            base: baseline.hashes,
            serverGeneration: baseline.generation,
            cursor: 0,
            baselineVersion: undefined,
          };
          stage = "baselineSave";
          await save();
        }
        stage = "applyPending";
        await settle();
        stage = "capture";
        const local = await deps.capture(),
          hashes = await fingerprints(local.records, deps.hash),
          changes = changesSince(local.records, hashes, settings.base);
        stage = "exchange";
        const reply = await deps.exchange({
          generation: settings.serverGeneration,
          cursor: settings.cursor,
          changes,
          pull: manual || settings.autoRestore,
          base: settings.base,
          queueSequence: local.queueSequence,
          queueGeneration: local.queueGeneration,
        });
        current();
        if (
          !reply ||
          typeof reply.generation !== "string" ||
          !Number.isSafeInteger(reply.cursor) ||
          reply.cursor < settings.cursor ||
          !Array.isArray(reply.changes)
        )
          throw new Error("invalidResponse");
        if (
          settings.serverGeneration &&
          reply.generation !== settings.serverGeneration
        )
          throw new Error("syncReset");
        settings.serverGeneration = reply.generation;
        if (reply.ack && (reply.ack.rejected.length || reply.more)) {
          settings.receipt = reply.ack;
          await save();
          const error = await settleReceipt();
          if (error) throw new Error(error);
          if (!isolationEnabled()) {
            set({ pending: true, draining: true });
            return;
          }
        }
        const remote = applyChanges(local.records, reply.changes);
        settings.pending = {
          remote,
          incoming: isolationEnabled() ? reply.changes : undefined,
          sent: hashes,
          generation: reply.generation,
          cursor: reply.cursor,
          ack: reply.ack,
        };
        stage = "checkpoint";
        await save(); // Durable receipt before changing the phone. Retry never replays an unacknowledged sale.
        const remoteHashes = await fingerprints(remote, deps.hash);
        stage = "apply";
        await settle();
        set({
          uploaded: reply.uploaded,
          draining: reply.more ?? false,
          downloaded: reply.changes.filter(
            (c) => hashes[c.key] !== remoteHashes[c.key],
          ).length,
        });
      } catch (e) {
        await deps.release?.().catch(() => {});
        const code =
          e instanceof Error && /^[A-Za-z][A-Za-z0-9]{0,79}$/.test(e.message)
            ? e.message
            : "nativeOperationFailed";
        deps.diagnostic?.(stage, code, syncFailureDetail(e));
        set({
          error: e instanceof Error ? e.message : "backupFailed",
          failureStage: stage,
        });
        settings.retryAt = now() + 120000; // Automatic retries also respect the two-minute floor.
        await save().catch(() => {});
      } finally {
        set({ busy: false });
      }
    },
  };
  return api;
}
