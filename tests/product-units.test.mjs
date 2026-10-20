import assert from "node:assert/strict";
import test from "node:test";
import { addProduct, emptyBusiness, parseBusiness, recordPurchase, recordSale } from "../src/store/business.ts";
import { UNIT_GROUPS, PRODUCT_UNITS, validUnitSelection, parseQuantityInput, parseMoneyInput, lineAmount } from "../src/store/productUnits.ts";

const product = { id: "DX-test", name: "Rice", barcode: "", category: "Food", price: 20000, cost: 10000, stock: 10.5, unit: "kg", unitGroup: "weight", photoUri: "file:///products/DX-test.jpg" };
const date = "2026-10-20T10:00:00.000Z";

test("every unit belongs to a valid group and mismatched selections are rejected", () => {
  assert.equal(new Set(PRODUCT_UNITS.map((u) => u.id)).size, PRODUCT_UNITS.length);
  for (const group of UNIT_GROUPS) assert.ok(PRODUCT_UNITS.some((u) => u.group === group.id));
  for (const unit of PRODUCT_UNITS) assert.equal(validUnitSelection(unit.id, unit.group), true);
  assert.throws(() => addProduct(emptyBusiness, { ...product, unitGroup: "count" }), /invalidProduct/);
  assert.throws(() => addProduct(emptyBusiness, { ...product, unit: "unknown" }), /invalidProduct/);
  assert.throws(() => addProduct(addProduct(emptyBusiness, product), product), /duplicateProductId/);
});

test("quantity inputs honor unit precision and accept Bangla and Arabic digits", () => {
  assert.equal(parseQuantityInput("০.২৫০", "kg", false), 0.25);
  assert.equal(parseQuantityInput("١٫٥", "litre"), 1.5);
  assert.equal(parseQuantityInput("0", "kg"), 0);
  for (const text of ["", "1.0001", "-1", "1e2", "1,000", "Infinity"]) assert.equal(parseQuantityInput(text, "kg"), null);
  for (const unit of ["piece", "box", "dozen"]) assert.equal(parseQuantityInput("1.5", unit), null);
  assert.equal(parseQuantityInput("0", "kg", false), null);
  assert.equal(parseMoneyInput("১২.৩৪"), 1234);
  assert.equal(parseMoneyInput("0.29"), 29);
  assert.equal(parseMoneyInput("1.001"), null);
  assert.equal(lineAmount(101, 0.5), 51);
  assert.equal(lineAmount(Number.MAX_SAFE_INTEGER, 2), null);
});

test("fractional sales keep unit, photo and tracking ID through persistence", () => {
  const before = addProduct(emptyBusiness, product);
  const after = recordSale(before, product.id, 0.25, "sale", date);
  assert.equal(after.products[0].stock, 10.25);
  assert.equal(after.sales[0].total, 5000);
  assert.equal(after.sales[0].cost, 2500);
  assert.equal(after.sales[0].unit, "kg");
  assert.equal(after.sales[0].productId, product.id);
  assert.equal(after.products[0].photoUri, product.photoUri);
  assert.deepEqual(parseBusiness(JSON.stringify(after)), after);
  assert.equal(before.products[0].stock, 10.5);
});

test("repeated decimal sales reach exact zero and cannot oversell", () => {
  let data = addProduct(emptyBusiness, { ...product, stock: 0.3 });
  for (let i = 0; i < 3; i++) data = recordSale(data, product.id, 0.1, `s${i}`, date);
  assert.equal(data.products[0].stock, 0);
  assert.throws(() => recordSale(data, product.id, 0.001, "extra", date), /invalidQuantity/);
});

test("fractional purchases update weighted cost without changing historical sales", () => {
  let data = recordSale(addProduct(emptyBusiness, { ...product, stock: 1.5 }), product.id, 0.5, "s", date);
  data = recordPurchase(data, { id: "purchase", productId: product.id, quantity: 0.5, unitCost: 16000, createdAt: date });
  assert.equal(data.products[0].stock, 1.5);
  assert.equal(data.products[0].cost, 12000);
  assert.equal(data.purchases[0].total, 8000);
  assert.equal(data.purchases[0].unit, "kg");
  assert.equal(data.sales[0].cost, 5000);
  assert.deepEqual(parseBusiness(JSON.stringify(data)), data);
});

test("legacy piece data loads and corrupted unit metadata is rejected", () => {
  const { unit, unitGroup, photoUri, ...legacy } = product;
  const data = addProduct(emptyBusiness, { ...legacy, stock: 3 });
  assert.deepEqual(parseBusiness(JSON.stringify(data)), data);
  assert.throws(() => recordSale(data, product.id, 0.5, "s", date), /invalidQuantity/);
  for (const changes of [{ unit: "no" }, { unitGroup: "count" }, { stock: 1.0001 }, { photoUri: 12 }]) {
    assert.throws(() => parseBusiness(JSON.stringify({ ...data, products: [{ ...product, ...changes }] })), /invalidData/);
  }
  assert.throws(() => parseBusiness(JSON.stringify({ ...data, products: [product, product] })), /invalidData/);
});
