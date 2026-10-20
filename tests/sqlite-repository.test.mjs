import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createSQLiteRepository } from "../src/store/sqliteRepository.ts";
import { addProduct, emptyBusiness } from "../src/store/business.ts";
import { adjustStock } from "../src/store/inventory.ts";
const product = { id: "p", name: "Rice", barcode: "", category: "Food", price: 9000, cost: 7000, stock: 10, unit: "kg" };
function connection(db) {
  return { execAsync: async (sql) => db.exec(sql), runAsync: async (sql, ...params) => db.prepare(sql).run(...params), getFirstAsync: async (sql) => db.prepare(sql).get() ?? null };
}
test("SQLite migrates the legacy record once and persists product edits and stock history atomically", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const original = addProduct(emptyBusiness, product);
    let reads = 0;
    const repo = createSQLiteRepository(async () => connection(db), async () => { reads++; return JSON.stringify(original); });
    assert.deepEqual(await repo.read(), original);
    const next = adjustStock(original, { id: "m", productId: product.id, kind: "remove", quantity: 0.5, reason: "Count", notes: "", createdAt: "2026-10-20T10:00:00.000Z" });
    await repo.write(next);
    const reopened = createSQLiteRepository(async () => connection(db), async () => { throw new Error("Legacy backup must not overwrite SQLite"); });
    assert.deepEqual(await reopened.read(), next);
    assert.equal(reads, 1);
    assert.equal(db.prepare("SELECT revision FROM business_state").get().revision, 2);
  } finally { db.close(); }
});
test("a corrupt legacy record is never replaced with an empty database", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const repo = createSQLiteRepository(async () => connection(db), async () => "corrupt");
    await assert.rejects(repo.read());
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM business_state").get().count, 0);
  } finally { db.close(); }
});
