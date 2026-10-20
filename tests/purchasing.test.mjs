import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { addProduct, emptyBusiness, parseBusiness } from "../src/store/business.ts";
import { saveSupplier, selectPurchaseSupplier, setPurchaseItem, purchaseTotals, completePurchase, receivePurchase } from "../src/store/purchasing.ts";
import { purchaseReceiptHTML } from "../src/store/purchaseReceipt.ts";
import { createSQLiteRepository } from "../src/store/sqliteRepository.ts";
import { selectDashboard } from "../src/dashboard/selectors.ts";
const stamp = "2026-10-20T10:00:00.000Z";
const supplier = { id: "supplier", name: "Traders", phone: "+8801712345678", address: "Dhaka", balance: 0 };
const product = { id: "rice", name: "Rice", barcode: "", category: "Grocery", unit: "kg", unitGroup: "weight", stock: 10, cost: 5000, price: 9000 };
const input = { paid: 0, method: "cash", status: "received", reference: "", note: "", createdAt: stamp };
function basket() { return setPurchaseItem(selectPurchaseSupplier(saveSupplier(addProduct(emptyBusiness, product), supplier), supplier.id, "draft-purchase"), product.id, 2.5, 6000); }
const roundtrip = (data) => parseBusiness(JSON.stringify(data));
test("supplier and unit-aware purchase draft persist without changing live stock", () => {
  const data = basket();
  assert.equal(data.products[0].stock, 10);
  assert.equal(purchaseTotals(data.purchaseDraft).total, 15000);
  assert.deepEqual(roundtrip(data), data);
  assert.throws(() => saveSupplier(data, { ...supplier, id: "new" }), /invalidSupplier/);
  assert.throws(() => selectPurchaseSupplier(data, "missing", "d"), /supplierRequired/);
  assert.throws(() => setPurchaseItem(data, product.id, 0.0001, 1), /invalidItem/);
  assert.equal(setPurchaseItem(data, product.id, 0, 6000).purchaseDraft.lines.length, 0);
});
test("purchase bill applies exact discounts and charges and commits all receipt records once", () => {
  const data = basket();
  data.purchaseDraft = { ...data.purchaseDraft, discount: { kind: "percent", value: 1000 }, transport: 1000, other: 500 };
  const saved = completePurchase(data, data.purchaseDraft.id, { ...input, paid: 10000 });
  assert.equal(saved.purchaseInvoices[0].total, 15000);
  assert.equal(saved.purchaseInvoices[0].due, 5000);
  assert.equal(saved.suppliers[0].balance, 5000);
  assert.equal(saved.products[0].stock, 12.5);
  assert.equal(saved.products[0].cost, 5200);
  assert.equal(saved.purchases[0].netTotal, 15000);
  assert.equal(saved.stockMovements[0].purchaseId, saved.purchaseInvoices[0].id);
  assert.equal(saved.purchaseDraft, undefined);
  assert.equal(selectDashboard(saved, new Date(stamp)).purchase, 15000);
  assert.strictEqual(completePurchase(saved, data.purchaseDraft.id, input), saved);
  assert.deepEqual(roundtrip(saved), JSON.parse(JSON.stringify(saved)));
});
test("discount and landed costs allocate exactly across tiny and zero-price lines", () => {
  let data = basket();
  data = addProduct(data, { ...product, id: "free", stock: 0, unit: "piece", unitGroup: "count" });
  data = setPurchaseItem(data, product.id, 0.001, 1000);
  data = setPurchaseItem(data, "free", 3, 0);
  data.purchaseDraft = { ...data.purchaseDraft, transport: 7, discount: { kind: "fixed", value: 1 } };
  const saved = completePurchase(data, data.purchaseDraft.id, input);
  assert.equal(saved.purchaseInvoices[0].total, 7);
  assert.equal(saved.purchaseInvoices[0].items.reduce((n, l) => n + l.netTotal, 0), 7);
  assert.deepEqual(roundtrip(saved), JSON.parse(JSON.stringify(saved)));
});
test("pending purchase never adds stock until idempotent receive; supplier due is not duplicated", () => {
  const data = basket();
  const pending = completePurchase(data, data.purchaseDraft.id, { ...input, status: "pending" });
  assert.equal(pending.products[0].stock, 10);
  assert.equal(pending.purchases, undefined);
  assert.equal(pending.stockMovements, undefined);
  assert.equal(pending.suppliers[0].balance, 15000);
  assert.equal(selectDashboard(pending, new Date(stamp)).purchase, 15000);
  assert.deepEqual(roundtrip(pending), JSON.parse(JSON.stringify(pending)));
  const received = receivePurchase(pending, pending.purchaseInvoices[0].id, "2026-10-21T10:00:00.000Z");
  assert.equal(received.products[0].stock, 12.5);
  assert.equal(received.suppliers[0].balance, 15000);
  assert.equal(selectDashboard(received, new Date(stamp)).purchase, 15000);
  assert.equal(selectDashboard(received, new Date("2026-10-21T12:00:00.000Z")).purchase, 0);
  assert.strictEqual(receivePurchase(received, received.purchaseInvoices[0].id, stamp), received);
  assert.deepEqual(roundtrip(received), JSON.parse(JSON.stringify(received)));
});
test("invalid payment, deleted products and changed units cannot commit partial purchase data", () => {
  const data = basket();
  assert.throws(() => completePurchase(data, data.purchaseDraft.id, { ...input, paid: 15001 }), /invalidPayment/);
  const changed = { ...data, products: [{ ...product, unit: "g", unitGroup: "weight" }] };
  assert.throws(() => completePurchase(changed, data.purchaseDraft.id, input), /productChanged/);
  const pending = completePurchase(data, data.purchaseDraft.id, { ...input, status: "pending" });
  const deleted = { ...pending, products: [{ ...product, deletedAt: stamp }] };
  assert.throws(() => receivePurchase(deleted, pending.purchaseInvoices[0].id, stamp), /productChanged/);
  assert.equal(deleted.products[0].stock, 10);
});
test("legacy purchases remain readable; corrupt invoice links and allocations are rejected", () => {
  const data = basket(); const saved = completePurchase(data, data.purchaseDraft.id, input);
  for (const change of [{ suppliers: [] }, { purchases: [] }, { stockMovements: [] }, { purchaseInvoices: [{ ...saved.purchaseInvoices[0], total: 1 }] }, { purchaseInvoices: [{ ...saved.purchaseInvoices[0], items: [{ ...saved.purchaseInvoices[0].items[0], netTotal: 1 }] }] }]) assert.throws(() => roundtrip({ ...saved, ...change }), /invalidData/);
  const legacy = { ...emptyBusiness, products: [product], purchases: [{ id: "old", productId: product.id, name: product.name, quantity: 1, unitCost: 100, total: 100, unit: "kg", createdAt: stamp }] };
  assert.deepEqual(roundtrip(legacy), legacy);
});
test("purchase database write abort preserves draft and stock before a successful atomic retry", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const data = basket();
    const adapter = { execAsync: async (sql) => db.exec(sql), runAsync: async (sql, ...args) => db.prepare(sql).run(...args), getFirstAsync: async (sql) => db.prepare(sql).get() ?? null };
    const repo = createSQLiteRepository(async () => adapter, async () => JSON.stringify(data));
    await repo.read();
    const saved = completePurchase(data, data.purchaseDraft.id, input);
    db.exec("CREATE TRIGGER fail_purchase BEFORE UPDATE ON business_state BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;");
    await assert.rejects(repo.write(saved));
    assert.deepEqual(await repo.read(), data);
    db.exec("DROP TRIGGER fail_purchase;");
    await repo.write(saved);
    assert.equal((await repo.read()).products[0].stock, 12.5);
  } finally { db.close(); }
});
test("purchase print document escapes shop names and omits supplier and payment details", () => {
  const data = basket(); const saved = completePurchase(data, data.purchaseDraft.id, input);
  const html = purchaseReceiptHTML({ ...saved.purchaseInvoices[0], shopName: "<script>x</script>", supplierName: "Hidden supplier", note: "<img onerror=x>" }, "en", (key) => key);
  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("Hidden supplier"), false);
  assert.equal(html.includes("onerror"), false);
  assert.match(html, /<footer>Thank you<\/footer>/);
});
