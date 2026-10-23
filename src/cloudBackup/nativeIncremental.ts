import { isolateIncoming, latestChanges } from "./isolation";
import {
  conflictGroups,
  eligibleEntries,
  includeCloudPaymentKeys,
  entryKeys,
  resolutionRecords,
  resolutionWire,
  type ConflictReview,
  type ConflictChoice,
  type ReviewReply,
} from "./conflicts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { openDatabaseAsync } from "expo-sqlite";
import { Directory, File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import { fromByteArray, toByteArray } from "base64-js";
import type { AccountRequest } from "../account/controller";
import { mapBackupImages } from "../store/backupFormat";
import { parseBusiness, type BusinessData } from "../store/business";
import { createIncrementalSync, type IncrementalSettings } from "./incremental";
import {
  canonical,
  changesSince,
  fingerprints,
  joinRecords,
  splitRecords,
  type Records,
} from "./records";
import type {
  SyncOutbox,
  ConflictResolution,
  QueueCounts,
  OutboxAck,
  WireOperation,
} from "./outboxTypes";
import type { CloudVersion } from "./controller";
const hash = (s: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s);
let opened: ReturnType<typeof openDatabaseAsync> | undefined;
const database = () =>
  (opened ??= openDatabaseAsync("dokanx-sync.db").then(async (db) => {
    await db.execAsync(
      "CREATE TABLE IF NOT EXISTS incremental_state (scope TEXT PRIMARY KEY,payload TEXT NOT NULL)",
    );
    return db;
  }));
export function createNativeIncremental(deps: {
  outbox?: () => SyncOutbox | undefined;
  storageKey: string;
  generation: () => Promise<string>;
  current: () => boolean;
  capture: () => BusinessData;
  resolve?: (input: ConflictResolution) => Promise<void>;
  apply: (data: BusinessData, expected: string) => Promise<void>;
  request: (path: string, options?: AccountRequest) => Promise<unknown>;
}) {
  const cache = new Map<string, string>(),
    sources = new Map<string, string>();
  const scope = deps.storageKey + "/incremental-v1";
  const folder = () => {
    const dir = new Directory(Paths.document, "sync-assets");
    dir.create({ idempotent: true, intermediates: true });
    return dir;
  };
  const current = () => {
    if (!deps.current()) throw new Error("backupContextChanged");
  };
  async function portable(data: BusinessData) {
    current();
    const uriHashes = new Map<string, string>();
    const shared = joinRecords(splitRecords(data)) as BusinessData;
    mapBackupImages(shared, (uri) => {
      uriHashes.set(uri, "");
      return uri;
    });
    for (const uri of uriHashes.keys()) {
      let id = cache.get(uri);
      if (!id) {
        let encoded: string;
        if (/^data:image\/(png|jpeg);base64,/.test(uri))
          encoded = uri.split(",")[1];
        else {
          if (!uri.startsWith("file://")) throw new Error("missingAsset");
          const file = new File(uri);
          if (!file.exists || file.size > 3000000)
            throw new Error("missingAsset");
          encoded = await file.base64();
        }
        const bytes = toByteArray(encoded);
        if (!bytes.length || bytes.length > 3000000)
          throw new Error("invalidBackup");
        id = await hash(fromByteArray(bytes));
        cache.set(uri, id);
      }
      uriHashes.set(uri, id);
      sources.set(id, uri);
    }
    current();
    return {
      records: splitRecords(
        mapBackupImages(
          shared,
          (uri) => `asset://assets/${uriHashes.get(uri)}`,
        ),
      ),
    };
  }
  let queueCounts: QueueCounts = { pending: 0, processing: 0, conflict: 0 };
  let recovered: string | undefined;
  let active: { shop: string; generation: string; batchId: string } | undefined;
  const refreshCounts = async (shop: string, generation: string) => {
    const queue = deps.outbox?.();
    if (queue) {
      queueCounts = await queue.counts(shop, generation);
      notify();
    }
  };
  async function capture() {
    current();
    const queue = deps.outbox?.(),
      shop = deps.capture().shopId;
    const snapshot = queue && shop ? await queue.snapshot(shop) : undefined;
    if (snapshot && recovered !== snapshot.generation) {
      await queue!.recover(shop!, snapshot.generation);
      recovered = snapshot.generation;
    }
    const data = snapshot?.data ?? deps.capture();
    if (snapshot) await refreshCounts(shop!, snapshot.generation);
    return {
      ...(await portable(data)),
      expected: JSON.stringify(data),
      queueSequence: snapshot?.sequence,
      queueGeneration: snapshot?.generation,
    };
  }
  async function localizeImages(records: Records) {
    current();
    const data = joinRecords(records) as BusinessData,
      uris = new Map<string, string>();
    mapBackupImages(data, (uri) => {
      if (!/^asset:\/\/assets\/[a-f0-9]{64}$/.test(uri))
        throw new Error("invalidBackup");
      uris.set(uri, "");
      return uri;
    });
    for (const uri of uris.keys()) {
      const id = uri.slice(15),
        source = sources.get(id);
      if (source && !source.startsWith("data:") && new File(source).exists) {
        uris.set(uri, source);
        continue;
      }
      const file = new File(folder(), `${id}.image`);
      if (file.exists && (await hash(await file.base64())) !== id)
        file.delete();
      if (!file.exists) {
        const temp = new File(
          Paths.cache,
          `sync-download-${Crypto.randomUUID()}.image`,
        );
        try {
          current();
          await deps.request(`/changes/assets/${id}`, { saveTo: temp.uri });
          current();
          if (
            !temp.exists ||
            temp.size > 3000000 ||
            (await hash(await temp.base64())) !== id
          )
            throw new Error("invalidBackup");
          await temp.copy(file);
        } finally {
          if (temp.exists) temp.delete();
        }
      }
      uris.set(uri, file.uri);
      sources.set(id, file.uri);
      cache.set(file.uri, id);
    }
    current();
    return mapBackupImages(data, (uri) => uris.get(uri) ?? "");
  }
  async function localize(records: Records) {
    return parseBusiness(JSON.stringify(await localizeImages(records)));
  }
  let reviewBusy = false;
  const engine = createIncrementalSync({
    isolateConflicts: () => !!deps.outbox?.()?.reviewEntries,
    reconcile: async (local, changes) => {
      current();
      const queue = deps.outbox?.(),
        shop = deps.capture().shopId;
      if (!queue?.reviewEntries || !shop) throw new Error("queueUnavailable");
      const snapshot = await queue.snapshot(shop);
      const entries = await queue.reviewEntries(shop, snapshot.generation);
      current();
      return isolateIncoming(local, changes, entries);
    },
    acknowledge: async (ack) => {
      current();
      const queue = deps.outbox?.();
      if (!queue) throw new Error("queueUnavailable");
      const shop = deps.capture().shopId;
      if (!shop) throw new Error("backupContextChanged");
      await queue.acknowledge(shop, ack);
      if (active?.batchId === ack.batchId) active = undefined;
      await refreshCounts(shop, ack.generation);
    },
    release: async () => {
      if (active) {
        const batch = active;
        active = undefined;
        await deps
          .outbox?.()
          ?.retry(batch.shop, batch.generation, batch.batchId);
        await refreshCounts(batch.shop, batch.generation);
      }
    },
    baseline: async (id) =>
      (await deps.request(`/changes/baseline/${encodeURIComponent(id)}`)) as {
        generation: string;
        hashes: Record<string, string>;
      },
    diagnostic: (stage, code, message) => {
      if (typeof __DEV__ !== "undefined" && __DEV__)
        console.info("[cloud-sync] stopped", {
          stage,
          code,
          ...(message ? { message } : {}),
        });
    },
    current: deps.current,
    generation: deps.generation,
    hash,
    capture,
    read: async () => {
      const db = await database(),
        row = await db.getFirstAsync<{ payload: string }>(
          "SELECT payload FROM incremental_state WHERE scope=?",
          scope,
        );
      const old = await AsyncStorage.getItem(deps.storageKey);
      if (!old) return row?.payload ?? null;
      const legacy = JSON.parse(old) as {
        generation: string;
        enabled: boolean;
        checkpoint?: { id: string; at: string };
      };
      const fresh: IncrementalSettings = {
        generation: legacy.generation,
        enabled: legacy.enabled,
        autoRestore: false,
        cursor: 0,
        base: {},
        checkedAt: 0,
      };
      let selected = fresh;
      if (row) {
        const saved = JSON.parse(row.payload) as IncrementalSettings;
        // The scope already identifies this account/shop; adoption resets data
        // checkpoints, not the owner's selected schedule for this phone.
        fresh.intervalMinutes = saved.intervalMinutes;
        if (
          saved.generation === legacy.generation ||
          legacy.generation !== (await deps.generation())
        )
          selected = saved;
      }
      const checkpoint = legacy.checkpoint;
      if (
        checkpoint?.id &&
        selected.generation === legacy.generation &&
        legacy.generation === (await deps.generation())
      ) {
        const newerPublication =
          checkpoint.id !== selected.legacyCheckpointId &&
          Date.parse(checkpoint.at) >
            Date.parse(selected.lastSuccess ?? "1970-01-01");
        if (newerPublication)
          selected = {
            ...fresh,
            autoRestore: selected.autoRestore,
            intervalMinutes: selected.intervalMinutes,
          };
        if (!selected.serverGeneration && !selected.pending)
          selected = { ...selected, baselineVersion: checkpoint.id };
        selected.legacyCheckpointId = checkpoint.id;
      }
      return JSON.stringify(selected);
    },
    write: async (payload) => {
      current();
      await (
        await database()
      ).runAsync(
        "INSERT INTO incremental_state(scope,payload) VALUES(?,?) ON CONFLICT(scope) DO UPDATE SET payload=excluded.payload",
        scope,
        payload,
      );
    },
    exchange: async (input) => {
      current();
      const queue = deps.outbox?.(),
        shop = deps.capture().shopId;
      let operations: WireOperation[] | undefined,
        batchId: string | undefined,
        more = false;
      if (queue) {
        if (!shop) throw new Error("backupContextChanged");
        if (!input.queueGeneration || input.queueSequence === undefined)
          throw new Error("queueUnavailable");
        let entries;
        if (queue.reviewEntries) {
          entries = eligibleEntries(
            await queue.reviewEntries(shop, input.queueGeneration),
            input.queueSequence,
          );
        } else {
          if ((await queue.counts(shop, input.queueGeneration)).conflict)
            throw new Error("syncConflict");
          entries = await queue.entries(
            shop,
            input.queueGeneration,
            input.queueSequence,
          );
        }
        more = entries.length > 20;
        operations = [];
        let base = { ...input.base };
        for (const entry of entries.slice(0, 20)) {
          let operation = entry.wire;
          if (!operation) {
            const raw = entry.seed
              ? entry.changes
              : Object.fromEntries(
                  entry.changes
                    .filter((c) => c.value !== null)
                    .map((c) => [c.key, c.value]),
                );
            const values = (await portable(joinRecords(raw) as BusinessData))
              .records;
            operation = {
              changeId: entry.changeId,
              changes: entry.seed
                ? changesSince(values, await fingerprints(values, hash), base)
                : entry.changes.map((c) => ({
                    key: c.key,
                    before: base[c.key] ?? null,
                    value: c.value === null ? null : values[c.key],
                  })),
            };
          } else {
            // Register immutable queued image sources again after a process restart.
            const raw = entry.seed
              ? entry.changes
              : Object.fromEntries(
                  entry.changes
                    .filter((c) => c.value !== null)
                    .map((c) => [c.key, c.value]),
                );
            await portable(joinRecords(raw) as BusinessData);
          }
          for (const c of operation.changes) {
            if (c.value === null) delete base[c.key];
            else base[c.key] = await hash(canonical(c.value));
          }
          operations.push(operation);
        }
        batchId = Crypto.randomUUID();
        await queue.claim(shop, input.queueGeneration, batchId, operations);
        active = { shop, generation: input.queueGeneration, batchId };
        await refreshCounts(shop, input.queueGeneration);
      }
      const ids = new Set<string>();
      // Earlier operations can reference an older photo of the same product.
      // Keep every group's assets, not only the last value for each record key.
      for (const outgoing of operations
        ? operations.map((o) => o.changes)
        : [input.changes])
        mapBackupImages(
          joinRecords(
            Object.fromEntries(
              outgoing
                .filter((c) => c.value !== null)
                .map((c) => [c.key, c.value]),
            ),
          ) as BusinessData,
          (uri) => {
            if (!/^asset:\/\/assets\/[a-f0-9]{64}$/.test(uri))
              throw new Error("invalidBackup");
            ids.add(uri.slice(15));
            return uri;
          },
        );
      const missing = (await deps.request("/changes/missing", {
        body: { hashes: [...ids] },
      })) as { missing: string[] };
      current();
      if (
        !missing ||
        !Array.isArray(missing.missing) ||
        missing.missing.some((id) => !ids.has(id))
      )
        throw new Error("invalidResponse");
      for (const id of missing.missing) {
        const uri = sources.get(id);
        if (!uri) throw new Error("missingAsset");
        let temporary: File | undefined;
        try {
          let fileUri = uri;
          if (uri.startsWith("data:")) {
            temporary = new File(
              Paths.cache,
              `sync-${Crypto.randomUUID()}.bin`,
            );
            temporary.write(toByteArray(uri.split(",")[1]));
            fileUri = temporary.uri;
          }
          current();
          await deps.request(`/changes/assets/${id}`, { fileUri });
          current();
        } finally {
          if (temporary?.exists) temporary.delete();
        }
      }
      const file = new File(Paths.cache, `sync-${Crypto.randomUUID()}.json`);
      try {
        file.write(
          JSON.stringify(
            operations
              ? {
                  batchId,
                  generation: input.generation,
                  cursor: input.cursor,
                  pull: input.pull,
                  operations,
                }
              : input,
          ),
        );
        current();
        const reply = (await deps.request(
          operations ? "/changes/operations" : "/changes/exchange",
          { fileUri: file.uri },
        )) as Awaited<
          ReturnType<Parameters<typeof createIncrementalSync>[0]["exchange"]>
        > & {
          batchId: string;
          acceptedChangeIds: string[];
          rejected: OutboxAck["rejected"];
        };
        if (operations) {
          const ids = new Set(operations.map((o) => o.changeId));
          if (
            reply?.batchId !== batchId ||
            !Array.isArray(reply.acceptedChangeIds) ||
            !Array.isArray(reply.rejected)
          )
            throw new Error("invalidResponse");
          const received = [
            ...reply.acceptedChangeIds,
            ...reply.rejected.map((r) => r?.changeId),
          ];
          if (
            received.length !== ids.size ||
            new Set(received).size !== ids.size ||
            received.some((id) => !ids.has(id)) ||
            reply.rejected.some(
              (r) =>
                !["pending", "conflict"].includes(r.status) ||
                !/^\w{1,80}$/.test(r.code),
            )
          )
            throw new Error("invalidResponse");
          const accepted = new Set(reply.acceptedChangeIds),
            values = new Map<string, unknown>();
          for (const op of operations)
            if (accepted.has(op.changeId))
              for (const c of op.changes) values.set(c.key, c.value);
          reply.ack = {
            batchId: batchId!,
            generation: input.queueGeneration!,
            acceptedChangeIds: reply.acceptedChangeIds,
            rejected: reply.rejected,
            acceptedChanges: [...values].map(([key, value]) => ({
              key,
              value,
            })),
          };
          reply.more = more;
        }
        return reply;
      } finally {
        if (file.exists) file.delete();
      }
    },
    apply: async (records: Records, expected: string) => {
      await deps.apply(await localize(records), expected);
    },
  });
  let versions: CloudVersion[] = [],
    snapshot = {
      ...engine.snapshot(),
      busy: reviewBusy || engine.snapshot().busy,
      versions,
      canUpload: true,
      queueCounts,
    };
  const listeners = new Set<() => void>();
  const notify = () => {
    snapshot = {
      ...engine.snapshot(),
      busy: reviewBusy || engine.snapshot().busy,
      versions,
      canUpload: true,
      queueCounts,
    };
    listeners.forEach((l) => l());
  };
  engine.subscribe(notify);
  async function fetchReview(
    generation: string,
    cursor: number,
    keys: string[],
    baseHashes: Record<string, string | null>,
  ) {
    const reply = (await deps.request("/changes/review", {
      body: { generation, cursor, keys, baseHashes },
    })) as ReviewReply;
    current();
    if (
      !reply ||
      reply.generation !== generation ||
      !Number.isSafeInteger(reply.cursor) ||
      reply.cursor < cursor ||
      typeof reply.viewerDeviceId !== "string" ||
      !reply.records ||
      !reply.hashes ||
      !reply.baseline ||
      !reply.editors ||
      !Array.isArray(reply.changes) ||
      keys.some(
        (k) =>
          !Object.hasOwn(reply.records, k) || !Object.hasOwn(reply.hashes, k),
      )
    )
      throw new Error("invalidResponse");
    for (const key of keys) {
      const value = reply.records[key],
        expected = value === null ? null : await hash(canonical(value));
      if (expected !== reply.hashes[key]) throw new Error("invalidResponse");
    }
    return reply;
  }
  const baseFor = (
    entries: ConflictReview["entries"],
    base: Record<string, string>,
  ) => {
    const values: Record<string, string | null> = Object.create(null);
    for (const entry of entries)
      for (const key of entryKeys(entry))
        if (!Object.hasOwn(values, key))
          values[key] = entry.wire
            ? entry.wire.changes.find((c) => c.key === key)!.before
            : (base[key] ?? null);
    return values;
  };
  return {
    ...engine,
    async reviewConflicts(): Promise<ConflictReview> {
      if (reviewBusy || engine.snapshot().busy) throw new Error("backupBusy");
      reviewBusy = true;
      notify();
      try {
        const checkpoint = await engine.prepareReview();
        const queue = deps.outbox?.(),
          shop = deps.capture().shopId;
        if (!queue?.reviewEntries || !shop) throw new Error("queueUnavailable");
        const snapshot = await queue.snapshot(shop);
        await queue.recover(shop, snapshot.generation);
        const entries = await queue.reviewEntries(shop, snapshot.generation);
        if (entries.some((entry) => entry.sequence > snapshot.sequence))
          throw new Error("conflictReviewStale");
        const deferredKeys = checkpoint.deferred.map((c) => c.key);
        let groups = conflictGroups(entries),
          keys = [
            ...new Set([...groups.flatMap((g) => g.keys), ...deferredKeys]),
          ];
        const bases = baseFor(entries, checkpoint.base);
        const local = (await portable(snapshot.data)).records;
        let server: ReviewReply | undefined;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (keys.length > 5000) throw new Error("conflictTooLarge");
          server = await fetchReview(
            checkpoint.generation,
            checkpoint.cursor,
            keys,
            Object.fromEntries(keys.map((k) => [k, bases[k] ?? null])),
          );
          server.changes = latestChanges([
            ...deferredKeys.map((key) => ({
              key,
              value: server!.records[key] ?? null,
            })),
            ...server.changes,
          ]);
          const expanded = includeCloudPaymentKeys(
              local,
              groups,
              server.changes,
            ),
            nextKeys = [
              ...new Set([...expanded.flatMap((g) => g.keys), ...deferredKeys]),
            ];
          groups = expanded;
          if (nextKeys.length === keys.length) break;
          if (attempt === 2) throw new Error("conflictReviewStale");
          keys = nextKeys;
        }
        if (!server) throw new Error("invalidResponse");
        for (const key of keys)
          if (!Object.hasOwn(server.baseline, key)) {
            const first = entries.find((e) => entryKeys(e).includes(key));
            if (!first?.beforeValues || !Object.hasOwn(first.beforeValues, key))
              continue;
            const value = first.beforeValues[key];
            if (value === null && bases[key] === null)
              server.baseline[key] = null;
            else if (value !== null) {
              try {
                const normalized = (
                  await portable(joinRecords({ [key]: value }) as BusinessData)
                ).records[key];
                if ((await hash(canonical(normalized))) === bases[key])
                  server.baseline[key] = normalized;
              } catch {
                current(); /* An unavailable old photo must not prevent reviewing current values. */
              }
            }
          }
        // Image comparison is best effort; a missing historical asset does not hide text differences.
        for (const values of [server.records, server.baseline]) {
          try {
            await localizeImages(
              Object.fromEntries(
                Object.entries(values).filter(([, value]) => value !== null),
              ),
            );
          } catch {
            current();
          }
        }
        const images = Object.fromEntries(
          [...sources].map(([id, uri]) => [`asset://assets/${id}`, uri]),
        );
        return {
          shop,
          generation: snapshot.generation,
          sequence: snapshot.sequence,
          expected: JSON.stringify(snapshot.data),
          local,
          images,
          entries,
          groups,
          server,
        };
      } finally {
        reviewBusy = false;
        notify();
      }
    },
    async resolveConflict(
      review: ConflictReview,
      groupId: string,
      choice: ConflictChoice,
      safety: (data: BusinessData) => Promise<unknown>,
    ) {
      if (reviewBusy || engine.snapshot().busy) throw new Error("backupBusy");
      reviewBusy = true;
      notify();
      try {
        current();
        if (!deps.resolve || !deps.outbox?.()?.resolve)
          throw new Error("queueUnavailable");
        const group = review.groups.find((g) => g.id === groupId);
        if (!group || !["local", "cloud", "merge"].includes(choice))
          throw new Error("invalidData");
        const fresh = await fetchReview(
          review.server.generation,
          review.server.cursor,
          group.keys,
          {},
        );
        // Any intervening cloud commit requires a fresh review, including linked records.
        if (
          fresh.cursor !== review.server.cursor ||
          canonical(fresh.hashes) !==
            canonical(
              Object.fromEntries(
                group.keys.map((k) => [k, review.server.hashes[k]]),
              ),
            )
        )
          throw new Error("conflictReviewStale");
        const data = await localize(resolutionRecords(review, group, choice));
        const original = parseBusiness(review.expected);
        for (const key of [
          "heldSales",
          "saleDraft",
          "purchaseDraft",
          "notificationReadSignature",
        ] as const) {
          if (original[key] !== undefined)
            Object.assign(data, { [key]: original[key] });
        }
        const wire = await resolutionWire(
          review,
          group,
          choice,
          Crypto.randomUUID(),
          hash,
        );
        await safety(original);
        current();
        await deps.resolve({
          shop: review.shop,
          generation: review.generation,
          sequence: review.sequence,
          expected: review.expected,
          changeIds: group.changeIds,
          choice,
          data,
          wire,
          localChanges: wire.changes.map((c) => ({
            key: c.key,
            value: splitRecords(data)[c.key] ?? null,
          })),
          details: {
            keys: group.keys,
            serverCursor: review.server.cursor,
            serverGeneration: review.server.generation,
            editors: review.server.editors,
          },
        });
        await refreshCounts(review.shop, review.generation);
      } finally {
        reviewBusy = false;
        notify();
      }
      await this.check(true);
    },
    async check(manual = false) {
      if (reviewBusy) return;
      await engine.check(manual);
      for (
        let batch = 0;
        batch < 49 &&
        deps.current() &&
        engine.snapshot().draining &&
        !engine.snapshot().busy &&
        !engine.snapshot().error;
        batch++
      )
        await engine.check(manual, true);
    },
    snapshot: () => snapshot,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    async refreshQueue() {
      current();
      const queue = deps.outbox?.(),
        shop = deps.capture().shopId;
      if (!queue || !shop) return;
      const local = await queue.snapshot(shop);
      current();
      await refreshCounts(shop, local.generation);
    },
    async refresh() {
      try {
        const queue = deps.outbox?.(),
          shop = deps.capture().shopId;
        if (queue && shop) {
          const snapshot = await queue.snapshot(shop);
          await refreshCounts(shop, snapshot.generation);
        }
        const response = (await deps.request("")) as {
          versions: CloudVersion[];
        };
        current();
        if (Array.isArray(response?.versions)) {
          versions = response.versions;
          notify();
        }
      } catch {
        /* Main sync reports actionable connection errors. */
      }
    },
  };
}
