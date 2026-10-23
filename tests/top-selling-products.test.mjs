import assert from "node:assert/strict";
import test from "node:test";
import { emptyBusiness } from "../src/store/business.ts";
import { prioritizeTopSellingProducts, selectTopSellingProducts } from "../src/dashboard/topSellingProducts.ts";
const now = new Date(2026, 9, 20, 14);
const stamp = (day, hour = 10) => new Date(2026, 9, day, hour).toISOString();
const product = (id, unit = "piece") => ({ id, name: id, barcode: "", category: "", stock: 10, cost: 500, price: 1000, unit });
const sale = (id, productId, quantity = 1, createdAt = stamp(20), invoiceId) => ({ id, productId, name: productId, quantity, total: 1000, cost: 500, createdAt, ...(invoiceId ? { invoiceId } : {}) });
const base = (sales = []) => ({ ...emptyBusiness, products: [product("rice", "kg"), product("milk"), product("oil", "litre")], sales });
test("ranks by completed sale frequency without comparing kg, pieces or revenue", () => {
  const data = base([sale("rice1", "rice", 100), sale("milk1", "milk"), sale("milk2", "milk"), sale("oil1", "oil")]);
  const snapshot = JSON.stringify(data);
  const result = selectTopSellingProducts(data, { now });
  assert.equal(result[0].product.id, "milk"); assert.equal(result[0].saleCount, 2); assert.equal(result.find((p) => p.product.id === "rice").saleCount, 1);
  assert.equal(JSON.stringify(data), snapshot);
});
test("counts each invoice once per product and does not count invoice snapshots twice", () => {
  const first = sale("line1", "milk", 2, stamp(20), "invoice1");
  const data = { ...base([first, { ...first }, sale("line2", "milk", 1, stamp(20), "invoice1")]), invoices: [{ id: "invoice1", items: [first] }] };
  assert.equal(selectTopSellingProducts(data, { now })[0].saleCount, 1);
});
test("partial returns retain a sale, full returns remove it even when stock is not restored", () => {
  const data = { ...base([sale("milk-line", "milk", 2, stamp(20), "milk-invoice"), sale("rice-line", "rice", 1, stamp(20), "rice-invoice")]), saleReturns: [
    { invoiceId: "milk-invoice", createdAt: stamp(20, 11), items: [{ lineId: "milk-line", quantity: 1, restock: false }] },
    { invoiceId: "rice-invoice", createdAt: stamp(20, 11), items: [{ lineId: "rice-line", quantity: 1, restock: true }] },
  ] };
  assert.deepEqual(selectTopSellingProducts(data, { now }).map((p) => p.product.id), ["milk"]);
  const allReturned = { ...data, saleReturns: [...data.saleReturns, { invoiceId: "milk-invoice", createdAt: stamp(20, 12), items: [{ lineId: "milk-line", quantity: 1, restock: false }] }] };
  assert.deepEqual(selectTopSellingProducts(allReturned, { now }), []);
});
test("uses local calendar boundaries, ignores future sales and future returns", () => {
  const start = new Date(2026, 8, 21).toISOString();
  const data = { ...base([sale("start", "rice", 1, start, "i"), sale("too-old", "milk", 1, new Date(Date.parse(start) - 1).toISOString()), sale("future", "oil", 1, stamp(21))]), saleReturns: [{ invoiceId: "i", createdAt: stamp(21), items: [{ lineId: "start", quantity: 1 }] }] };
  assert.deepEqual(selectTopSellingProducts(data, { now }).map((p) => p.product.id), ["rice"]);
  assert.deepEqual(selectTopSellingProducts(data, { now, days: 1 }), []);
});
test("ties favor recent sales, then stable name/id; deleted products and unsold drafts are omitted", () => {
  const data = { ...base([sale("r", "rice", 1, stamp(19)), sale("o", "oil", 1, stamp(20)), sale("m", "milk", 1, stamp(20))]), products: [...base().products, { ...product("removed"), deletedAt: stamp(20) }], saleDraft: { lines: [{ productId: "rice", quantity: 100 }] } };
  data.sales.push(sale("d", "removed"), sale("unknown", "missing"));
  assert.deepEqual(selectTopSellingProducts(data, { now }).map((p) => p.product.id), ["milk", "oil", "rice"]);
  assert.deepEqual(selectTopSellingProducts(data, { now, limit: 1 }).map((p) => p.product.id), ["milk"]);
  assert.deepEqual(selectTopSellingProducts(data, { now, limit: 0 }), []);
  assert.deepEqual(selectTopSellingProducts(base(), { now }), []);
});
test("invalid date windows or limits are rejected", () => {
  for (const options of [{ days: 0 }, { days: 1.5 }, { days: Infinity }, { limit: -1 }, { limit: 1.1 }, { now: new Date(NaN) }]) assert.throws(() => selectTopSellingProducts(base(), options), /invalidRankingOptions/);
});
test("sale catalog puts the top ten first and preserves every remaining product once", () => {
  const products = Array.from({ length: 14 }, (_, index) => product(`p${index}`));
  const ranked = products.slice(2, 12).reverse().map((p, index) => ({ product: p, saleCount: 20 - index, lastSoldAt: stamp(20) }));
  const original = [...products];
  const ordered = prioritizeTopSellingProducts(products, ranked);
  assert.deepEqual(ordered.slice(0, 10).map((p) => p.id), ranked.map((r) => r.product.id));
  assert.deepEqual(ordered.slice(10).map((p) => p.id), ["p0", "p1", "p12", "p13"]);
  assert.equal(new Set(ordered.map((p) => p.id)).size, products.length); assert.deepEqual(products, original);
});
test("promoting best sellers retains current sellable stock and ignores missing or repeated ranks", () => {
  const current = [{ ...product("rice", "kg"), stock: 0 }, product("milk"), product("oil", "litre")];
  const ranked = [{ product: product("milk"), saleCount: 3 }, { product: product("missing"), saleCount: 2 }, { product: product("milk"), saleCount: 1 }, { product: product("rice", "kg"), saleCount: 1 }];
  const ordered = prioritizeTopSellingProducts(current, ranked);
  assert.deepEqual(ordered.map((p) => p.id), ["milk", "rice", "oil"]); assert.equal(ordered[1].stock, 0); assert.equal(ordered[1], current[0]);
  assert.deepEqual(prioritizeTopSellingProducts(current, []), current);
});
