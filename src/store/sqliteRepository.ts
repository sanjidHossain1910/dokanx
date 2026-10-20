import { parseBusiness, type BusinessData } from "./business.ts";

interface Database {
  execAsync(sql: string): Promise<unknown>;
  runAsync(sql: string, ...params: string[]): Promise<unknown>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
}
export function createSQLiteRepository(open: () => Promise<Database>, readLegacy: () => Promise<string | null>) {
  let connection: Promise<Database> | undefined;
  function database() {
    if (!connection) connection = (async () => {
      const db = await open();
      await db.execAsync("PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS business_state (id INTEGER PRIMARY KEY CHECK(id = 1), payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);");
      return db;
    })().catch((error) => { connection = undefined; throw error; });
    return connection;
  }
  return {
    async read(): Promise<BusinessData> {
      const db = await database();
      const row = await db.getFirstAsync<{ payload: string }>("SELECT payload FROM business_state WHERE id = 1");
      if (row) return parseBusiness(row.payload);
      const data = parseBusiness(await readLegacy());
      // Migrate once; retain the source as a recovery backup.
      await db.runAsync("INSERT OR IGNORE INTO business_state (id, payload, updated_at) VALUES (1, ?, ?)", JSON.stringify(data), new Date().toISOString());
      return data;
    },
    async write(data: BusinessData) {
      const db = await database();
      // One atomic commit keeps product state and stock history together.
      await db.runAsync("INSERT INTO business_state (id, payload, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, revision = revision + 1, updated_at = excluded.updated_at", JSON.stringify(data), new Date().toISOString());
    },
  };
}
