import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { addProduct, emptyBusiness, parseBusiness, recordSale, recordPurchase } from "../src/store/business.ts";
import { adjustStock, deleteProduct, editProduct } from "../src/store/inventory.ts";
import { addProductBatch } from "../src/store/expiry.ts";
import { beginCountEntry, completeStockCount, stockCountVersion } from "../src/store/stockCounts.ts";
import { mapBackupImages } from "../src/store/backupFormat.ts";
import { createSQLiteRepository } from "../src/store/sqliteRepository.ts";
const stamp = "2026-10-20T10:00:00Z", later = "2026-10-20T11:00:00Z";
const rice = { id: "rice", name: "Rice", barcode: "", category: "Food", stock: 20, price: 8000, cost: 5000, unit: "kg", photoUri: "file:///old.jpg" };
const soap = { ...rice, id: "soap", name: "Soap", unit: "piece", stock: 12, photoUri: undefined };
const oil = { ...rice, id: "oil", name: "Oil", unit: "litre", stock: 8, photoUri: undefined };
const base = () => [rice, soap, oil].reduce((d, p) => addProduct(d, { ...p }), emptyBusiness);
const entry = (data, id, counted, reason = "") => ({ ...beginCountEntry(data, id), counted, reason });
const request = (data = base()) => ({ id: "count1", createdAt: stamp, note: "Shelf check", items: [entry(data, "rice", 18.5, "damage"), entry(data, "soap", 14, "extra"), entry(data, "oil", 8)] });
const roundtrip = (data) => assert.deepEqual(parseBusiness(JSON.stringify(data)), JSON.parse(JSON.stringify(data)));

