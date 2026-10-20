import assert from "node:assert/strict";
import test from "node:test";
import { emptyBusiness, parseBusiness } from "../src/store/business.ts";
import { activateShop, saveShopDetails } from "../src/store/shop.ts";
import { createSQLiteRepository } from "../src/store/sqliteRepository.ts";
import { DatabaseSync } from "node:sqlite";

const details = { shopName: " Rahim Store ", ownerName: " Rahim Mia ", shopPhone: "+৮৮ ০১৭১২৩৪৫৬৭৮", shopAddress: " Dhaka " };
const stamp = "2026-10-20T10:00:00.000Z";
test("registration saves details without activating until setup is complete", () => {
  assert.notEqual(parseBusiness(null).shopActive, true);
  const draft = saveShopDetails(emptyBusiness, details, "shop-stable");
  assert.equal(draft.shopActive, false);
  assert.equal(draft.shopName, "Rahim Store");
  assert.equal(draft.ownerName, "Rahim Mia");
  assert.equal(draft.shopPhone, "01712345678");
  const active = activateShop(draft, stamp);
  assert.equal(active.shopActive, true);
  assert.equal(active.shopRegisteredAt, stamp);
  assert.deepEqual(parseBusiness(JSON.stringify(active)), JSON.parse(JSON.stringify(active)));
  const edited = saveShopDetails(active, { ...details, ownerName: "New Owner" }, "ignored-new-id");
  assert.equal(edited.shopActive, true);
  assert.equal(edited.shopId, "shop-stable");
  assert.equal(activateShop(edited, "2026-10-21T10:00:00Z").shopRegisteredAt, stamp);
});
test("incomplete or malformed registration cannot activate or load as active", () => {
  for (const input of [{ ...details, shopName: " " }, { ...details, ownerName: "" }, { ...details, shopPhone: "abc" }]) assert.throws(() => saveShopDetails(emptyBusiness, input, "shop"), /invalidShop/);
  assert.throws(() => activateShop(emptyBusiness, stamp), /invalidShop/);
  for (const fields of [{ shopActive: "true" }, { shopActive: true }, { ownerName: 99 }, { shopRegisteredAt: "bad" }]) assert.throws(() => parseBusiness(JSON.stringify({ ...emptyBusiness, ...fields })), /invalidData/);
});
test("registration preserves legacy inventory and payments and persists activation atomically", async () => {
  const legacy = { ...emptyBusiness, categories: ["Food"], products: [{ id: "p1", name: "Rice", barcode: "", category: "Food", price: 9000, cost: 7000, stock: 5 }] };
  const db = new DatabaseSync(":memory:");
  const repository = createSQLiteRepository(async () => ({ execAsync: async (sql) => db.exec(sql), runAsync: async (sql, ...params) => db.prepare(sql).run(...params), getFirstAsync: async (sql) => db.prepare(sql).get() }), async () => JSON.stringify(legacy));
  try {
    const old = await repository.read();
    assert.notEqual(old.shopActive, true);
    const saved = activateShop(saveShopDetails(old, { ...details, shopPhone: "", shopAddress: "" }, "shop-id"), stamp);
    await repository.write(saved);
    const restored = await repository.read();
    assert.equal(restored.shopActive, true);
    assert.deepEqual(restored.products, legacy.products);
    assert.deepEqual(restored.categories, legacy.categories);
  } finally { db.close(); }
});
