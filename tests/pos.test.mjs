import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { addProduct, emptyBusiness, parseBusiness, recordSale } from "../src/store/business.ts";
import { addCartProduct, allocateAmount, cartTotals, changeCartQuantity, completeSale, quickAmounts } from "../src/store/pos.ts";
import { createSQLiteRepository } from "../src/store/sqliteRepository.ts";
import { selectDashboard } from "../src/dashboard/selectors.ts";
import { receiptHTML } from "../src/store/receipt.ts";
import { historyRange, localDateInput } from "../src/store/salesHistory.ts";
import { emptyPaymentSettings, validPaymentSettings, walletPhone } from "../src/store/paymentSettings.ts";
const stamp = "2026-10-20T10:00:00.000Z";
const p = { id: "rice", name: "Rice", barcode: "1234", category: "Food", price: 9000, cost: 7000, stock: 10.5, unit: "kg", unitGroup: "weight" };
const cash = { method: "cash", received: 10000, note: "", reference: "", createdAt: stamp };
const basket = () => addCartProduct(addProduct(emptyBusiness, p), p.id, "draft-unique");
const persisted = (data) => JSON.parse(JSON.stringify(data));

test("cash shortcuts offer only fixed denominations that cover the bill", () => {
  assert.deepEqual(quickAmounts(100), [5000, 10000, 50000, 100000]);
  assert.deepEqual(quickAmounts(7600), [10000, 50000, 100000]);
  assert.deepEqual(quickAmounts(10000), [10000, 50000, 100000]);
  assert.deepEqual(quickAmounts(10001), [50000, 100000]);
  assert.deepEqual(quickAmounts(100000), [100000]);
  assert.deepEqual(quickAmounts(100001), []);
  assert.deepEqual(quickAmounts(NaN), []);
});

test("bulk adds accept unit-aware quantities and reject invalid or excess additions atomically", () => {
  const base = addProduct(emptyBusiness, p);
  const first = addCartProduct(base, p.id, "bulk", 2.5);
  const next = addCartProduct(first, p.id, "ignored", 3.125);
  assert.equal(next.saleDraft.lines[0].quantity, 5.625);
  assert.equal(next.saleDraft.id, "bulk");
  assert.equal(next.products[0].stock, 10.5);
  assert.throws(() => addCartProduct(next, p.id, "unused", 5), /stockUnavailable/);
  for (const amount of [0, -1, NaN, Infinity, 0.0001]) assert.throws(() => addCartProduct(base, p.id, "bulk", amount), /invalidQuantity/);
  const pieces = addProduct(emptyBusiness, { ...p, unit: "piece", unitGroup: "count", stock: 20 });
  assert.equal(addCartProduct(pieces, p.id, "pieces", 12).saleDraft.lines[0].quantity, 12);
  assert.throws(() => addCartProduct(pieces, p.id, "pieces", 1.5), /invalidQuantity/);
  assert.deepEqual(parseBusiness(JSON.stringify(next)), next);
});

test("wallet configuration persists and checkout requires an enabled complete account", () => {
  assert.equal(walletPhone("+৮৮ ০১৭১২৩৪৫৬৭৮"), "01712345678");
  assert.equal(validPaymentSettings(emptyPaymentSettings), true);
  const enabled = { enabled: true, phone: "01712345678", qrUri: "file:///payment-qr/a.png" };
  const settings = { bkash: enabled, nagad: { ...enabled, phone: "01812345678" } };
  assert.equal(validPaymentSettings(settings), true);
  assert.equal(validPaymentSettings({ ...settings, bkash: { enabled: true, phone: enabled.phone, accountName: "Rahim" } }), true);
  for (const account of [{ ...enabled, phone: "123" }, { ...enabled, accountName: 123 }, { ...enabled, qrUri: "https://example.com/qr.png" }]) {
    assert.throws(() => parseBusiness(JSON.stringify({ ...emptyBusiness, paymentSettings: { ...settings, bkash: account } })), /invalidData/);
  }
  const data = basket();
  for (const method of ["bkash", "nagad"]) {
    const input = { ...cash, method, received: 9000 };
    assert.throws(() => completeSale(data, data.saleDraft.id, input), /walletUnavailable/);
    const configured = parseBusiness(JSON.stringify({ ...data, paymentSettings: settings }));
    const saved = completeSale(configured, data.saleDraft.id, input);
    assert.equal(saved.invoices[0].method, method);
    assert.equal(saved.payments[0].verified, false);
    assert.deepEqual(parseBusiness(JSON.stringify(saved)), persisted(saved));
    const disabled = { ...configured, paymentSettings: { ...settings, [method]: { ...enabled, enabled: false } } };
    assert.throws(() => completeSale(disabled, data.saleDraft.id, input), /walletUnavailable/);
    assert.equal(parseBusiness(JSON.stringify(saved)).invoices[0].method, method);
  }
});

