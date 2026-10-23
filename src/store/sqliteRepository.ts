import { parseBusiness, type BusinessData } from "./business.ts";
import { canonical, splitRecords } from "../cloudBackup/records.ts";
import type {
  SyncOutbox,
  OutboxEntry,
  QueueCounts,
  OutboxAck,
  ConflictResolution,
} from "../cloudBackup/outboxTypes.ts";
interface Database {
  execAsync(sql: string): Promise<unknown>;
  runAsync(
    sql: string,
    ...params: (string | number | null)[]
  ): Promise<unknown>;
  getFirstAsync<T>(
    sql: string,
    ...params: (string | number | null)[]
  ): Promise<T | null>;
}
export type WriteOptions = { origin?: "local" | "remote" | "restore" };
export function createSQLiteRepository(
  open: () => Promise<Database>,
  readLegacy: () => Promise<string | null>,
  options: { id?: () => string } = {},
) {
  let connection: Promise<Database> | undefined,
    tail: Promise<unknown> = Promise.resolve();
  const id = options.id ?? (() => globalThis.crypto.randomUUID());
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const next = tail.then(work);
    tail = next.catch(() => {});
    return next;
  };
  async function database() {
    connection ??= (async () => {
      const db = await open();
      await db.execAsync(`PRAGMA journal_mode=WAL;
   CREATE TABLE IF NOT EXISTS business_state(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS sync_tracking(shop_id TEXT PRIMARY KEY,generation TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS sync_outbox(sequence INTEGER PRIMARY KEY AUTOINCREMENT,change_id TEXT NOT NULL UNIQUE,shop_id TEXT NOT NULL,generation TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','processing','conflict')),payload TEXT NOT NULL,seed INTEGER NOT NULL DEFAULT 0,before_values TEXT,wire TEXT,batch_id TEXT,attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS sync_conflict_decisions(id TEXT PRIMARY KEY,shop_id TEXT NOT NULL,generation TEXT NOT NULL,created_at TEXT NOT NULL,choice TEXT NOT NULL,details TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS sync_outbox_pending ON sync_outbox(shop_id,generation,status,sequence);`);
      if (
        !(await db.getFirstAsync(
          "SELECT name FROM pragma_table_info('sync_outbox') WHERE name='before_values'",
        ))
      )
        await db.execAsync(
          "ALTER TABLE sync_outbox ADD COLUMN before_values TEXT",
        );
      return db;
    })().catch((error) => {
      connection = undefined;
      throw error;
    });
    return connection;
  }
  async function transaction<T>(work: (db: Database) => Promise<T>) {
    const db = await database();
    await db.execAsync("BEGIN IMMEDIATE");
    try {
      const result = await work(db);
      await db.execAsync("COMMIT");
      return result;
    } catch (error) {
      await db.execAsync("ROLLBACK").catch(() => {});
      throw error;
    }
  }
  async function readData(db: Database) {
    const row = await db.getFirstAsync<{ payload: string }>(
      "SELECT payload FROM business_state WHERE id=1",
    );
    if (row) return parseBusiness(row.payload);
    const data = parseBusiness(await readLegacy());
    await db.runAsync(
      "INSERT OR IGNORE INTO business_state(id,payload,updated_at) VALUES(1,?,?)",
      JSON.stringify(data),
      new Date().toISOString(),
    );
    return data;
  }
  async function enqueue(
    db: Database,
    shop: string,
    generation: string,
    changes: unknown,
    seed = false,
    beforeValues?: Record<string, unknown | null>,
  ) {
    await db.runAsync(
      "INSERT INTO sync_outbox(change_id,shop_id,generation,status,payload,seed,created_at,before_values) VALUES(?,?,?,'pending',?,?,?,?)",
      id(),
      shop,
      generation,
      JSON.stringify(changes),
      seed ? 1 : 0,
      new Date().toISOString(),
      beforeValues ? JSON.stringify(beforeValues) : null,
    );
  }
  async function counts(
    db: Database,
    shop: string,
    generation: string,
  ): Promise<QueueCounts> {
    const result = await db.getFirstAsync<{
      pending: number;
      processing: number;
      conflict: number;
    }>(
      "SELECT coalesce(sum(status='pending'),0) pending,coalesce(sum(status='processing'),0) processing,coalesce(sum(status='conflict'),0) conflict FROM sync_outbox WHERE shop_id=? AND generation=?",
      shop,
      generation,
    );
    return result ? { ...result } : { pending: 0, processing: 0, conflict: 0 };
  }
  const outbox: SyncOutbox = {
    snapshot: (shop) =>
      serial(() =>
        transaction(async (db) => {
          const data = await readData(db);
          if (data.shopId !== shop) throw new Error("backupContextChanged");
          let tracking = await db.getFirstAsync<{ generation: string }>(
            "SELECT generation FROM sync_tracking WHERE shop_id=?",
            shop,
          );
          if (!tracking) {
            tracking = { generation: id() };
            await db.runAsync(
              "INSERT INTO sync_tracking(shop_id,generation) VALUES(?,?)",
              shop,
              tracking.generation,
            );
            await enqueue(
              db,
              shop,
              tracking.generation,
              splitRecords(data),
              true,
            );
          }
          const top = await db.getFirstAsync<{ sequence: number }>(
            "SELECT coalesce(max(sequence),0) sequence FROM sync_outbox WHERE shop_id=? AND generation=?",
            shop,
            tracking.generation,
          );
          return {
            data,
            sequence: top?.sequence ?? 0,
            generation: tracking.generation,
            counts: await counts(db, shop, tracking.generation),
          };
        }),
      ),
    recover: (shop, generation) =>
      serial(async () => {
        await (
          await database()
        ).runAsync(
          "UPDATE sync_outbox SET status='pending' WHERE shop_id=? AND generation=? AND status='processing'",
          shop,
          generation,
        );
      }),
    entries: (shop, generation, sequence) =>
      serial(async () => {
        const result = await (
          await database()
        ).getFirstAsync<{ payload: string }>(
          `SELECT coalesce(json_group_array(json_object('changeId',change_id,'sequence',sequence,'seed',seed,'changes',json(payload),'wire',CASE WHEN wire IS NULL THEN NULL ELSE json(wire) END)),'[]') payload FROM (SELECT * FROM sync_outbox WHERE shop_id=? AND generation=? AND status='pending' AND sequence<=? ORDER BY sequence)`,
          shop,
          generation,
          sequence,
        );
        return JSON.parse(result?.payload ?? "[]") as OutboxEntry[];
      }),
    claim: (shop, generation, batch, operations) =>
      serial(() =>
        transaction(async (db) => {
          for (const operation of operations) {
            const row = await db.getFirstAsync<{
              status: string;
              wire: string | null;
            }>(
              "SELECT status,wire FROM sync_outbox WHERE shop_id=? AND generation=? AND change_id=?",
              shop,
              generation,
              operation.changeId,
            );
            if (
              !row ||
              row.status !== "pending" ||
              (row.wire && row.wire !== JSON.stringify(operation))
            )
              throw new Error("queueChanged");
            await db.runAsync(
              "UPDATE sync_outbox SET status='processing',wire=?,batch_id=?,attempts=attempts+1,last_error=NULL WHERE change_id=? AND shop_id=? AND generation=?",
              JSON.stringify(operation),
              batch,
              operation.changeId,
              shop,
              generation,
            );
          }
        }),
      ),
    acknowledge: (shop, result: OutboxAck) =>
      serial(() =>
        transaction(async (db) => {
          for (const changeId of result.acceptedChangeIds)
            await db.runAsync(
              "DELETE FROM sync_outbox WHERE change_id=? AND shop_id=? AND generation=?",
              changeId,
              shop,
              result.generation,
            );
          for (const rejected of result.rejected)
            await db.runAsync(
              "UPDATE sync_outbox SET status=?,last_error=? WHERE change_id=? AND shop_id=? AND generation=?",
              rejected.status,
              rejected.code,
              rejected.changeId,
              shop,
              result.generation,
            );
        }),
      ),
    retry: (shop, generation, batch) =>
      serial(async () => {
        await (
          await database()
        ).runAsync(
          "UPDATE sync_outbox SET status='pending' WHERE shop_id=? AND generation=? AND batch_id=? AND status='processing'",
          shop,
          generation,
          batch,
        );
      }),
    reviewEntries: (shop, generation) =>
      serial(async () => {
        const row = await (
          await database()
        ).getFirstAsync<{ payload: string }>(
          `SELECT coalesce(json_group_array(json_object('changeId',change_id,'sequence',sequence,'seed',seed,'changes',json(payload),'wire',CASE WHEN wire IS NULL THEN NULL ELSE json(wire) END,'beforeValues',CASE WHEN before_values IS NULL THEN NULL ELSE json(before_values) END,'createdAt',created_at,'status',status,'error',last_error)),'[]') payload FROM (SELECT * FROM sync_outbox WHERE shop_id=? AND generation=? ORDER BY sequence)`,
          shop,
          generation,
        );
        return JSON.parse(row?.payload ?? "[]") as OutboxEntry[];
      }),
    resolve: (input: ConflictResolution) =>
      serial(() =>
        transaction(async (db) => {
          const current = await readData(db);
          const tracking = await db.getFirstAsync<{ generation: string }>(
            "SELECT generation FROM sync_tracking WHERE shop_id=?",
            input.shop,
          );
          const top = await db.getFirstAsync<{ sequence: number }>(
            "SELECT coalesce(max(sequence),0) sequence FROM sync_outbox WHERE shop_id=? AND generation=?",
            input.shop,
            input.generation,
          );
          if (
            current.shopId !== input.shop ||
            tracking?.generation !== input.generation ||
            top?.sequence !== input.sequence ||
            JSON.stringify(current) !== input.expected ||
            !input.changeIds.length ||
            new Set(input.changeIds).size !== input.changeIds.length
          )
            throw new Error("conflictReviewStale");
          const old: unknown[] = [];
          for (const changeId of input.changeIds) {
            const row = await db.getFirstAsync<{
              status: string;
              payload: string;
              wire: string | null;
              before_values: string | null;
            }>(
              "SELECT status,payload,wire,before_values FROM sync_outbox WHERE shop_id=? AND generation=? AND change_id=?",
              input.shop,
              input.generation,
              changeId,
            );
            if (!row || row.status === "processing")
              throw new Error("conflictReviewStale");
            old.push({ changeId, ...row });
          }
          const next = parseBusiness(JSON.stringify(input.data));
          if (
            next.shopId !== current.shopId ||
            typeof input.wire.changeId !== "string" ||
            !input.wire.changeId ||
            !["local", "cloud", "merge"].includes(input.choice) ||
            input.changeIds.includes(input.wire.changeId)
          )
            throw new Error("invalidData");
          await db.runAsync(
            "INSERT INTO sync_conflict_decisions(id,shop_id,generation,created_at,choice,details) VALUES(?,?,?,?,?,?)",
            id(),
            input.shop,
            input.generation,
            new Date().toISOString(),
            input.choice,
            JSON.stringify({ operations: old, review: input.details }),
          );
          for (const changeId of input.changeIds)
            await db.runAsync(
              "DELETE FROM sync_outbox WHERE shop_id=? AND generation=? AND change_id=?",
              input.shop,
              input.generation,
              changeId,
            );
          await db.runAsync(
            "INSERT INTO sync_outbox(change_id,shop_id,generation,status,payload,seed,wire,created_at) VALUES(?,?,?,'pending',?,0,?,?)",
            input.wire.changeId,
            input.shop,
            input.generation,
            JSON.stringify(input.localChanges),
            JSON.stringify(input.wire),
            new Date().toISOString(),
          );
          await db.runAsync(
            "UPDATE business_state SET payload=?,revision=revision+1,updated_at=? WHERE id=1",
            JSON.stringify(next),
            new Date().toISOString(),
          );
        }),
      ),
    counts: (shop, generation) =>
      serial(async () => counts(await database(), shop, generation)),
  };
  return {
    outbox,
    read: () => serial(async () => readData(await database())),
    write: (data: BusinessData, writeOptions: WriteOptions = {}) =>
      serial(() =>
        transaction(async (db) => {
          const previous = await readData(db);
          if (writeOptions.origin === "restore") {
            await db.runAsync(
              "UPDATE sync_outbox SET status='conflict',last_error='localRestore' WHERE status IN ('pending','processing')",
            );
            await db.runAsync("DELETE FROM sync_tracking");
          } else if (writeOptions.origin !== "remote" && data.shopId) {
            const tracking = await db.getFirstAsync<{ payload: string }>(
              "SELECT coalesce(json_group_array(json_object('shop',shop_id,'generation',generation)),'[]') payload FROM sync_tracking",
            );
            const active = (
              JSON.parse(tracking?.payload ?? "[]") as {
                shop: string;
                generation: string;
              }[]
            ).find((t) => t.shop === data.shopId);
            if (active) {
              const before = splitRecords(previous),
                after = splitRecords(data);
              const changes = [
                ...new Set([...Object.keys(before), ...Object.keys(after)]),
              ]
                .filter(
                  (key) => canonical(before[key]) !== canonical(after[key]),
                )
                .map((key) => ({ key, value: after[key] ?? null }));
              if (changes.length)
                await enqueue(
                  db,
                  data.shopId,
                  active.generation,
                  changes,
                  false,
                  Object.fromEntries(
                    changes.map((c) => [c.key, before[c.key] ?? null]),
                  ),
                );
            }
          }
          await db.runAsync(
            "INSERT INTO business_state(id,payload,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,revision=revision+1,updated_at=excluded.updated_at",
            JSON.stringify(data),
            new Date().toISOString(),
          );
        }),
      ),
  };
}
