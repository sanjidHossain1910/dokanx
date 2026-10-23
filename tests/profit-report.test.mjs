import assert from "node:assert/strict";
import test from "node:test";
import { emptyBusiness, addProduct, recordSale } from "../src/store/business.ts";
import { addCartProduct, completeSale } from "../src/store/pos.ts";
import { returnSale } from "../src/store/finance.ts";
import { selectProfitReport, selectSaleProfit, selectProfitHistory, profitMargin } from "../src/dashboard/profitReport.ts";
import { selectDashboard } from "../src/dashboard/selectors.ts";
import { historyRange } from "../src/store/salesHistory.ts";

const now = new Date(2026, 9, 20, 14), stamp = (day, hour = 10) => new Date(2026, 9, day, hour).toISOString();
const range = (day = 20) => historyRange("today", new Date(2026, 9, day, 14), "", "");
const p = { id: "rice", name: "Rice", barcode: "", category: "Food", stock: 50, cost: 5000, price: 8000, wholesalePrice: 7000, unit: "kg", unitGroup: "weight", photoUri: "file:///old.jpg" };
const base = () => addProduct(emptyBusiness, { ...p });
function sold(data = base(), id = "i1", day = 20, type = "retail") {
  const cart = addCartProduct(data, p.id, id, 2.5, type);
  cart.saleDraft.discount = { kind: "fixed", value: 501 }; cart.saleDraft.taxRate = 500;
  return completeSale(cart, id, { method: "cash", received: 50000, note: "", reference: "", createdAt: stamp(day) });
}
const refund = (data, quantity, restock, day = 20, id = "r1") => returnSale(data, { id, invoiceId: "i1", items: [{ lineId: data.invoices[0].items[0].id, quantity, restock }], method: "cash", note: "Customer return", createdAt: stamp(day, 12) });

test("profit uses immutable invoice prices, cost, discount and tax, not current catalog prices", () => {
  const data = sold(); data.products[0] = { ...p, name: "Changed", photoUri: "file:///new.jpg", cost: 1, price: 999999, wholesalePrice: undefined, deletedAt: stamp(20) };
  const before = JSON.stringify(data), report = selectProfitReport(data, range()); const line = report.events[0];
  assert.equal(line.name, "Rice"); assert.equal(line.photoUri, "file:///old.jpg"); assert.equal(line.unitPrice, 8000); assert.equal(line.unitCost, 5000);
  assert.equal(line.quantity, 2.5); assert.equal(report.revenue, 19499); assert.equal(report.cost, 12500); assert.equal(report.grossProfit, 6999);
  assert.equal(line.discount, 501); assert.equal(line.tax, data.invoices[0].tax); assert.equal(JSON.stringify(data), before);
});
test("retail and wholesale sales aggregate money and quantities once without counting invoice copies", () => {
  const data = sold(sold(), "i2", 20, "wholesale"); const report = selectProfitReport(data, range());
  assert.equal(report.rows.length, 1); assert.equal(report.rows[0].sold, 5); assert.equal(report.events.length, 2);
  assert.deepEqual(new Set(report.events.map((e) => e.unitPrice)), new Set([8000, 7000]));
  assert.equal(report.revenue, 19499 + 16999); assert.equal(report.cost, 25000);
});
test("same-day partial returns and expenses reconcile exactly with the dashboard", () => {
  let data = refund(sold(), 0.7, true); data = refund(data, 0.3, false, 20, "r2");
  data.expenses = [{ id: "e", name: "Transport", total: 175, createdAt: stamp(20) }];
  const report = selectProfitReport(data, range()), dashboard = selectDashboard(data, now);
  assert.equal(report.netProfit, dashboard.profit); assert.equal(report.revenue + report.events.reduce((n, e) => n + e.tax, 0), dashboard.sales);
  assert.equal(report.rows[0].sold, 2.5); assert.equal(report.rows[0].returned, 1); assert.equal(report.expenses, 175);
  assert.equal(report.events.find((e) => e.id.startsWith("return:r2:")).cost, 0);
});
test("returns of older sales appear on return day, including return-only losses", () => {
  const data = refund(sold(base(), "i1", 19), 2.5, false);
  const today = selectProfitReport(data, range()), yesterday = selectProfitReport(data, range(19));
  assert.equal(today.events.length, 1); assert.equal(today.events[0].returned, true); assert.equal(today.rows[0].sold, 0); assert.equal(today.rows[0].returned, 2.5);
  assert.equal(today.netProfit, -19499); assert.equal(today.netProfit, selectDashboard(data, now).profit);
  assert.equal(yesterday.grossProfit, 6999); assert.equal(profitMargin(today.netProfit, today.revenue), null);
});
test("full restocked return reverses original net revenue and cost exactly", () => {
  const report = selectProfitReport(refund(sold(), 2.5, true), range());
  assert.equal(report.revenue, 0); assert.equal(report.cost, 0); assert.equal(report.grossProfit, 0); assert.equal(profitMargin(0, 0), null);
});
test("legacy rows infer historical unit prices, preserve losses, and separate incompatible units", () => {
  const data = recordSale(base(), "rice", 0.5, "legacy", stamp(20));
  data.products[0].price = 99999;
  data.sales.push({ ...data.sales[0], id: "other-unit", unit: "piece", quantity: 1, total: 100, cost: 200 });
  const report = selectProfitReport(data, range()); assert.equal(report.rows.length, 2);
  const legacy = report.events.find((e) => e.saleId === "legacy"); assert.equal(legacy.unitPrice, 8000); assert.equal(legacy.unitCost, 5000);
  assert.equal(profitMargin(-100, 100), -100); assert.equal(profitMargin(250, 1000), 25);
});
test("local range boundaries, invalid dates, and expense-only days", () => {
  const data = sold(); data.sales.push({ ...data.sales[0], invoiceId: undefined, id: "midnight", createdAt: new Date(range().end).toISOString() });
  data.expenses = [{ id: "e", name: "Rent", total: 100, createdAt: stamp(21) }];
  assert.equal(selectProfitReport(data, range()).events.length, 1);
  assert.equal(selectProfitReport(data, null).events.length, 0); assert.equal(selectProfitReport(data, null).netProfit, 0);
  const expensesOnly = selectProfitReport({ ...base(), expenses: data.expenses }, range(21)); assert.equal(expensesOnly.netProfit, -100); assert.equal(expensesOnly.rows.length, 0);
});

