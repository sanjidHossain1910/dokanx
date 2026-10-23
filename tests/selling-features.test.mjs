import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { addProduct, emptyBusiness, parseBusiness } from "../src/store/business.ts";
import { addCartProduct, cartTotals, completeSale, setCartPriceType } from "../src/store/pos.ts";
import { hasWholesalePrice } from "../src/store/productPricing.ts";
import { editProduct, setProductFavorite } from "../src/store/inventory.ts";
import { holdSale, previewHeldSale, removeHeldSale, resumeHeldSale } from "../src/store/heldSales.ts";
import { addProductBatch } from "../src/store/expiry.ts";
import { selectTopSellingProducts } from "../src/dashboard/topSellingProducts.ts";
import { mapBackupImages } from "../src/store/backupFormat.ts";
import { createSQLiteRepository } from "../src/store/sqliteRepository.ts";
const stamp = "2026-10-20T10:00:00Z", later = "2026-10-20T11:00:00Z";
const p = { id: "rice", name: "Rice", barcode: "", category: "Food", stock: 20, price: 8000, wholesalePrice: 7500, cost: 5000, unit: "kg", unitGroup: "weight", photoUri: "file:///photos/old.jpg" };
const base = () => ({ ...addProduct(emptyBusiness, p), customers: [{ id: "c", name: "Rahim", phone: "", balance: 0 }] });
const cart = (data = base(), id = "cart", quantity = 2, type) => addCartProduct(data, "rice", id, quantity, type);
const held = (data = cart()) => holdSale(data, data.saleDraft.id, { label: " Rahim — coming back ", createdAt: stamp });
const cash = { method: "cash", received: 20000, note: "", reference: "", createdAt: later };
const roundtrip = (data) => assert.deepEqual(parseBusiness(JSON.stringify(data)), JSON.parse(JSON.stringify(data)));
test("wholesale price is optional and persisted only as a valid positive minor-unit amount", () => {
  const old = { ...p }; delete old.wholesalePrice;
  const normal = addProduct(emptyBusiness, old); assert.equal(hasWholesalePrice(normal.products[0]), false); roundtrip(normal);
  assert.equal(hasWholesalePrice(p), true); roundtrip(base());
  for (const value of [null, 0, -1, 1.1, "7500", Infinity]) assert.throws(() => addProduct(emptyBusiness, { ...p, wholesalePrice: value }), /invalidProduct/);
  for (const value of [1, "true", null]) assert.throws(() => parseBusiness(JSON.stringify({ ...base(), products: [{ ...p, isFavorite: value }] })), /invalidData/);
});
test("favorite changes persist without modifying stock, prices or financial records", () => {
  const data = cart(), favorite = setProductFavorite(data, "rice", true, stamp);
  assert.equal(favorite.products[0].isFavorite, true); assert.equal(favorite.products[0].stock, 20); assert.equal(favorite.saleDraft, data.saleDraft); assert.equal(favorite.sales, data.sales); roundtrip(favorite);
  const changed = editProduct(favorite, { ...p, price: 8100, wholesalePrice: undefined }, later);
  assert.equal(changed.products[0].isFavorite, true); assert.equal(hasWholesalePrice(changed.products[0]), false); roundtrip(changed);
  assert.equal(setProductFavorite(changed, "rice", false, later).products[0].isFavorite, false);
});
test("retail and wholesale use distinct exact unit prices with the same stock and cost", () => {
  const retail = cart(base(), "retail", 1.5), wholesale = cart(base(), "wholesale", 1.5, "wholesale");
  assert.equal(cartTotals(retail.saleDraft).total, 12000); assert.equal(cartTotals(wholesale.saleDraft).total, 11250);
  const result = completeSale(wholesale, "wholesale", cash);
  assert.equal(result.invoices[0].items[0].priceType, "wholesale"); assert.equal(result.invoices[0].items[0].unitPrice, 7500); assert.equal(result.sales[0].cost, 7500); assert.equal(result.products[0].stock, 18.5); roundtrip(result);
  const changed = editProduct(result, { ...result.products[0], price: 10000, wholesalePrice: undefined }, later);
  assert.equal(changed.invoices[0].items[0].unitPrice, 7500); roundtrip(changed);
});
test("unavailable wholesale cannot be added or checked out; retail recovers an existing cart", () => {
  const data = cart(base(), "whole", 2, "wholesale");
  const disabled = editProduct(data, { ...data.products[0], wholesalePrice: undefined }, stamp);
  assert.throws(() => addCartProduct(disabled, "rice", "ignored", 1, "wholesale"), /wholesaleUnavailable/);
  assert.throws(() => completeSale(disabled, "whole", cash), /wholesaleUnavailable/);
  const fixed = setCartPriceType(disabled, "whole", "rice", "retail"); assert.equal(fixed.saleDraft.lines[0].unitPrice, 8000); roundtrip(completeSale(fixed, "whole", cash));
  assert.throws(() => addCartProduct(base(), "rice", "bad", 1, "custom"), /invalidPriceType/);
});
test("switching price type reprices the whole product line without duplicate lines", () => {
  const data = cart(); const extra = addCartProduct(data, "rice", "ignored", 1, "wholesale");
  assert.equal(extra.saleDraft.lines.length, 1); assert.equal(extra.saleDraft.lines[0].quantity, 3); assert.equal(cartTotals(extra.saleDraft).total, 22500);
  const changed = setCartPriceType(extra, "cart", "rice", "retail"); assert.equal(cartTotals(changed.saleDraft).total, 24000); assert.equal(data.saleDraft.lines[0].unitPrice, 8000); roundtrip(changed);
  const edited = editProduct(changed, { ...changed.products[0], price: 9000 }, later); assert.equal(setCartPriceType(edited, "cart", "rice", "retail"), edited);
});
test("holding preserves cart identity, quantities, customer and totals without recording a sale", () => {
  const basket = cart(); const data = { ...basket, saleDraft: { ...basket.saleDraft, customerId: "c", discount: { kind: "percent", value: 500 }, taxRate: 200 } };
  const saved = held(data); assert.equal(saved.saleDraft, undefined); assert.equal(saved.heldSales[0].id, "cart"); assert.equal(saved.heldSales[0].customerId, "c"); assert.equal(saved.heldSales[0].label, "Rahim — coming back");
  assert.deepEqual(cartTotals(saved.heldSales[0]), cartTotals(data.saleDraft));
  for (const key of ["products", "sales", "customers", "payments", "stockMovements", "invoices"]) assert.equal(saved[key], data[key]);
  assert.deepEqual(selectTopSellingProducts(saved, { now: new Date(later) }), []); roundtrip(saved);
  assert.equal(holdSale(saved, "cart", { label: "Rahim — coming back", createdAt: stamp }), saved);
  assert.throws(() => holdSale(saved, "cart", { label: "Different", createdAt: stamp }), /heldChanged/);
});
test("held quantities do not reserve stock; active carts are never overwritten on resume", () => {
  const saved = held(), another = cart(saved, "another", 1);
  assert.equal(another.products[0].stock, 20); assert.throws(() => resumeHeldSale(another, "cart", later), /activeSaleExists/);
  const paid = completeSale(another, "another", cash); const resumed = resumeHeldSale(paid, "cart", later);
  assert.equal(resumed.products[0].stock, 19); assert.equal(resumed.heldSales.length, 0); assert.equal(resumed.saleDraft.id, "cart"); assert.equal(resumeHeldSale(resumed, "cart", later), resumed); roundtrip(resumed);
  assert.throws(() => cart(saved, "cart", 1), /duplicateInvoice/);
});
test("resume rechecks current prices and customer but leaves the saved snapshot untouched until confirmed", () => {
  const saved = held(cart(base(), "cart", 2, "wholesale"));
  const before = JSON.stringify(saved.heldSales); const changed = editProduct(saved, { ...saved.products[0], name: "New Rice", wholesalePrice: 7000, photoUri: "file:///photos/new.jpg" }, later);
  const preview = previewHeldSale(changed, "cart", later);
  assert.equal(preview.adjusted, true); assert.equal(preview.totals.total, 14000); assert.equal(preview.draft.lines[0].photoUri, "file:///photos/new.jpg"); assert.equal(JSON.stringify(changed.heldSales), before);
  const resumed = resumeHeldSale(changed, "cart", later, JSON.stringify(preview.draft)); assert.equal(resumed.saleDraft.lines[0].unitPrice, 7000); roundtrip(resumed);
  const stale = editProduct(changed, { ...changed.products[0], wholesalePrice: 6500 }, later); assert.throws(() => resumeHeldSale(stale, "cart", later, JSON.stringify(preview.draft)), /heldChanged/);
});
test("disabled wholesale resumes as retail and lower prices safely reduce an excessive fixed discount", () => {
  let data = cart(base(), "cart", 1, "wholesale"); data = { ...data, saleDraft: { ...data.saleDraft, discount: { kind: "fixed", value: 6000 } } };
  const saved = held(data), changed = editProduct(saved, { ...saved.products[0], price: 5000, wholesalePrice: undefined }, later);
  const preview = previewHeldSale(changed, "cart", later); assert.equal(preview.draft.lines[0].priceType, "retail"); assert.equal(preview.draft.discount.value, 5000); assert.equal(preview.totals.total, 0); assert.equal(preview.adjusted, true); roundtrip(resumeHeldSale(changed, "cart", later));
});
test("insufficient, expired, removed or changed-unit products cannot partially resume", () => {
  const saved = held();
  const expired = addProductBatch(saved, { id: "lot", productId: "rice", batchNumber: "A", expiryDate: "2026-10-19", quantity: 20, createdAt: stamp });
  for (const bad of [{ ...saved, products: [{ ...p, stock: 1 }] }, expired, { ...saved, products: [{ ...p, deletedAt: stamp }] }, { ...saved, products: [{ ...p, unit: "litre", unitGroup: "volume" }] }]) {
    const before = JSON.stringify(bad); assert.throws(() => resumeHeldSale(bad, "cart", later), /stockUnavailable|heldProductChanged/); assert.equal(JSON.stringify(bad), before);
  }
});
test("deleting a held cart never changes active cart, stock or payment", () => {
  const data = cart(held(), "active"); const removed = removeHeldSale(data, "cart");
  assert.equal(removed.heldSales.length, 0); assert.equal(removed.saleDraft, data.saleDraft); assert.equal(removed.products, data.products); assert.equal(removed.payments, data.payments); roundtrip(removed);
});
test("corrupt held snapshots, duplicate identities and unsupported price types are rejected on load", () => {
  const saved = held();
  for (const corrupt of [(d) => d.heldSales.push(d.heldSales[0]), (d) => d.saleDraft = { ...d.heldSales[0] }, (d) => d.heldSales[0].heldAt = "bad", (d) => d.heldSales[0].lines[0].priceType = "custom", (d) => d.heldSales[0].lines[0].productId = "missing", (d) => d.heldSales[0].customerId = "missing", (d) => d.heldSales[0].lines[0].quantity = -1]) { const bad = structuredClone(saved); corrupt(bad); assert.throws(() => parseBusiness(JSON.stringify(bad)), /invalidData/); }
});
test("backup image traversal includes held photos as well as current product photos", () => {
  const saved = held(); const changed = editProduct(saved, { ...saved.products[0], photoUri: "file:///photos/new.jpg", isFavorite: true }, later);
  const mapped = mapBackupImages(changed, (uri) => uri.replace("/photos/", "/restored/"));
  assert.equal(mapped.heldSales[0].lines[0].photoUri, "file:///restored/old.jpg"); assert.equal(mapped.products[0].photoUri, "file:///restored/new.jpg"); roundtrip(mapped);
});
test("SQLite hold and resume commits are atomic and can be retried after a failed write", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const original = cart(); const adapter = { execAsync: async (sql) => db.exec(sql), runAsync: async (sql, ...args) => db.prepare(sql).run(...args), getFirstAsync: async (sql) => db.prepare(sql).get() ?? null };
    const repo = createSQLiteRepository(async () => adapter, async () => JSON.stringify(original)); await repo.read();
    const saved = held(original); db.exec("CREATE TRIGGER fail_hold BEFORE UPDATE ON business_state BEGIN SELECT RAISE(ABORT, 'failed'); END;");
    await assert.rejects(repo.write(saved)); assert.deepEqual(await repo.read(), original); db.exec("DROP TRIGGER fail_hold;"); await repo.write(saved);
    const persisted = await repo.read(); assert.equal(persisted.saleDraft, undefined); assert.equal(persisted.heldSales.length, 1);
    const resumed = resumeHeldSale(persisted, "cart", later); db.exec("CREATE TRIGGER fail_resume BEFORE UPDATE ON business_state BEGIN SELECT RAISE(ABORT, 'failed'); END;"); await assert.rejects(repo.write(resumed)); assert.equal((await repo.read()).heldSales.length, 1); db.exec("DROP TRIGGER fail_resume;"); await repo.write(resumed);
    const final = await repo.read(); assert.equal(final.heldSales.length, 0); assert.equal(final.saleDraft.id, "cart"); assert.equal(final.products[0].stock, 20);
  } finally { db.close(); }
});
