import assert from "node:assert/strict";
import test from "node:test";
import { addProduct, emptyBusiness, parseBusiness } from "../src/store/business.ts";
import { addCartProduct, completeSale } from "../src/store/pos.ts";
import { completePurchase, receivePurchase, selectPurchaseSupplier, setPurchaseItem } from "../src/store/purchasing.ts";
import { cashTotals, closeCashDay, dayKey, invoiceDue, openCashDay, previewReturn, returnSale, settleBalance, supplierInvoiceDue } from "../src/store/finance.ts";
import { addProductBatch, sellableStock, validExpiryDate } from "../src/store/expiry.ts";
import { adjustStock, deleteProduct } from "../src/store/inventory.ts";
import { selectDashboard } from "../src/dashboard/selectors.ts";
const stamp = "2026-10-20T10:00:00Z", later = "2026-10-20T12:00:00Z";
const p = { id: "milk", name: "Milk", barcode: "", category: "Dairy", price: 8000, cost: 5000, stock: 20, unit: "piece", unitGroup: "count" };
const base = () => ({ ...addProduct(emptyBusiness, p), customers: [{ id: "c", name: "Customer", phone: "", balance: 0 }], suppliers: [{ id: "s", name: "Supplier", phone: "", address: "", balance: 0 }] });
function sale(data = base(), method = "cash", received = 16000, id = "sale1") { const cart = addCartProduct(data, "milk", id, 2); return completeSale({ ...cart, saleDraft: { ...cart.saleDraft, customerId: "c" } }, id, { method, received, note: "", reference: "", createdAt: stamp }); }
const pay = (id, amount, method = "cash") => ({ id, partyId: "c", amount, method, reference: "", note: "", createdAt: later });
const ret = (data, id = "r", quantity = 1, restock = true) => ({ id, invoiceId: data.invoices[0].id, items: [{ lineId: data.invoices[0].items[0].id, quantity, restock }], method: "cash", note: "Damaged packaging", createdAt: later });
const roundtrip = (data) => assert.deepEqual(parseBusiness(JSON.stringify(data)), JSON.parse(JSON.stringify(data)));
test("customer collections allocate oldest dues once and never exceed party balance", () => {
  const first = sale(base(), "due", 0); const data = sale(first, "due", 0, "sale2"); const input = pay("p", 20000);
  const result = settleBalance(data, "customer", input);
  assert.equal(result.customers[0].balance, 12000); assert.equal(invoiceDue(result, "sale1"), 0); assert.equal(invoiceDue(result, "sale2"), 12000);
  assert.deepEqual(result.customerCollections[0].allocations, [{ invoiceId: "sale1", amount: 16000 }, { invoiceId: "sale2", amount: 4000 }]);
  assert.equal(settleBalance(result, "customer", input), result);
  assert.throws(() => settleBalance(result, "customer", { ...input, amount: 100 }), /duplicateTransaction/);
  for (const amount of [0, -1, 12001, 1.1, Infinity]) assert.throws(() => settleBalance(result, "customer", pay("bad", amount)), /invalidTransaction/);
  assert.equal(data.customers[0].balance, 32000); roundtrip(result);
});
test("supplier payment preserves original purchase snapshot and allocates due", () => {
  const draft = setPurchaseItem(selectPurchaseSupplier(base(), "s", "buy"), "milk", 2, 5000);
  const data = completePurchase(draft, "buy", { paid: 1000, method: "cash", status: "received", reference: "", note: "", createdAt: stamp });
  const input = { ...pay("supplier-pay", 2000), partyId: "s" };
  const next = settleBalance(data, "supplier", input);
  assert.equal(next.suppliers[0].balance, 7000); assert.equal(supplierInvoiceDue(next, "buy"), 7000); assert.equal(next.purchaseInvoices[0].due, 9000); assert.equal(next.products[0].stock, 22); roundtrip(next);
  assert.equal(settleBalance(next, "supplier", input), next);
});
test("partial return reduces due first and refunds only the paid remainder", () => {
  const data = sale(base(), "due", 10000), before = JSON.stringify(data.invoices);
  const input = ret(data), next = returnSale(data, input);
  assert.equal(next.saleReturns[0].dueReduction, 6000); assert.equal(next.saleReturns[0].refund, 2000); assert.equal(next.customers[0].balance, 0);
  assert.equal(next.products[0].stock, 19); assert.equal(JSON.stringify(next.invoices), before); assert.equal(next.sales.length, 1); roundtrip(next);
  assert.equal(returnSale(next, input), next); assert.throws(() => returnSale(next, { ...input, note: "Changed" }), /duplicateTransaction/);
  const all = returnSale(next, ret(next, "r2")); assert.equal(all.products[0].stock, 20); assert.equal(all.saleReturns.reduce((n, r) => n + r.refund, 0), 10000); roundtrip(all);
  assert.throws(() => returnSale(all, ret(all, "r3")), /invalidReturn/);
});
test("collection before return is refunded without creating negative due", () => {
  const data = settleBalance(sale(base(), "due", 0), "customer", pay("collected", 16000));
  const next = returnSale(data, ret(data)); assert.equal(next.saleReturns[0].refund, 8000); assert.equal(next.saleReturns[0].dueReduction, 0); assert.equal(invoiceDue(next, "sale1"), 0); roundtrip(next);
});
test("fractional discounted returns allocate the final cent exactly", () => {
  const product = { ...p, stock: 3, price: 101, cost: 61, unit: "kg", unitGroup: "weight" };
  const cart = addCartProduct(addProduct(emptyBusiness, product), "milk", "fraction", 1);
  let data = completeSale({ ...cart, saleDraft: { ...cart.saleDraft, discount: { kind: "fixed", value: 1 }, taxRate: 500 } }, "fraction", { method: "cash", received: 105, reference: "", note: "", createdAt: stamp });
  for (let n = 0; n < 3; n++) data = returnSale(data, ret(data, `r${n}`, n === 2 ? 0.334 : 0.333));
  assert.equal(data.saleReturns.reduce((n, r) => n + r.refund, 0), 105); assert.equal(data.saleReturns.flatMap((r) => r.items).reduce((n, r) => n + r.cost, 0), 61); roundtrip(data);
});
test("damaged returns do not restore stock or reverse original product cost", () => {
  const data = sale(); const next = returnSale(data, ret(data, "r", 1, false));
  assert.equal(next.products[0].stock, 18); assert.equal(selectDashboard(next, new Date(stamp)).sales, 8000); assert.equal(selectDashboard(next, new Date(stamp)).profit, -2000); roundtrip(next);
  const removed = deleteProduct(data, "milk", later); assert.throws(() => returnSale(removed, ret(removed)), /cannotRestock/); roundtrip(returnSale(removed, ret(removed, "r", 1, false)));
});
test("cash counts only cash movement and closes with a documented discrepancy", () => {
  let data = openCashDay(base(), { id: "day", opening: 10000, createdAt: stamp });
  data = sale(data); data = { ...data, expenses: [{ id: "e", name: "Rent", total: 3000, createdAt: stamp }] };
  assert.equal(cashTotals(data, dayKey(stamp)).expected, 23000);
  assert.throws(() => closeCashDay(data, { day: dayKey(stamp), counted: 22000, note: "", createdAt: later }), /cashNoteRequired/);
  data = closeCashDay(data, { day: dayKey(stamp), counted: 22000, note: "Cash short", createdAt: later }); roundtrip(data);
  assert.throws(() => sale(data, "cash", 16000, "after-close"), /cashDayClosed/);
  const due = sale(data, "due", 0, "next-due"); assert.throws(() => settleBalance(due, "customer", pay("cash-after-close", 100)), /cashDayClosed/);
  assert.equal(settleBalance(due, "customer", pay("wallet-after-close", 100, "bkash")).customers[0].balance, 15900);
  assert.throws(() => returnSale(data, ret(data)), /cashDayClosed/);
  const bad = structuredClone(data); bad.cashDays[0].counted = 23000; bad.cashDays[0].expected = 23001; assert.throws(() => parseBusiness(JSON.stringify(bad)), /invalidData/);
});
test("malformed allocations, excess returns and corrupt cash history are rejected on restore", () => {
  const result = returnSale(settleBalance(sale(base(), "due", 0), "customer", pay("collect", 5000)), ret(sale(base(), "due", 0)));
  roundtrip(result);
  for (const corrupt of [(d) => d.customerCollections[0].allocations[0].amount = 999999, (d) => d.customerCollections[0].partyId = "missing", (d) => d.saleReturns[0].items[0].quantity = 3, (d) => d.saleReturns[0].refund += 1, (d) => d.saleReturns[0].items[0].cost = 99999]) { const bad = structuredClone(result); corrupt(bad); assert.throws(() => parseBusiness(JSON.stringify(bad)), /invalidData/); }
});
const batch = (id, expiryDate, quantity) => ({ id, productId: "milk", batchNumber: id, expiryDate, quantity, createdAt: stamp });
test("strict calendar dates and untracked stock prevent overassigning batches", () => {
  assert.equal(validExpiryDate("2026-02-30"), false); assert.equal(validExpiryDate("2028-02-29"), true);
  const data = addProductBatch(base(), batch("b", "2026-10-19", 5)); assert.equal(data.products[0].stock, 20);
  assert.equal(sellableStock(data, "milk", stamp), 15); assert.equal(sellableStock({ ...data, blockExpiredSales: false }, "milk", stamp), 20);
  assert.throws(() => addProductBatch(data, batch("big", "2027-01-01", 16)), /invalidBatch/); roundtrip(data);
});
test("sale consumes FEFO and never consumes expired batches when blocked", () => {
  let data = addProductBatch(base(), batch("expired", "2026-10-19", 5)); data = addProductBatch(data, batch("later", "2027-01-01", 5)); data = addProductBatch(data, batch("today", "2026-10-20", 1));
  const next = sale(data); assert.deepEqual(next.invoices[0].items[0].batchAllocations, [{ batchId: "today", quantity: 1 }, { batchId: "later", quantity: 1 }]);
  assert.equal(next.productBatches.find((b) => b.id === "expired").quantity, 5); assert.equal(next.productBatches.find((b) => b.id === "later").quantity, 4); roundtrip(next);
  const cart = addCartProduct(data, "milk", "too-many", 16); assert.throws(() => completeSale(cart, "too-many", { method: "cash", received: 128000, note: "", reference: "", createdAt: stamp }), /expiredStock/);
  assert.equal(data.products[0].stock, 20);
});
test("returns restore original batches; damaged returns do not restore them", () => {
  const data = sale(addProductBatch(base(), batch("b", "2026-10-20", 4)));
  const returned = returnSale(data, ret(data)); assert.equal(returned.productBatches[0].quantity, 3); roundtrip(returned);
  const damaged = returnSale(returned, ret(returned, "r2", 1, false)); assert.equal(damaged.productBatches[0].quantity, 3); roundtrip(damaged);
  const bad = structuredClone(returned); bad.saleReturns[0].items[0].batchReturns[0].quantity = 2; assert.throws(() => parseBusiness(JSON.stringify(bad)), /invalidData/);
});
test("stock reductions consume batch quantities without leaving phantom expired stock", () => {
  const data = addProductBatch(base(), batch("b", "2026-10-19", 18));
  const next = adjustStock(data, { id: "adjust", productId: "milk", kind: "set", quantity: 1, reason: "Counted", notes: "", createdAt: later });
  assert.equal(next.productBatches[0].quantity, 0); assert.equal(next.products[0].stock, 1); roundtrip(next);
});
test("pending purchases create expiry batches exactly once on receipt", () => {
  const draft = setPurchaseItem(selectPurchaseSupplier(base(), "s", "buy-batch"), "milk", 3, 5000, { batchNumber: "LOT-1", expiryDate: "2027-01-01" });
  const pending = completePurchase(draft, "buy-batch", { paid: 0, method: "cash", status: "pending", reference: "", note: "", createdAt: stamp });
  assert.equal(pending.productBatches, undefined); assert.equal(pending.products[0].stock, 20);
  const received = receivePurchase(pending, "buy-batch", later); assert.equal(received.productBatches[0].quantity, 3); assert.equal(received.products[0].stock, 23); roundtrip(received);
  assert.equal(receivePurchase(received, "buy-batch", later), received);
  assert.throws(() => setPurchaseItem(draft, "milk", 1, 5000, { expiryDate: "2026-02-30", batchNumber: "bad" }), /invalidBatch/);
});
