import assert from "node:assert/strict";
import test from "node:test";
import { addProduct, emptyBusiness } from "../src/store/business.ts";
import { setSaleCardQuantity } from "../src/store/inlineCart.ts";
import { commitSaleScans, createSaleScanGuard, stageSaleScan, stepSaleScan } from "../src/scanner/saleScan.ts";

const data = () => ["a", "b"].reduce((d, id) => addProduct(d, { id, name: id, barcode: id, category: "Food", stock: 10, cost: 100, price: 200, unit: "piece" }), emptyBusiness);
test("quantity buttons keep row order, remove at zero, and leave the existing cart untouched", () => {
  const d = setSaleCardQuantity(data(), "draft", "a", 2);
  let rows = stageSaleScan(d, stageSaleScan(d, [], "a"), "b");
  rows = stepSaleScan(d, rows, "a", 1);
  assert.deepEqual(rows.map(r => [r.productId, r.quantity]), [["b", 1], ["a", 2]]);
  rows = stepSaleScan(d, rows, "a", -1);
  assert.equal(rows[1].quantity, 1);
  rows = stepSaleScan(d, rows, "a", -1);
  assert.deepEqual(rows.map(r => r.productId), ["b"]);
  assert.equal(d.saleDraft.lines[0].quantity, 2);
  assert.equal(commitSaleScans(d, rows, "draft", "unused").saleDraft.lines.find(l => l.productId === "a").quantity, 2);
});
test("quantity buttons preserve fractional precision and reject stock overflow", () => {
  const d = { ...data(), products: data().products.map(p => ({ ...p, unit: "kg", stock: 1.25 })) };
  let rows = stageSaleScan(d, [], "a");
  rows = stepSaleScan(d, rows, "a", 1);
  assert.equal(rows[0].quantity, 1.25);
  assert.throws(() => stepSaleScan(d, rows, "a", 1), /stockUnavailable/);
  rows = stepSaleScan(d, rows, "a", -1);
  assert.equal(rows[0].quantity, 0.25);
  assert.equal(stepSaleScan(d, rows, "a", -1).length, 0);
});
test("new and repeated products move to the top without duplicate rows; staging leaves the cart untouched", () => {
  const d = data();
  let rows = stageSaleScan(d, [], "a");
  rows = stageSaleScan(d, rows, "b");
  rows = stageSaleScan(d, rows, "a");
  assert.deepEqual(rows.map(r => [r.productId, r.quantity]), [["a", 2], ["b", 1]]);
  assert.equal(d.saleDraft, undefined);
  const committed = commitSaleScans(d, rows, undefined, "draft");
  assert.deepEqual(committed.saleDraft.lines.map(l => [l.productId, l.quantity]), [["a", 2], ["b", 1]]);
  assert.deepEqual(committed.products, d.products);
  assert.deepEqual(committed.sales, []);
});
test("continuous camera events count once until code is removed or changed", () => {
  const guard = createSaleScanGuard();
  assert.equal(guard("a", 0), true);
  for (const time of [100, 1000, 2000, 3000]) assert.equal(guard("a", time), false);
  assert.equal(guard("a", 4500), true);
  assert.equal(guard("b", 4600), true);
  assert.equal(guard("a", 4700), true);
});
test("existing cart quantities and wholesale prices are retained; stock cannot be exceeded", () => {
  const d = setSaleCardQuantity({ ...data(), products: data().products.map(p => ({ ...p, wholesalePrice: 150 })) }, "draft", "a", 9, "wholesale");
  const rows = stageSaleScan(d, [], "a");
  assert.equal(rows[0].unitPrice, 150);
  assert.throws(() => stageSaleScan(d, rows, "a"), /stockUnavailable/);
  const result = commitSaleScans(d, rows, "draft", "unused");
  assert.equal(result.saleDraft.lines[0].quantity, 10);
  assert.equal(result.saleDraft.lines[0].unitPrice, 150);
});
test("fractional stock remainder respects unit and expiry limits", () => {
  const d = { ...data(), products: data().products.map(p => ({ ...p, unit: "kg", stock: 1.25 })) };
  const first = stageSaleScan(d, [], "a");
  const second = stageSaleScan(d, first, "a");
  assert.equal(second[0].quantity, 1.25);
  assert.throws(() => stageSaleScan(d, second, "a"), /stockUnavailable/);
  assert.equal(commitSaleScans(d, second, undefined, "draft").saleDraft.lines[0].quantity, 1.25);
});
test("a changed draft, price, unit or stock rejects the entire session without a partial cart", () => {
  const d = data(), rows = stageSaleScan(d, stageSaleScan(d, [], "a"), "b");
  assert.throws(() => commitSaleScans(setSaleCardQuantity(d, "other", "a", 1), rows, undefined, "new"), /invalidCart/);
  for (const change of [{ price: 300 }, { unit: "kg" }, { stock: 0 }, { deletedAt: new Date().toISOString() }]) {
    const changed = { ...d, products: d.products.map(p => p.id === "a" ? { ...p, ...change } : p) };
    assert.throws(() => commitSaleScans(changed, rows, undefined, "draft"));
    assert.equal(changed.saleDraft, undefined);
  }
});