test("full sale view includes every product in that invoice with original prices after returns", () => {
  let data = addProduct(base(), { ...p, id: "oil", name: "Oil", unit: "litre", unitGroup: "volume", photoUri: "file:///oil.jpg", price: 15000, cost: 11000 });
  data = addCartProduct(data, "rice", "multi", 0.5, "wholesale"); data = addCartProduct(data, "oil", "multi", 1);
  data = completeSale(data, "multi", { method: "cash", received: 50000, note: "", reference: "", createdAt: stamp(19) });
  const invoice = data.invoices[0]; const rice = invoice.items.find((i) => i.productId === "rice");
  data = returnSale(data, { id: "r", invoiceId: "multi", items: [{ lineId: rice.id, quantity: 0.5, restock: true }], method: "cash", note: "Returned", createdAt: stamp(20) });
  const detail = selectSaleProfit(data, rice.id);
  assert.equal(detail.events.length, 2); assert.equal(detail.revenue, invoice.total); assert.equal(detail.events.some((e) => e.returned), false);
  assert.equal(detail.events.find((e) => e.productId === "rice").unitPrice, 7000);
  assert.equal(detail.events.find((e) => e.productId === "oil").photoUri, "file:///oil.jpg");
  assert.equal(selectSaleProfit(data, "missing").events.length, 0);
  const history = selectProfitHistory(data, range(19));
  assert.equal(history.length, 1); assert.equal(history[0].total, invoice.total);
  assert.equal(history[0].profit, detail.grossProfit); assert.equal(history[0].names.length, 2);
  assert.equal(history[0].returnedTotal, data.saleReturns[0].total);
  assert.equal(selectProfitHistory(data, range()).length, 0);
});

test("profit history keeps separate sales of the same product and legacy transactions separate", () => {
  let data = sold(sold(), "i2", 20, "wholesale");
  data = recordSale(data, "rice", 1, "legacy", stamp(19));
  const before = JSON.stringify(data), rows = selectProfitHistory(data, range());
  assert.equal(rows.length, 2); assert.notEqual(rows[0].key, rows[1].key);
  for (const row of rows) {
    const detail = selectSaleProfit(data, row.saleId);
    assert.equal(row.profit, detail.grossProfit);
    assert.equal(row.total, detail.events.reduce((n, e) => n + e.revenue + e.tax, 0));
  }
  assert.equal(selectProfitHistory(data, range(19))[0].saleId, "legacy");
  assert.deepEqual(selectProfitHistory(data, null), []); assert.equal(JSON.stringify(data), before);
});
