import assert from "node:assert/strict";
import test from "node:test";
import { addProduct, emptyBusiness, parseBusiness, recordSale } from "../src/store/business.ts";

const product = { id: "p1", name: "Rice", barcode: "12345", category: "Food", price: 12550, cost: 10000, stock: 3 };
test("sale decrements stock and captures revenue and historical cost together", () => {
  const before = addProduct(emptyBusiness, product);
  const after = recordSale(before, product.id, 2, "s1", "2026-10-19T12:00:00.000Z");
  assert.equal(after.products[0].stock, 1);
  assert.equal(after.sales[0].total, 25100);
  assert.equal(after.sales[0].cost, 20000);
  assert.equal(before.products[0].stock, 3);
  assert.equal(before.sales.length, 0);
});
test("a second sale cannot oversell remaining stock", () => {
  const first = recordSale(addProduct(emptyBusiness, product), product.id, 2, "s1", new Date().toISOString());
  assert.throws(() => recordSale(first, product.id, 2, "s2", new Date().toISOString()), /invalidQuantity/);
  assert.equal(first.products[0].stock, 1);
  for (const qty of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => recordSale(first, product.id, qty, "s3", "now"), /invalidQuantity/);
});
test("duplicate nonempty barcodes are rejected; products without barcodes are allowed", () => {
  const data = addProduct(emptyBusiness, product);
  assert.throws(() => addProduct(data, { ...product, id: "p2" }), /duplicateBarcode/);
  const noBarcode = addProduct(emptyBusiness, { ...product, barcode: "" });
  assert.equal(addProduct(noBarcode, { ...product, id: "p2", barcode: "" }).products.length, 2);
});
test("invalid amounts, stock and blank names cannot be saved", () => {
  for (const changes of [{ name: " " }, { price: -1 }, { price: 1.5 }, { cost: Infinity }, { stock: -1 }, { stock: 1.5 }]) {
    assert.throws(() => addProduct(emptyBusiness, { ...product, ...changes }), /invalidProduct/);
  }
});
test("persisted data round trips; corrupt records are rejected instead of silently reset", () => {
  const data = recordSale(addProduct(emptyBusiness, product), product.id, 1, "s1", new Date().toISOString());
  assert.deepEqual(parseBusiness(JSON.stringify(data)), data);
  assert.deepEqual(parseBusiness(null), emptyBusiness);
  for (const raw of ["invalid json", "null", "{}", JSON.stringify({ ...data, products: [{ ...product, stock: -1 }] }), JSON.stringify({ ...data, sales: [{ ...data.sales[0], createdAt: "invalid" }] })]) assert.throws(() => parseBusiness(raw));
});
