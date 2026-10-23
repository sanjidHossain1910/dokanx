import assert from "node:assert/strict";
import test from "node:test";
import { addProduct, emptyBusiness } from "../src/store/business.ts";
import { setSaleCardQuantity, saleCardStep } from "../src/store/inlineCart.ts";
import { cartTotals } from "../src/store/pos.ts";
import { PRODUCT_UNITS, allowsFraction, unitLabel } from "../src/store/productUnits.ts";

const stamp = "2026-10-20T10:00:00Z";
const base = (unit = "kg") => addProduct(emptyBusiness, { id: "p", name: "Product", barcode: "", category: "Food", stock: 10, cost: 500, price: 1000, wholesalePrice: 800, unit });
const set = (d, q, type) => setSaleCardQuantity(d, "draft", "p", q, type, stamp);

test("inline quantity is an absolute cart amount, with zero removing the line", () => {
  const data = base(), first = set(data, 1), second = set(first, 2.5), same = set(second, 2.5);
  assert.equal(same.saleDraft.lines.length, 1); assert.equal(same.saleDraft.lines[0].quantity, 2.5); assert.equal(cartTotals(same.saleDraft).total, 2500);
  const removed = set(same, 0); assert.equal(removed.saleDraft.lines.length, 0); assert.equal(set(data, 0), data);
  for (const value of [first, second, removed]) { assert.equal(value.products[0].stock, 10); assert.deepEqual(value.sales, []); assert.equal(value.payments, undefined); }
});
test("all supported selling units enforce the same count or decimal rules inline", () => {
  for (const unit of PRODUCT_UNITS) {
    const data = base(unit.id); assert.equal(set(data, 2).saleDraft.lines[0].quantity, 2);
    if (allowsFraction(unit.id)) assert.equal(set(data, 0.125).saleDraft.lines[0].quantity, 0.125);
    else assert.throws(() => set(data, 0.125), /invalidQuantity/);
  }
});
test("stock limits, expired batches, stale drafts, and changed selling units are rejected", () => {
  const data = base(), cart = set(data, 2);
  for (const q of [-1, 10.001, 1.0001, Infinity]) assert.throws(() => set(data, q));
  assert.throws(() => setSaleCardQuantity(cart, "stale", "p", 3), /invalidCart/);
  assert.throws(() => set({ ...cart, products: [{ ...cart.products[0], unit: "litre" }] }, 3), /stockUnavailable/);
  const expired = { ...data, productBatches: [{ id: "b", productId: "p", batchNumber: "B", quantity: 8, expiryDate: "2026-10-19", createdAt: stamp }] };
  assert.equal(set(expired, 2).saleDraft.lines[0].quantity, 2); assert.throws(() => set(expired, 2.001), /stockUnavailable/);
});
test("quantity changes preserve recorded prices; explicit wholesale changes reprice the whole line", () => {
  const cart = set(base(), 2); const changed = { ...cart, products: [{ ...cart.products[0], price: 2000, wholesalePrice: 700 }] };
  assert.equal(set(changed, 3).saleDraft.lines[0].unitPrice, 1000);
  const wholesale = set(changed, 3, "wholesale"); assert.equal(cartTotals(wholesale.saleDraft).total, 2100);
  const disabled = { ...wholesale, products: [{ ...wholesale.products[0], wholesalePrice: undefined }] };
  assert.throws(() => set(disabled, 3), /wholesaleUnavailable/);
  assert.equal(set(disabled, 3, "retail").saleDraft.lines[0].unitPrice, 2000);
  assert.equal(set(disabled, 0).saleDraft.lines.length, 0);
});
test("plus/minus retains decimal precision, respects the last partial unit, and can reach zero", () => {
  assert.equal(saleCardStep(0.125, 10, "kg", 1), 1.125);
  assert.equal(saleCardStep(1.125, 10, "kg", -1), 0.125);
  assert.equal(saleCardStep(0.125, 10, "kg", -1), 0);
  assert.equal(saleCardStep(1.5, 1.75, "litre", 1), 1.75);
  assert.equal(saleCardStep(10, 10, "piece", 1), 10);
  assert.equal(saleCardStep(1, 10, "box", -1), 0);
});
test("English unit labels are compact everywhere while unit IDs and Bengali labels stay unchanged", () => {
  assert.equal(unitLabel("kg", "en"), "kg"); assert.equal(unitLabel("g", "en"), "g"); assert.equal(unitLabel("litre", "en"), "L");
  assert.equal(unitLabel("metre", "en"), "m"); assert.equal(unitLabel("hour", "en"), "hr"); assert.equal(unitLabel("piece", "en"), "pc");
  assert.equal(unitLabel("kg", "bn"), "কেজি"); assert.equal(unitLabel("litre", "bn"), "লিটার");
});
