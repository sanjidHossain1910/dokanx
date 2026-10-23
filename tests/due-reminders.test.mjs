import assert from "node:assert/strict";
import test from "node:test";
import { addProduct, emptyBusiness, parseBusiness } from "../src/store/business.ts";
import { addCartProduct, completeSale } from "../src/store/pos.ts";
import { dayKey, returnSale, settleBalance } from "../src/store/finance.ts";
import { desiredDueNotifications, DUE_NOTIFICATION_PREFIX, selectDuePlans, setDuePlan, validDueDate } from "../src/store/dueReminders.ts";
import { reconcileReminders } from "../src/reminders/reconcile.ts";
import { decodeBackup, encodeBackup } from "../src/store/backupFormat.ts";

const now = new Date(2026, 9, 20, 14), tomorrow = "2026-10-21";
function draft(id = "sale") {
  let data = addProduct({ ...emptyBusiness, customers: [{ id: "c", name: "Customer", phone: "01712345678", balance: 0 }] }, { id: "p", name: "Rice", barcode: "", category: "", stock: 10, unit: "kg", price: 10000, cost: 5000 });
  data = addCartProduct(data, "p", id, 2);
  return { ...data, saleDraft: { ...data.saleDraft, customerId: "c" } };
}
function sale(plan) { return completeSale(draft(), "sale", { method: "due", received: 0, note: "", reference: "", createdAt: now.toISOString(), ...(plan ? { duePlan: plan } : {}) }); }
function collect(data, amount, id) { return settleBalance(data, "customer", { id, partyId: "c", amount, method: "cash", note: "", reference: "", createdAt: new Date(now.getTime()+60000).toISOString() }); }