test("cart quantities honor stock and fractional units; drafts persist without reducing inventory", () => {
  let data = basket();
  data = changeCartQuantity(data, data.saleDraft.id, p.id, 0.25);
  assert.equal(cartTotals(data.saleDraft).total, 2250);
  assert.equal(data.products[0].stock, 10.5);
  assert.deepEqual(parseBusiness(JSON.stringify(data)), data);
  assert.throws(() => changeCartQuantity(data, data.saleDraft.id, p.id, 10.501), /stockUnavailable/);
  const few = { ...data, products: [{ ...p, stock: 1.25 }], saleDraft: undefined };
  const one = addCartProduct(few, p.id, "f");
  assert.equal(addCartProduct(one, p.id, "f").saleDraft.lines[0].quantity, 1.25);
  assert.throws(() => addCartProduct(addCartProduct(one, p.id, "f"), p.id, "f"), /stockUnavailable/);
});
test("fixed and percentage discounts and tax use exact minor units", () => {
  let data = basket();
  data = addCartProduct(addProduct(data, { ...p, id: "oil", name: "Oil", barcode: "", price: 13000, unit: "litre", unitGroup: "volume" }), "oil", "unused");
  const draft = { ...data.saleDraft, discount: { kind: "percent", value: 1000 }, taxRate: 500 };
  assert.deepEqual(cartTotals(draft), { lines: [9000, 13000], subtotal: 22000, discount: 2200, tax: 990, total: 20790 });
  assert.throws(() => cartTotals({ ...draft, discount: { kind: "fixed", value: 22001 } }), /invalidDiscount/);
  assert.throws(() => cartTotals({ ...draft, taxRate: 10001 }), /invalidCart/);
  const allocated = allocateAmount(99, Array(100).fill(1));
  assert.equal(allocated.reduce((n, v) => n + v, 0), 99);
  assert.ok(allocated.every((n) => n === 0 || n === 1));
});
test("cash checkout creates a complete invoice, line records, payment and stock history once", () => {
  const data = basket();
  const after = completeSale(data, data.saleDraft.id, cash);
  assert.equal(after.products[0].stock, 9.5);
  assert.equal(after.invoices[0].total, 9000);
  assert.equal(after.invoices[0].change, 1000);
  assert.equal(after.payments[0].verified, false);
  assert.equal(after.sales[0].cost, 7000);
  assert.equal(after.stockMovements[0].saleId, after.invoices[0].id);
  assert.equal(data.products[0].stock, 10.5);
  assert.equal(after.saleDraft, undefined);
  assert.strictEqual(completeSale(after, data.saleDraft.id, cash), after);
  assert.deepEqual(parseBusiness(JSON.stringify(after)), persisted(after));
});
test("due sales require a customer and update full or partial outstanding balance", () => {
  let data = basket();
  assert.throws(() => completeSale(data, data.saleDraft.id, { ...cash, method: "due", received: 0 }), /customerRequired/);
  data = { ...data, customers: [{ id: "c", name: "Rahim", phone: "", balance: 500 }], saleDraft: { ...data.saleDraft, customerId: "c" } };
  const partial = completeSale(data, data.saleDraft.id, { ...cash, method: "due", received: 2000 });
  assert.equal(partial.invoices[0].amountDue, 7000);
  assert.equal(partial.invoices[0].status, "partial");
  assert.equal(partial.customers[0].balance, 7500);
  const full = completeSale(data, data.saleDraft.id, { ...cash, method: "due", received: 0 });
  assert.equal(full.invoices[0].status, "due");
  assert.equal(full.customers[0].balance, 9500);
  assert.deepEqual(parseBusiness(JSON.stringify(partial)), persisted(partial));
});
test("insufficient payments, stale stock and unit changes cannot partially mutate a sale", () => {
  const data = basket();
  assert.throws(() => completeSale(data, data.saleDraft.id, { ...cash, received: 8999 }), /invalidPayment/);
  assert.throws(() => completeSale(data, data.saleDraft.id, { ...cash, method: "card", received: 10000 }), /invalidPayment/);
  const stale = recordSale({ ...data, products: [{ ...p, stock: 1 }] }, p.id, 1, "other", stamp);
  assert.throws(() => completeSale(stale, data.saleDraft.id, cash), /stockUnavailable/);
  assert.equal(stale.invoices, undefined);
  assert.equal(stale.products[0].stock, 0);
  const changed = { ...data, products: [{ ...p, unit: "g" }] };
  assert.throws(() => completeSale(changed, data.saleDraft.id, cash), /stockUnavailable/);
  const digital = completeSale({ ...data, paymentSettings: { ...emptyPaymentSettings, bkash: { enabled: true, phone: "01712345678", qrUri: "file:///payment-qr/test.png" } } }, data.saleDraft.id, { ...cash, method: "bkash", received: 9000, reference: "Manual-123" });
  assert.equal(digital.payments[0].verified, false);
  assert.equal(digital.invoices[0].change, 0);
});
test("historical names and selling prices stay frozen; cost is captured at checkout and tax is not profit", () => {
  const data = basket();
  const draft = { ...data.saleDraft, discount: { kind: "fixed", value: 1000 }, taxRate: 1000 };
  const after = completeSale({ ...data, saleDraft: draft, products: [{ ...p, name: "New name", price: 9900, cost: 6000 }] }, draft.id, { ...cash, received: 8800 });
  const invoice = after.invoices[0];
  assert.equal(invoice.items[0].name, "Rice");
  assert.equal(invoice.subtotal, 9000);
  assert.equal(invoice.total, 8800);
  assert.equal(invoice.items[0].unitCost, 6000);
  assert.equal(selectDashboard(after, new Date(stamp)).profit, 2000);
  assert.deepEqual(parseBusiness(JSON.stringify(after)), persisted(after));
});
test("corrupt or orphan invoice records are rejected; earlier single-product sales still load", () => {
  const data = basket(), after = completeSale(data, data.saleDraft.id, cash);
  for (const changes of [{ payments: [] }, { stockMovements: [] }, { invoices: [{ ...after.invoices[0], total: -1 }] }, { invoices: [after.invoices[0], after.invoices[0]] }, { saleDraft: { ...data.saleDraft, taxRate: -1 } }]) assert.throws(() => parseBusiness(JSON.stringify({ ...after, ...changes })), /invalidData/);
  const legacy = recordSale(addProduct(emptyBusiness, p), p.id, 0.5, "old", stamp);
  assert.deepEqual(parseBusiness(JSON.stringify(legacy)), legacy);
});
test("SQLite commits every sale record together and rolls back an aborted database write", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const original = basket();
    const adapter = { execAsync: async (sql) => db.exec(sql), runAsync: async (sql, ...args) => db.prepare(sql).run(...args), getFirstAsync: async (sql) => db.prepare(sql).get() ?? null };
    const repo = createSQLiteRepository(async () => adapter, async () => JSON.stringify(original));
    await repo.read();
    const next = completeSale(original, original.saleDraft.id, cash);
    db.exec("CREATE TRIGGER fail_commit BEFORE UPDATE ON business_state BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END;");
    await assert.rejects(repo.write(next));
    assert.deepEqual(await repo.read(), original);
    db.exec("DROP TRIGGER fail_commit;");
    await repo.write(next);
    const restored = await repo.read();
    assert.equal(restored.invoices.length, 1);
    assert.equal(restored.products[0].stock, 9.5);
    assert.equal(restored.payments.length, 1);
    assert.equal(restored.saleDraft, undefined);
  } finally { db.close(); }
});
test("receipt documents escape user text and history dates honor real calendar boundaries", () => {
  const data = basket(), after = completeSale(data, data.saleDraft.id, cash);
  const invoice = { ...after.invoices[0], shopName: '<script>alert("x")</script>', note: "<img src=x onerror=alert(1)>" };
  const html = receiptHTML(invoice, "en", (key) => key);
  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.equal(html.includes("<script>"), false);
  assert.equal(localDateInput("2026-02-30"), null);
  const custom = historyRange("customDate", new Date(), "2026-10-01", "2026-10-20");
  assert.equal(new Date(custom.end).getDate(), 21);
  assert.equal(historyRange("customDate", new Date(), "2026-10-21", "2026-10-20"), null);
});