test("count saves mixed units and matching quantities together, changes only counted inventory, and preserves money", () => {
  const data = base(), original = JSON.stringify(data), next = completeStockCount(data, request(data));
  assert.deepEqual(next.products.map((p) => p.stock), [18.5, 14, 8]); assert.deepEqual(next.products.map((p) => p.cost), data.products.map((p) => p.cost));
  assert.equal(next.stockCounts[0].number, "SC-00001"); assert.equal(next.stockCounts[0].items.length, 3); assert.equal(next.stockMovements.length, 2);
  assert.equal(next.stockCounts[0].items[2].movementId, undefined); assert.equal(next.sales, data.sales); assert.equal(next.payments, data.payments); assert.equal(next.expenses, data.expenses);
  assert.equal(JSON.stringify(data), original); roundtrip(next);
  const onlyRice = completeStockCount(data, { ...request(data), items: [entry(data, "rice", 0, "missing")] });
  assert.deepEqual(onlyRice.products.map((p) => p.stock), [0, 12, 8]);
});
test("count rejects invalid quantities, missing or wrong-direction reasons, duplicate products and empty counts", () => {
  const data = base(), input = request(data);
  for (const items of [[], [entry(data, "soap", 1.5, "missing")], [entry(data, "rice", -1, "missing")], [entry(data, "rice", 10.0001, "missing")], [entry(data, "rice", 10)], [entry(data, "rice", 21, "damage")], [entry(data, "rice", 10, "extra")], [input.items[0], input.items[0]]]) assert.throws(() => completeStockCount(data, { ...input, items }), /invalidStockCount/);
  assert.throws(() => completeStockCount(data, { ...input, createdAt: "bad" }), /invalidStockCount/);
});
test("same-ID retries are idempotent and changed retries cannot adjust stock twice", () => {
  const data = base(), input = request(data), next = completeStockCount(data, input);
  assert.equal(completeStockCount(next, input), next);
  assert.throws(() => completeStockCount(next, { ...input, note: "Changed" }), /duplicateStockCount/);
  const second = completeStockCount(next, { id: "count2", createdAt: later, note: "", items: [entry(next, "soap", 14)] });
  assert.equal(second.stockCounts[1].number, "SC-00002"); assert.equal(second.stockMovements.length, 2); roundtrip(second);
});
test("a sale then purchase returning to the same quantity still invalidates a count; removed products and changed units do too", () => {
  const data = base(), input = request(data);
  let changed = recordSale(data, "rice", 1, "sale", later);
  changed = recordPurchase(changed, { id: "purchase", productId: "rice", quantity: 1, unitCost: 5000, createdAt: later });
  assert.equal(changed.products[0].stock, 20); assert.notEqual(stockCountVersion(changed, "rice"), input.items[0].version);
  assert.throws(() => completeStockCount(changed, input), /countStale/);
  assert.throws(() => completeStockCount(deleteProduct(data, "rice", later), input), /countStale/);
  assert.throws(() => completeStockCount({ ...data, products: data.products.map((p) => p.id === "rice" ? { ...p, unit: "litre" } : p) }, input), /countStale/);
});
test("batch reductions consume expiry order, extra stock stays unassigned, and saved counts remain valid", () => {
  let data = addProductBatch(base(), { id: "old", productId: "rice", batchNumber: "old", quantity: 10, expiryDate: "2026-10-19", createdAt: stamp });
  data = addProductBatch(data, { id: "new", productId: "rice", batchNumber: "new", quantity: 8, expiryDate: "2026-11-01", createdAt: stamp });
  const next = completeStockCount(data, { ...request(data), items: [entry(data, "rice", 5, "missing")] });
  assert.deepEqual(next.productBatches.map((b) => b.quantity), [0, 3]); roundtrip(next);
  const extra = completeStockCount(next, { id: "extra", createdAt: later, note: "", items: [entry(next, "rice", 7, "extra")] });
  assert.deepEqual(extra.productBatches, next.productBatches); roundtrip(extra);
});
test("history preserves names, units and photos through edits/deletion, and backup retains the old photo", () => {
  const data = base(), next = completeStockCount(data, request(data));
  const changed = deleteProduct(editProduct(next, { ...next.products[0], name: "New rice", photoUri: "file:///new.jpg" }, later), "rice", later);
  const history = changed.stockCounts[0].items[0]; assert.equal(history.name, "Rice"); assert.equal(history.photoUri, "file:///old.jpg"); assert.equal(history.unit, "kg"); roundtrip(changed);
  const seen = new Set(); mapBackupImages(changed, (uri) => { seen.add(uri); return uri; }); assert.ok(seen.has("file:///old.jpg")); assert.ok(seen.has("file:///new.jpg"));
});
test("load/restore rejects corrupted count history, broken movement links and orphan count movements", () => {
  const next = completeStockCount(base(), request());
  for (const mutate of [d => { d.stockCounts = null; }, d => { d.stockCounts[0].items[0].counted = 2; }, d => { d.stockCounts[0].items[0].unit = "bad"; }, d => { d.stockCounts.push(d.stockCounts[0]); }, d => { d.stockMovements.shift(); }, d => { d.stockCounts = []; }, d => { d.stockCounts[0].items[0].reason = "extra"; }]) {
    const bad = JSON.parse(JSON.stringify(next)); mutate(bad); assert.throws(() => parseBusiness(JSON.stringify(bad)), /invalidData/);
  }
});
test("later failure cannot partially change earlier counted products", () => {
  const data = base(); const collision = adjustStock(data, { id: "COUNT-count1-1", productId: "oil", kind: "set", quantity: 8, reason: "test", notes: "", createdAt: stamp });
  const input = request(collision), before = JSON.stringify(collision);
  assert.throws(() => completeStockCount(collision, input), /invalidAdjustment/); assert.equal(JSON.stringify(collision), before);
});
test("SQLite stores stock, count history and movements atomically and preserves the previous shop on write failure", async () => {
  const db = new DatabaseSync(":memory:"); let fail = false;
  try {
    const adapter = { execAsync: async (sql) => db.exec(sql), runAsync: async (sql, ...params) => { if (fail) throw new Error("disk"); return db.prepare(sql).run(...params); }, getFirstAsync: async (sql) => db.prepare(sql).get() ?? null };
    const repo = createSQLiteRepository(async () => adapter, async () => JSON.stringify(base()));
    const original = await repo.read(), input = request(original), next = completeStockCount(original, input);
    fail = true; await assert.rejects(repo.write(next)); assert.deepEqual(await repo.read(), JSON.parse(JSON.stringify(original)));
    fail = false; await repo.write(next); const loaded = await repo.read(); assert.deepEqual(loaded, JSON.parse(JSON.stringify(next))); assert.equal(completeStockCount(loaded, input), loaded);
  } finally { db.close(); }
});


test("synced counts from different devices can share a display number while IDs and movement links stay unique", () => {
  const data = base();
  const a = completeStockCount(data, { id: "device-a-count", createdAt: stamp, note: "Rice shelf", items: [entry(data, "rice", 18, "missing")] });
  const b = completeStockCount(data, { id: "device-b-count", createdAt: later, note: "Soap shelf", items: [entry(data, "soap", 14, "extra")] });
  assert.equal(a.stockCounts[0].number, b.stockCounts[0].number);
  const merged = { ...data, products: [a.products[0], b.products[1], data.products[2]], stockCounts: [...a.stockCounts, ...b.stockCounts], stockMovements: [...a.stockMovements, ...b.stockMovements] };
  roundtrip(merged);
  const next = completeStockCount(merged, { id: "next-count", createdAt: later, note: "", items: [entry(merged, "oil", 8)] });
  assert.equal(next.stockCounts.at(-1).number, "SC-00003"); roundtrip(next);
  for (const mutate of [
    d => { d.stockCounts[1].id = d.stockCounts[0].id; },
    d => { d.stockCounts[1].number = "bad"; },
    d => { d.stockCounts[1].items[0].movementId = d.stockCounts[0].items[0].movementId; },
    d => { d.stockMovements[1].stockCountId = d.stockCounts[0].id; },
  ]) {
    const bad = structuredClone(merged); mutate(bad);
    assert.throws(() => parseBusiness(JSON.stringify(bad)), /invalidData/);
  }
});