test("follow-ups default to absent and optional dates do not change financial snapshots", () => {
  const plain = sale(), planned = sale({ dueDate: tomorrow, remind: false });
  assert.equal(plain.dueReminders, undefined);
  assert.deepEqual(planned.invoices, plain.invoices);
  assert.deepEqual(planned.payments, plain.payments);
  assert.deepEqual(planned.customers, plain.customers);
  assert.equal(planned.dueReminders[0].notifyAt, undefined);
  assert.equal(desiredDueNotifications(planned, now.getTime()).length, 0);
  assert.deepEqual(parseBusiness(JSON.stringify(planned)).dueReminders, planned.dueReminders);
});
test("validates actual calendar dates, past dates and paid invoices atomically", () => {
  assert.equal(validDueDate("2028-02-29"), true);
  for (const date of ["2026-02-29", "2026-13-01", "2026-04-31", "2026-1-01", "1900-01-01", "2200-01-01", null]) assert.equal(validDueDate(date), false);
  const data = draft(), before = JSON.stringify(data);
  assert.throws(() => completeSale(data, "sale", { method: "due", received: 0, note: "", reference: "", createdAt: now.toISOString(), duePlan: { dueDate: "2026-10-19", remind: true } }), /invalidDuePlan/);
  assert.equal(JSON.stringify(data), before);
  assert.throws(() => completeSale(data, "sale", { method: "cash", received: 20000, note: "", reference: "", createdAt: now.toISOString(), duePlan: { dueDate: tomorrow, remind: true } }), /invalidDuePlan/);
});
test("schedules 9 AM local time, today after 9 shortly, and does not rearm unchanged dates", () => {
  const data = sale({ dueDate: tomorrow, remind: true });
  assert.equal(data.dueReminders[0].notifyAt, new Date(2026,9,21,9).toISOString());
  const today = setDuePlan(sale(), "sale", { dueDate: dayKey(now), remind: true }, now);
  assert.equal(Date.parse(today.dueReminders[0].notifyAt), now.getTime()+30000);
  assert.equal(setDuePlan(today, "sale", { dueDate: dayKey(now), remind: true }, new Date(now.getTime()+60000)), today);
  const desired = desiredDueNotifications(data, now.getTime());
  assert.equal(desired.length, 1);
  assert.equal(desiredDueNotifications(data, new Date(2026,9,22).getTime()).length, 0);
  assert.deepEqual(desiredDueNotifications(data, now.getTime()), desired);
});
test("remaining due follows FIFO partial collections, full settlement and product returns", () => {
  let data = sale({ dueDate: tomorrow, remind: true });
  const initial = desiredDueNotifications(data, now.getTime());
  data = collect(data, 5000, "part");
  assert.equal(selectDuePlans(data, now)[0].due, 15000);
  assert.deepEqual(desiredDueNotifications(data, now.getTime()), initial);
  const returned = returnSale(data, { id: "r", invoiceId: "sale", items: [{ lineId: "sale-0", quantity: 1.5, restock: true }], method: "cash", note: "Return", createdAt: now.toISOString() });
  assert.equal(selectDuePlans(returned, now).length, 0);
  assert.equal(desiredDueNotifications(returned, now.getTime()).length, 0);
  data = collect(data, 15000, "full");
  assert.equal(selectDuePlans(data, now).length, 0);
  assert.equal(desiredDueNotifications(data, now.getTime()).length, 0);
  assert.doesNotThrow(() => parseBusiness(JSON.stringify(data)));
});
test("today, overdue and upcoming statuses use local dates, with explicit edit/removal", () => {
  const data = sale({ dueDate: tomorrow, remind: true });
  assert.equal(selectDuePlans(data, now)[0].status, "upcoming");
  assert.equal(selectDuePlans(data, new Date(2026,9,21,22))[0].status, "today");
  assert.equal(selectDuePlans(data, new Date(2026,9,22,0))[0].status, "overdue");
  const edited = setDuePlan(data, "sale", { dueDate: "2026-10-22", remind: false }, now);
  assert.equal(edited.dueReminders[0].notifyAt, undefined);
  assert.deepEqual(setDuePlan(edited, "sale", undefined, now).dueReminders, []);
});
test("backup transfers valid plan metadata, rejects malformed and orphan references", () => {
  const data = sale({ dueDate: tomorrow, remind: true });
  const bytes = encodeBackup({ format: "DokanX", version: 1, createdAt: now.toISOString(), data, assets: [] }, {});
  assert.deepEqual(decodeBackup(bytes).manifest.data.dueReminders, data.dueReminders);
  for (const bad of [null, {}, [{ ...data.dueReminders[0], invoiceId: "missing" }], [data.dueReminders[0], data.dueReminders[0]], [{ ...data.dueReminders[0], remind: "yes" }], [{ ...data.dueReminders[0], notifyAt: "invalid" }], [{ ...data.dueReminders[0], dueDate: "2026-02-30" }]]) {
    assert.throws(() => parseBusiness(JSON.stringify({ ...data, dueReminders: bad })), /invalidData/);
  }
});
function fake() {
  const state = { pending: new Set(), delivered: new Set(), receipts: [], scheduled: [], cancelled: [], dismissed: [] };
  return { state, adapter: {
    pending: async () => [...state.pending], delivered: async () => [...state.delivered],
    cancel: async (id) => { state.pending.delete(id); state.cancelled.push(id); },
    dismiss: async (id) => { state.delivered.delete(id); state.dismissed.push(id); },
    schedule: async (r) => { state.pending.add(r.id); state.scheduled.push(r.id); },
    readReceipts: async () => [...state.receipts], writeReceipts: async (ids) => { state.receipts = ids; },
  } };
}
test("native reconciliation schedules once across reload, delivery, foreground and backup restore", async () => {
  const { state, adapter } = fake(), desired = desiredDueNotifications(sale({ dueDate: tomorrow, remind: true }), now.getTime());
  const ids = desired.map((r) => r.id);
  await reconcileReminders(adapter, desired, ids, now.getTime());
  await reconcileReminders(adapter, desired, ids, now.getTime());
  assert.equal(state.scheduled.length, 1);
  state.pending.clear(); state.delivered.add(ids[0]);
  await reconcileReminders(adapter, desired, ids, now.getTime());
  assert.equal(state.scheduled.length, 1);
  await reconcileReminders(adapter, [], [], now.getTime());
  assert.deepEqual(state.dismissed, ids);
});
test("date changes, disabling, full payment and restore remove only DokanX due notifications", async () => {
  const { state, adapter } = fake(); state.pending.add("other-app-feature");
  const desired = desiredDueNotifications(sale({ dueDate: tomorrow, remind: true }), now.getTime());
  await reconcileReminders(adapter, desired, desired.map((r) => r.id), now.getTime());
  await reconcileReminders(adapter, [], [], now.getTime());
  assert.deepEqual([...state.pending], ["other-app-feature"]);
  assert.deepEqual(state.cancelled, desired.map((r) => r.id));
  assert.deepEqual(state.receipts, []);
});
test("interrupted receipt writes recover from deterministic pending IDs; failed scheduling can retry", async () => {
  const { state, adapter } = fake(), desired = [{ id: `${DUE_NOTIFICATION_PREFIX}one-${now.getTime()+60000}`, at: now.getTime()+60000 }], ids = desired.map((r) => r.id);
  const failing = { ...adapter, writeReceipts: async () => { throw new Error("disk"); } };
  await assert.rejects(reconcileReminders(failing, desired, ids, now.getTime()));
  await reconcileReminders(adapter, desired, ids, now.getTime());
  assert.equal(state.scheduled.length, 1);
  const next = { id: `${DUE_NOTIFICATION_PREFIX}two-${now.getTime()+70000}`, at: now.getTime()+70000 };
  await assert.rejects(reconcileReminders({ ...adapter, schedule: async () => { throw new Error("native"); } }, [next], [next.id], now.getTime()));
  await reconcileReminders(adapter, [next], [next.id], now.getTime());
  assert.ok(state.pending.has(next.id));
});
test("keeps a bounded nearest queue and reports that remaining requests need later scheduling", async () => {
  const { state, adapter } = fake();
  const desired = Array.from({ length: 65 }, (_, i) => ({ id: `${DUE_NOTIFICATION_PREFIX}${i}-${now.getTime()+10000+i}`, at: now.getTime()+10000+i }));
  const ids = desired.map((r) => r.id);
  assert.equal(await reconcileReminders(adapter, desired, ids, now.getTime()), "limited");
  assert.equal(state.pending.size, 60);
  for (const r of desired.slice(0,5)) state.pending.delete(r.id);
  await reconcileReminders(adapter, desired, ids, now.getTime());
  assert.equal(state.pending.size, 60);
  assert.equal(state.scheduled.length, 65);
});
