import assert from "node:assert/strict";
import test from "node:test";
import { selectDashboard } from "../src/dashboard/selectors.ts";
import { formatMoney, formatNumber } from "../src/dashboard/format.ts";
import { addProduct, emptyBusiness, parseBusiness, recordPurchase, recordSale } from "../src/store/business.ts";
import { isThemeMode } from "../src/theme/tokens.ts";

const now = new Date(2026, 9, 21, 14, 30);
const stamp = (day, hour = 12) => new Date(2026, 9, day, hour).toISOString();
const product = { id: "p", name: "Rice", barcode: "123", category: "", price: 10000, cost: 6000, stock: 10 };
test("daily profit uses recorded cost and expenses, not purchase payments", () => {
  let data = recordSale(addProduct(emptyBusiness, product), "p", 1, "s", stamp(21));
  data = recordSale(data, "p", 2, "y", stamp(20));
  data = recordPurchase(data, { id: "b", productId: "p", quantity: 20, unitCost: 5000, createdAt: stamp(21) });
  data = { ...data, expenses: [{ id: "e", name: "Delivery", total: 1000, createdAt: stamp(21) }] };
  const result = selectDashboard(data, now);
  assert.equal(result.sales, 10000);
  assert.equal(result.purchase, 100000);
  assert.equal(result.expenses, 1000);
  assert.equal(result.profit, 3000);
  assert.equal(result.salesChange, -50);
  assert.equal(data.sales[0].cost, 6000);
});
test("weekly chart has seven local calendar days, Monday through Sunday, with missing days zeroed", () => {
  let data = addProduct(emptyBusiness, product);
  for (const day of [18, 19, 21, 25]) data = recordSale(data, "p", 1, `s${day}`, stamp(day));
  const result = selectDashboard(data, now);
  assert.equal(result.week.length, 7);
  assert.equal(result.week[0].date.getDay(), 1);
  assert.equal(result.week[6].date.getDay(), 0);
  assert.deepEqual(result.week.map((d) => d.total), [10000, 0, 10000, 0, 0, 0, 10000]);
  assert.equal(result.weeklyTotal, 30000);
});
test("daily summary respects local midnight instead of grouping by UTC date", () => {
  const data = { ...emptyBusiness, sales: [
    { id: "a", productId: "p", name: "Rice", quantity: 1, total: 1000, cost: 500, createdAt: new Date(2026, 9, 20, 23, 59).toISOString() },
    { id: "b", productId: "p", name: "Rice", quantity: 1, total: 2000, cost: 600, createdAt: new Date(2026, 9, 21, 0, 1).toISOString() },
  ] };
  assert.equal(selectDashboard(data, now).sales, 2000);
});
test("inventory separates low and empty stock, and notification read state survives reload", () => {
  const data = { ...emptyBusiness, products: [{ ...product, stock: 0 }, { ...product, id: "p2", stock: 4 }, { ...product, id: "p3", stock: 6 }] };
  const result = selectDashboard(data, now);
  assert.equal(result.productCount, 3);
  assert.equal(result.lowStockCount, 1);
  assert.equal(result.outOfStockCount, 1);
  assert.equal(result.unread, 2);
  const read = parseBusiness(JSON.stringify({ ...data, notificationReadSignature: result.alertSignature }));
  assert.equal(selectDashboard(read, now).unread, 0);
  assert.equal(selectDashboard({ ...read, products: read.products.map((p) => p.id === "p2" ? { ...p, stock: 3 } : p) }, now).unread, 2);
});
test("legacy local records load without new collections; corrupt new records are rejected", () => {
  assert.deepEqual(parseBusiness(JSON.stringify(emptyBusiness)), emptyBusiness);
  assert.throws(() => parseBusiness(JSON.stringify({ ...emptyBusiness, purchases: [{ id: "bad" }] })));
  assert.throws(() => parseBusiness(JSON.stringify({ ...emptyBusiness, expenses: "bad" })));
  assert.throws(() => parseBusiness(JSON.stringify({ ...emptyBusiness, customers: [{ name: "bad" }] })));
});
test("purchase adds stock at weighted cost and does not rewrite earlier sale cost", () => {
  const before = recordSale(addProduct(emptyBusiness, { ...product, stock: 3 }), "p", 1, "s", stamp(20));
  const after = recordPurchase(before, { id: "b", productId: "p", quantity: 2, unitCost: 8000, createdAt: stamp(21) });
  assert.equal(after.products[0].stock, 4);
  assert.equal(after.products[0].cost, 7000);
  assert.equal(after.sales[0].cost, 6000);
  assert.equal(before.products[0].stock, 2);
  assert.throws(() => recordPurchase(before, { id: "b", productId: "p", quantity: -1, unitCost: 8000, createdAt: stamp(21) }));
});
test("formatters use Bangla digits and unambiguous taka amounts; theme mode values are constrained", () => {
  assert.equal(formatMoney(12550, "en"), "৳125.50");
  assert.equal(formatMoney(12550, "bn"), "৳১২৫.৫০");
  assert.equal(formatNumber(245, "bn"), "২৪৫");
  for (const mode of ["light", "dark", "system"]) assert.equal(isThemeMode(mode), true);
  assert.equal(isThemeMode("invalid"), false);
});
