import type { BusinessData } from "./business.ts";
import { quantityTicks, validQuantity } from "./productUnits.ts";
import type { BatchAllocation } from "./expiry.ts";

export type MoneyMethod = "cash" | "bkash" | "nagad";
export type Settlement = { id: string; partyId: string; amount: number; method: MoneyMethod; reference: string; note: string; createdAt: string; allocations: { invoiceId: string; amount: number }[] };
export type ReturnItem = { lineId: string; quantity: number; amount: number; cost: number; tax: number; restock: boolean; batchReturns?: BatchAllocation[] };
export type SaleReturn = { id: string; invoiceId: string; items: ReturnItem[]; total: number; refund: number; dueReduction: number; method: MoneyMethod; note: string; createdAt: string };
export type CashDay = { id: string; day: string; opening: number; openedAt: string; closedAt?: string; counted?: number; expected?: number; note: string };
const money = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
const date = (s: unknown): s is string => typeof s === "string" && Number.isFinite(Date.parse(s));
const text = (s: unknown): s is string => typeof s === "string";
const id = (s: unknown): s is string => text(s) && !!s.trim();
const method = (s: unknown): s is MoneyMethod => s === "cash" || s === "bkash" || s === "nagad";
export function dayKey(value: string | Date) { const d = value instanceof Date ? value : new Date(value); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
export function assertCashOpen(data: BusinessData, stamp: string) {
  if (!date(stamp)) throw new Error("invalidTransaction");
  if (data.cashDays?.some((d) => d.day === dayKey(stamp) && d.closedAt)) throw new Error("cashDayClosed");
}
export function invoiceDue(data: BusinessData, invoiceId: string) {
  const invoice = data.invoices?.find((i) => i.id === invoiceId);
  if (!invoice) return 0;
  return invoice.amountDue - (data.customerCollections ?? []).reduce((n, p) => n + p.allocations.filter((a) => a.invoiceId === invoiceId).reduce((s, a) => s + a.amount, 0), 0) - (data.saleReturns ?? []).filter((r) => r.invoiceId === invoiceId).reduce((n, r) => n + r.dueReduction, 0);
}
export function supplierInvoiceDue(data: BusinessData, invoiceId: string) {
  return (data.purchaseInvoices?.find((i) => i.id === invoiceId)?.due ?? 0) - (data.supplierPayments ?? []).reduce((n, p) => n + p.allocations.filter((a) => a.invoiceId === invoiceId).reduce((s, a) => s + a.amount, 0), 0);
}
export function settleBalance(data: BusinessData, kind: "customer" | "supplier", input: Omit<Settlement, "allocations">): BusinessData {
  const records = kind === "customer" ? data.customerCollections ?? [] : data.supplierPayments ?? [];
  const existing = records.find((p) => p.id === input.id);
  if (existing) {
    if (["partyId", "amount", "method", "reference", "note", "createdAt"].some((key) => existing[key as keyof typeof input] !== input[key as keyof typeof input])) throw new Error("duplicateTransaction");
    return data;
  }
  const party = kind === "customer" ? data.customers?.find((p) => p.id === input.partyId) : data.suppliers?.find((p) => p.id === input.partyId);
  if (!id(input.id) || !party || !money(input.amount) || !input.amount || input.amount > (party.balance ?? 0) || !method(input.method) || !date(input.createdAt) || !text(input.note) || !text(input.reference)) throw new Error("invalidTransaction");
  if (input.method === "cash") assertCashOpen(data, input.createdAt);
  const invoices = kind === "customer" ? (data.invoices ?? []).filter((i) => i.customerId === party.id) : (data.purchaseInvoices ?? []).filter((i) => i.supplierId === party.id);
  let remaining = input.amount;
  const allocations: Settlement["allocations"] = [];
  for (const invoice of [...invoices].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id))) {
    const due = kind === "customer" ? invoiceDue(data, invoice.id) : supplierInvoiceDue(data, invoice.id);
    const amount = Math.min(remaining, due);
    if (amount > 0) { allocations.push({ invoiceId: invoice.id, amount }); remaining -= amount; }
  }
  const saved: Settlement = { ...input, allocations };
  return kind === "customer" ? { ...data, customerCollections: [...records, saved], customers: data.customers!.map((p) => p.id === party.id ? { ...p, balance: (p.balance ?? 0) - input.amount } : p) } : { ...data, supplierPayments: [...records, saved], suppliers: data.suppliers!.map((p) => p.id === party.id ? { ...p, balance: p.balance - input.amount } : p) };
}
function share(total: number, ticks: number, all: number) { return Number((BigInt(total) * BigInt(ticks) + BigInt(all) / 2n) / BigInt(all)); }
export function previewReturn(data: BusinessData, invoiceId: string, items: { lineId: string; quantity: number; restock: boolean }[]) {
  const invoice = data.invoices?.find((i) => i.id === invoiceId);
  if (!invoice || !items.length || new Set(items.map((i) => i.lineId)).size !== items.length) throw new Error("invalidReturn");
  const previous = (data.saleReturns ?? []).filter((r) => r.invoiceId === invoiceId);
  const rows: ReturnItem[] = items.map((input) => {
    const line = invoice.items.find((l) => l.id === input.lineId);
    if (!line || !validQuantity(input.quantity, line.unit, false) || typeof input.restock !== "boolean") throw new Error("invalidReturn");
    const returned = previous.flatMap((r) => r.items).filter((l) => l.lineId === line.id);
    const before = returned.reduce((n, l) => n + quantityTicks(l.quantity)!, 0), after = before + quantityTicks(input.quantity)!, all = quantityTicks(line.quantity)!;
    if (after > all) throw new Error("invalidReturn");
    let offset = 0;
    const batchReturns: BatchAllocation[] = [];
    for (const allocation of line.batchAllocations ?? []) {
      const end = offset + quantityTicks(allocation.quantity)!;
      const ticks = Math.max(0, Math.min(after, end) - Math.max(before, offset));
      if (input.restock && ticks) batchReturns.push({ batchId: allocation.batchId, quantity: ticks / 1000 });
      offset = end;
    }
    return { ...input, amount: share(line.lineTotal, after, all) - returned.reduce((n, l) => n + l.amount, 0), cost: share(line.cost, after, all) - returned.reduce((n, l) => n + l.cost, 0), tax: share(line.tax, after, all) - returned.reduce((n, l) => n + l.tax, 0), ...(batchReturns.length ? { batchReturns } : {}) };
  });
  const total = rows.reduce((n, r) => n + r.amount, 0), dueReduction = Math.min(total, invoiceDue(data, invoiceId));
  return { items: rows, total, dueReduction, refund: total - dueReduction };
}
export function returnSale(data: BusinessData, input: { id: string; invoiceId: string; items: { lineId: string; quantity: number; restock: boolean }[]; method: MoneyMethod; note: string; createdAt: string }): BusinessData {
  const existing = data.saleReturns?.find((r) => r.id === input.id);
  if (existing) {
    if (existing.invoiceId !== input.invoiceId || existing.method !== input.method || existing.note !== input.note || existing.createdAt !== input.createdAt || JSON.stringify(existing.items.map(({ lineId, quantity, restock }) => ({ lineId, quantity, restock }))) !== JSON.stringify(input.items)) throw new Error("duplicateTransaction");
    return data;
  }
  if (!id(input.id) || !method(input.method) || !date(input.createdAt) || !text(input.note) || !input.note.trim()) throw new Error("invalidReturn");
  const result = previewReturn(data, input.invoiceId, input.items);
  const invoice = data.invoices!.find((i) => i.id === input.invoiceId)!;
  if (result.refund && input.method === "cash") assertCashOpen(data, input.createdAt);
  const changes: { productId: string; before: number; after: number; quantity: number }[] = [];
  const products = data.products.map((p) => {
    const line = invoice.items.find((l) => l.productId === p.id), item = result.items.find((r) => r.lineId === line?.id && r.restock);
    if (!item || !line) return p;
    if (p.deletedAt || (p.unit ?? "piece") !== line.unit) throw new Error("cannotRestock");
    const ticks = quantityTicks(p.stock)! + quantityTicks(item.quantity)!;
    if (!Number.isSafeInteger(ticks)) throw new Error("invalidReturn");
    const weighted = (BigInt(quantityTicks(p.stock)!) * BigInt(p.cost) + BigInt(item.cost) * 1000n + BigInt(ticks) / 2n) / BigInt(ticks);
    if (weighted > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("invalidReturn");
    const cost = Number(weighted);
    changes.push({ productId: p.id, before: p.stock, after: ticks / 1000, quantity: item.quantity });
    return { ...p, stock: ticks / 1000, cost, updatedAt: input.createdAt };
  });
  const customer = data.customers?.find((p) => p.id === invoice.customerId);
  if (result.dueReduction && (!customer || (customer.balance ?? 0) < result.dueReduction)) throw new Error("invalidReturn");
  const productBatches = data.productBatches?.map((b) => ({ ...b, quantity: (quantityTicks(b.quantity)! + result.items.flatMap((i) => i.batchReturns ?? []).filter((a) => a.batchId === b.id).reduce((n, a) => n + quantityTicks(a.quantity)!, 0)) / 1000 }));
  return { ...data, products, productBatches, customers: data.customers?.map((p) => p.id === customer?.id ? { ...p, balance: (p.balance ?? 0) - result.dueReduction } : p), saleReturns: [...(data.saleReturns ?? []), { ...input, ...result }], stockMovements: [...(data.stockMovements ?? []), ...changes.map((c) => ({ ...c, id: `RETURN-${input.id}-${c.productId}`, kind: "add" as const, unit: invoice.items.find((l) => l.productId === c.productId)!.unit, reason: `Return ${invoice.invoiceNumber}`, notes: input.note, createdAt: input.createdAt }))] };
}
export function cashTotals(data: BusinessData, day: string, until?: string) {
  const onDay = (s: string) => dayKey(s) === day && (!until || Date.parse(s) <= Date.parse(until));
  const opening = data.cashDays?.find((d) => d.day === day)?.opening ?? 0;
  const sales = (data.invoices ?? []).filter((i) => onDay(i.createdAt) && (i.method === "cash" || i.method === "due")).reduce((n, i) => n + i.amountPaid, 0);
  const collections = (data.customerCollections ?? []).filter((i) => onDay(i.createdAt) && i.method === "cash").reduce((n, i) => n + i.amount, 0);
  const purchases = (data.purchaseInvoices ?? []).filter((i) => onDay(i.createdAt) && i.method === "cash").reduce((n, i) => n + i.paid, 0);
  const suppliers = (data.supplierPayments ?? []).filter((i) => onDay(i.createdAt) && i.method === "cash").reduce((n, i) => n + i.amount, 0);
  const expenses = (data.expenses ?? []).filter((i) => onDay(i.createdAt)).reduce((n, i) => n + i.total, 0);
  const refunds = (data.saleReturns ?? []).filter((i) => onDay(i.createdAt) && i.method === "cash").reduce((n, i) => n + i.refund, 0);
  return { opening, sales, collections, purchases, suppliers, expenses, refunds, incoming: sales + collections, outgoing: purchases + suppliers + expenses + refunds, expected: opening + sales + collections - purchases - suppliers - expenses - refunds };
}
export function openCashDay(data: BusinessData, input: { id: string; opening: number; createdAt: string }): BusinessData {
  const day = dayKey(input.createdAt);
  if (data.cashDays?.some((d) => d.day === day)) throw new Error("cashDayExists");
  if (!id(input.id) || !date(input.createdAt) || !money(input.opening)) throw new Error("invalidTransaction");
  return { ...data, cashDays: [...(data.cashDays ?? []), { id: input.id, day, opening: input.opening, openedAt: input.createdAt, note: "" }] };
}
export function closeCashDay(data: BusinessData, input: { day: string; counted: number; note: string; createdAt: string }): BusinessData {
  const row = data.cashDays?.find((d) => d.day === input.day);
  if (!row || row.closedAt || !date(input.createdAt) || dayKey(input.createdAt) !== row.day || !money(input.counted) || !text(input.note)) throw new Error("invalidTransaction");
  const expected = cashTotals(data, row.day).expected;
  if (input.counted !== expected && !input.note.trim()) throw new Error("cashNoteRequired");
  return { ...data, cashDays: data.cashDays!.map((d) => d.id === row.id ? { ...d, closedAt: input.createdAt, counted: input.counted, expected, note: input.note.trim() } : d) };
}
export function validFinance(data: BusinessData) {
  try {
    for (const [kind, rows] of [["customer", data.customerCollections], ["supplier", data.supplierPayments]] as const) {
      if (rows === undefined) continue;
      if (!Array.isArray(rows) || new Set(rows.map((r) => r.id)).size !== rows.length) return false;
      for (const row of rows) {
        if (!row || !id(row.id) || !id(row.partyId) || !money(row.amount) || !row.amount || !method(row.method) || !date(row.createdAt) || !text(row.note) || !text(row.reference) || !Array.isArray(row.allocations) || new Set(row.allocations.map((a) => a.invoiceId)).size !== row.allocations.length) return false;
        if (kind === "customer" ? !data.customers?.some((p) => p.id === row.partyId) : !data.suppliers?.some((p) => p.id === row.partyId)) return false;
        if (row.allocations.some((a) => !money(a.amount) || !a.amount || (kind === "customer" ? !data.invoices?.some((i) => i.id === a.invoiceId && i.customerId === row.partyId) : !data.purchaseInvoices?.some((i) => i.id === a.invoiceId && i.supplierId === row.partyId)))) return false;
        if (row.allocations.reduce((n, a) => n + a.amount, 0) > row.amount) return false;
      }
    }
    if ((data.invoices ?? []).some((i) => invoiceDue(data, i.id) < 0) || (data.purchaseInvoices ?? []).some((i) => supplierInvoiceDue(data, i.id) < 0)) return false;
    if ((data.invoices ?? []).some((i) => (data.saleReturns ?? []).filter((r) => r.invoiceId === i.id).reduce((n, r) => n + r.refund, 0) > i.amountPaid + (data.customerCollections ?? []).reduce((n, p) => n + p.allocations.filter((a) => a.invoiceId === i.id).reduce((s, a) => s + a.amount, 0), 0))) return false;
    if (data.saleReturns !== undefined) {
      if (!Array.isArray(data.saleReturns) || new Set(data.saleReturns.map((r) => r.id)).size !== data.saleReturns.length) return false;
      const seen: SaleReturn[] = [];
      for (const row of data.saleReturns) {
        if (!row || !id(row.id) || !id(row.invoiceId) || !method(row.method) || !date(row.createdAt) || !id(row.note) || !Array.isArray(row.items) || !row.items.length || ![row.total, row.refund, row.dueReduction].every(money) || row.refund + row.dueReduction !== row.total) return false;
        // Validate cumulative quantities and exact proportional refunds independently of later collections.
        const previous: BusinessData = { ...data, saleReturns: seen, customerCollections: [] };
        const calculated = previewReturn(previous, row.invoiceId, row.items);
        if (row.total !== calculated.total || row.items.some((item, n) => item.amount !== calculated.items[n].amount || item.cost !== calculated.items[n].cost || item.tax !== calculated.items[n].tax || JSON.stringify(item.batchReturns) !== JSON.stringify(calculated.items[n].batchReturns))) return false;
        const invoice = data.invoices!.find((i) => i.id === row.invoiceId)!;
        if (row.items.some((item) => { const line = invoice.items.find((l) => l.id === item.lineId)!; return item.restock && !data.stockMovements?.some((m) => m.id === `RETURN-${row.id}-${line.productId}` && m.productId === line.productId && m.unit === line.unit && m.createdAt === row.createdAt && m.quantity === item.quantity && m.kind === "add"); })) return false;
        seen.push(row);
      }
    }
    if (data.cashDays !== undefined) {
      if (!Array.isArray(data.cashDays) || new Set(data.cashDays.map((d) => d.day)).size !== data.cashDays.length || new Set(data.cashDays.map((d) => d.id)).size !== data.cashDays.length) return false;
      for (const d of data.cashDays) if (!id(d.id) || !date(d.openedAt) || dayKey(d.openedAt) !== d.day || !money(d.opening) || !text(d.note) || (d.closedAt !== undefined && (!date(d.closedAt) || Date.parse(d.closedAt) < Date.parse(d.openedAt) || dayKey(d.closedAt) !== d.day || !money(d.counted) || !Number.isSafeInteger(d.expected) || d.expected !== cashTotals(data, d.day, d.closedAt).expected || d.expected !== cashTotals(data, d.day).expected || d.counted !== d.expected && !d.note.trim())) || (!d.closedAt && (d.counted !== undefined || d.expected !== undefined))) return false;
    }
    return true;
  } catch { return false; }
}
