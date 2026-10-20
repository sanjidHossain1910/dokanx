import assert from "node:assert/strict";
import test from "node:test";
import { addProduct, emptyBusiness, parseBusiness, recordPurchase, recordSale } from "../src/store/business.ts";
import { activeProducts, adjustStock, deleteProduct, editProduct, stockResult, stockStatus } from "../src/store/inventory.ts";
import { selectDashboard } from "../src/dashboard/selectors.ts";
const stamp = "2026-10-20T10:00:00.000Z";
const p = { id: "p1", name: "Rice", barcode: "1234", category: "Food", price: 9000, cost: 7000, stock: 10.5, unit: "kg", unitGroup: "weight", lowStockThreshold: 2.5, description: "Miniket" };

test("stock statuses are mutually exclusive and use each product threshold", () => {
  for (const [stock, expected] of [[0, "out"], [0.1, "low"], [2.5, "low"], [2.501, "in"]]) assert.equal(stockStatus({ ...p, stock }), expected);
  assert.equal(stockStatus({ ...p, stock: 1, lowStockThreshold: 0 }), "in");
  assert.equal(stockStatus({ ...p, stock: 4, lowStockThreshold: undefined }), "low");
  const data = { ...emptyBusiness, products: [{ ...p, stock: 3 }, { ...p, id: "p2", stock: 1 }, { ...p, id: "p3", stock: 0 }] };
  const overview = selectDashboard(data);
  assert.equal(overview.lowStockCount, 1);
  assert.equal(overview.outOfStockCount, 1);
});

test("add, remove and set stock preserve exact decimals and record immutable audit history", () => {
  let data = addProduct(emptyBusiness, p);
  for (const [index, kind, quantity, after] of [[1, "add", 0.25, 10.75], [2, "remove", 0.5, 10.25], [3, "set", 0, 0]]) {
    const before = data;
    data = adjustStock(data, { id: `m${index}`, productId: p.id, kind, quantity, reason: "Count", notes: "Shelf", createdAt: stamp });
    assert.equal(data.products[0].stock, after);
    assert.equal(data.stockMovements.at(-1).before, before.products[0].stock);
    assert.equal(data.stockMovements.at(-1).after, after);
    assert.equal(data.stockMovements.at(-1).unit, "kg");
  }
  assert.deepEqual(parseBusiness(JSON.stringify(data)), data);
  assert.equal(stockResult(0.3, 0.1, "remove", "kg"), 0.2);
  assert.equal(stockResult(0, 1, "remove", "kg"), null);
  assert.equal(stockResult(2, 0.5, "add", "piece"), null);
  assert.throws(() => adjustStock(data, { id: "bad", productId: p.id, kind: "remove", quantity: 1, reason: "", notes: "", createdAt: stamp }), /invalidAdjustment/);
  const corrupt = { ...data, stockMovements: [{ ...data.stockMovements[0], after: -1 }] };
  assert.throws(() => parseBusiness(JSON.stringify(corrupt)), /invalidData/);
});

test("editing preserves identity, live stock and historical sale values", () => {
  const data = recordSale(addProduct(emptyBusiness, p), p.id, 0.5, "s", stamp);
  const after = editProduct(data, { ...p, name: "Rice premium", price: 12000, cost: 10000, stock: 999, description: "Updated" }, stamp);
  assert.equal(after.products[0].stock, 10);
  assert.equal(after.products[0].id, p.id);
  assert.equal(after.products[0].description, "Updated");
  assert.equal(after.sales[0].name, "Rice");
  assert.equal(after.sales[0].total, 4500);
  assert.throws(() => editProduct(data, { ...p, unit: "g", unitGroup: "weight" }, stamp), /unitHasStock/);
  const zero = { ...data, products: [{ ...p, stock: 0 }] };
  assert.equal(editProduct(zero, { ...p, unit: "g", unitGroup: "weight" }, stamp).products[0].unit, "g");
  assert.deepEqual(parseBusiness(JSON.stringify(after)), after);
});

test("confirmed deletion hides inventory while retaining previous transactions and IDs", () => {
  const data = recordSale(addProduct(emptyBusiness, p), p.id, 0.5, "s", stamp);
  const after = deleteProduct(data, p.id, stamp);
  assert.equal(activeProducts(after).length, 0);
  assert.equal(selectDashboard(after).productCount, 0);
  assert.equal(selectDashboard(after).alerts.length, 0);
  assert.equal(after.sales.length, 1);
  assert.equal(after.products[0].id, p.id);
  assert.throws(() => recordSale(after, p.id, 1, "s2", stamp), /invalidQuantity/);
  assert.throws(() => recordPurchase(after, { id: "b", productId: p.id, quantity: 1, unitCost: 100, createdAt: stamp }), /invalidPurchase/);
  assert.throws(() => editProduct(after, p, stamp), /productMissing/);
  assert.equal(addProduct(after, { ...p, id: "new" }).products.length, 2);
  assert.throws(() => addProduct(after, p), /duplicateProductId/);
  assert.deepEqual(parseBusiness(JSON.stringify(after)), after);
});

test("invalid thresholds and inventory dates cannot corrupt persisted data", () => {
  for (const changes of [{ lowStockThreshold: -1 }, { lowStockThreshold: 0.0001 }, { deletedAt: "bad" }, { description: 5 }]) assert.throws(() => addProduct(emptyBusiness, { ...p, ...changes }), /invalidProduct/);
});
