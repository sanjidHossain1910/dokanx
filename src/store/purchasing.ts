import type { BusinessData } from "./business";
import { allocateAmount, moneyValue } from "./pos.ts";
import { lineAmount, quantityTicks, validQuantity, validUnitSelection, type UnitId } from "./productUnits.ts";
import { addProductBatch, validExpiryDate } from "./expiry.ts";
import { assertCashOpen } from "./finance.ts";

export type Supplier = { id: string; name: string; phone: string; address: string; balance: number };
export type PurchaseLine = { productId: string; name: string; unit: UnitId; quantity: number; unitCost: number; photoUri?: string; batchNumber?: string; expiryDate?: string };
export type PurchaseDraft = { id: string; supplierId: string; lines: PurchaseLine[]; discount: { kind: "fixed" | "percent"; value: number }; transport: number; other: number };
export type PurchaseMethod = "cash" | "bkash" | "nagad" | "bank" | "other";
export type PurchaseInvoice = Omit<PurchaseDraft, "supplierId" | "lines"> & { supplierId: string; supplierName: string; supplierPhone: string; supplierAddress: string; shopName: string; invoiceNumber: string; items: (PurchaseLine & { grossTotal: number; netTotal: number })[]; subtotal: number; discountAmount: number; total: number; paid: number; due: number; method: PurchaseMethod; reference: string; note: string; status: "pending" | "received"; createdAt: string; receivedAt?: string };
const text = (s: unknown): s is string => typeof s === "string";
const nonempty = (s: unknown): s is string => text(s) && !!s.trim();
const date = (s: unknown): s is string => text(s) && Number.isFinite(Date.parse(s));
function safe(n: bigint) { if (n < 0n || n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("invalidTotals"); return Number(n); }
export const validSupplier = (s: Supplier) => !!s && nonempty(s.id) && nonempty(s.name) && text(s.phone) && (!s.phone || /^\+?\d{7,15}$/.test(s.phone)) && text(s.address) && moneyValue(s.balance);
export function validPurchaseLine(l: PurchaseLine) {
  return !!l && nonempty(l.productId) && nonempty(l.name) && text(l.unit) && validUnitSelection(l.unit) && validQuantity(l.quantity, l.unit, false) && moneyValue(l.unitCost) && (l.photoUri === undefined || nonempty(l.photoUri)) && ((l.expiryDate === undefined && l.batchNumber === undefined) || validExpiryDate(l.expiryDate) && nonempty(l.batchNumber));
}
export function validPurchaseDraft(d: PurchaseDraft) {
  return !!d && nonempty(d.id) && nonempty(d.supplierId) && Array.isArray(d.lines) && d.lines.every(validPurchaseLine) && new Set(d.lines.map((l) => l.productId)).size === d.lines.length && !!d.discount && ["fixed", "percent"].includes(d.discount.kind) && moneyValue(d.discount.value) && (d.discount.kind !== "percent" || d.discount.value <= 10000) && moneyValue(d.transport) && moneyValue(d.other);
}
export function purchaseTotals(d: PurchaseDraft) {
  if (!validPurchaseDraft(d)) throw new Error("invalidDraft");
  const lines = d.lines.map((l) => { const n = lineAmount(l.unitCost, l.quantity); if (n === null) throw new Error("invalidTotals"); return n; });
  const subtotal = safe(lines.reduce((n, v) => n + BigInt(v), 0n));
  const discount = d.discount.kind === "fixed" ? d.discount.value : safe((BigInt(subtotal) * BigInt(d.discount.value) + 5000n) / 10000n);
  if (discount > subtotal) throw new Error("invalidDiscount");
  return { lines, subtotal, discount, total: safe(BigInt(subtotal - discount) + BigInt(d.transport) + BigInt(d.other)) };
}
export function selectPurchaseSupplier(data: BusinessData, supplierId: string, draftId: string): BusinessData {
  if (!data.suppliers?.some((s) => s.id === supplierId)) throw new Error("supplierRequired");
  return { ...data, purchaseDraft: data.purchaseDraft ? { ...data.purchaseDraft, supplierId } : { id: draftId, supplierId, lines: [], discount: { kind: "fixed", value: 0 }, transport: 0, other: 0 } };
}
export function saveSupplier(data: BusinessData, supplier: Supplier): BusinessData {
  if (!validSupplier(supplier) || supplier.balance !== 0 || data.suppliers?.some((s) => s.id === supplier.id || !!supplier.phone && s.phone === supplier.phone)) throw new Error("invalidSupplier");
  return { ...data, suppliers: [...(data.suppliers ?? []), supplier] };
}
/** Quantity is the desired total for this draft line, not an inventory adjustment. */
export function setPurchaseItem(data: BusinessData, productId: string, quantity: number, unitCost: number, batch?: { batchNumber?: string; expiryDate?: string }): BusinessData {
  const draft = data.purchaseDraft;
  const p = data.products.find((p) => p.id === productId && !p.deletedAt);
  const before = draft?.lines.find((l) => l.productId === productId);
  if (!draft || !p || !validQuantity(quantity, p.unit) || !moneyValue(unitCost) || before && before.unit !== (p.unit ?? "piece")) throw new Error("invalidItem");
  const metadata = batch ?? { batchNumber: before?.batchNumber, expiryDate: before?.expiryDate };
  const line: PurchaseLine = { productId, name: p.name, unit: p.unit ?? "piece", quantity, unitCost, ...(p.photoUri ? { photoUri: p.photoUri } : {}), ...(metadata.expiryDate || metadata.batchNumber ? metadata : {}) };
  if (quantity !== 0 && !validPurchaseLine(line)) throw new Error("invalidBatch");
  const lines = quantity === 0 ? draft.lines.filter((l) => l.productId !== productId) : before ? draft.lines.map((l) => l.productId === productId ? line : l) : [...draft.lines, line];
  return { ...data, purchaseDraft: { ...draft, lines } };
}
function receiveItems(data: BusinessData, invoice: PurchaseInvoice, stamp: string): BusinessData {
  let next = data;
  for (const [index, line] of invoice.items.entries()) {
    const p = next.products.find((p) => p.id === line.productId && !p.deletedAt);
    if (!p || (p.unit ?? "piece") !== line.unit) throw new Error("productChanged");
    const ticks = quantityTicks(p.stock)! + quantityTicks(line.quantity)!;
    if (!Number.isSafeInteger(ticks)) throw new Error("invalidTotals");
    const cost = safe((BigInt(quantityTicks(p.stock)!) * BigInt(p.cost) + BigInt(line.netTotal) * 1000n + BigInt(ticks) / 2n) / BigInt(ticks));
    const id = `${invoice.id}-${index}`;
    next = { ...next,
      products: next.products.map((item) => item.id === p.id ? { ...item, stock: ticks / 1000, cost, updatedAt: stamp } : item),
      purchases: [...(next.purchases ?? []), { id, invoiceId: invoice.id, productId: p.id, name: line.name, quantity: line.quantity, unitCost: line.unitCost, unit: line.unit, total: line.grossTotal, netTotal: line.netTotal, createdAt: stamp }],
      stockMovements: [...(next.stockMovements ?? []), { id: `purchase-${id}`, purchaseId: invoice.id, productId: p.id, kind: "add", quantity: line.quantity, before: p.stock, after: ticks / 1000, unit: line.unit, reason: "purchase", notes: invoice.invoiceNumber, createdAt: stamp }],
    };
    if (line.expiryDate && line.batchNumber) next = addProductBatch(next, { id: `BATCH-${id}`, productId: p.id, batchNumber: line.batchNumber, expiryDate: line.expiryDate, quantity: line.quantity, createdAt: stamp, purchaseId: invoice.id });
  }
  return next;
}
export function completePurchase(data: BusinessData, draftId: string, input: { paid: number; method: PurchaseMethod; status: "pending" | "received"; reference: string; note: string; createdAt: string }): BusinessData {
  if (data.purchaseInvoices?.some((i) => i.id === draftId)) return data;
  const draft = data.purchaseDraft;
  if (!draft || draft.id !== draftId || !draft.lines.length) throw new Error("emptyItems");
  const supplier = data.suppliers?.find((s) => s.id === draft.supplierId);
  if (!supplier) throw new Error("supplierRequired");
  const totals = purchaseTotals(draft);
  if (!moneyValue(input.paid) || input.paid > totals.total || !["cash", "bkash", "nagad", "bank", "other"].includes(input.method) || !["pending", "received"].includes(input.status) || !text(input.reference) || !text(input.note) || !date(input.createdAt)) throw new Error("invalidPayment");
  if (input.paid && input.method === "cash") assertCashOpen(data, input.createdAt);
  const weights = totals.lines.some((n) => n > 0) ? totals.lines : totals.lines.map(() => 1);
  const discount = allocateAmount(totals.discount, totals.lines);
  const extras = allocateAmount(safe(BigInt(draft.transport) + BigInt(draft.other)), weights);
  const items = draft.lines.map((line, i) => ({ ...line, grossTotal: totals.lines[i], netTotal: safe(BigInt(totals.lines[i] - discount[i]) + BigInt(extras[i])) }));
  for (const line of items) {
    if (!data.products.some((p) => p.id === line.productId && !p.deletedAt && (p.unit ?? "piece") === line.unit)) throw new Error("productChanged");
  }
  const when = new Date(input.createdAt);
  const day = `${when.getFullYear()}${String(when.getMonth() + 1).padStart(2, "0")}${String(when.getDate()).padStart(2, "0")}`;
  let sequence = (data.purchaseInvoices?.length ?? 0) + 1;
  let invoiceNumber = `PUR-${day}-${String(sequence).padStart(4, "0")}`;
  while (data.purchaseInvoices?.some((i) => i.invoiceNumber === invoiceNumber)) invoiceNumber = `PUR-${day}-${String(++sequence).padStart(4, "0")}`;
  const invoice: PurchaseInvoice = { id: draft.id, supplierId: draft.supplierId, discount: draft.discount, transport: draft.transport, other: draft.other, items, supplierName: supplier.name, supplierPhone: supplier.phone, supplierAddress: supplier.address, shopName: data.shopName, invoiceNumber, subtotal: totals.subtotal, discountAmount: totals.discount, total: totals.total, paid: input.paid, due: totals.total - input.paid, method: input.method, reference: input.reference, note: input.note, status: input.status, createdAt: input.createdAt, ...(input.status === "received" ? { receivedAt: input.createdAt } : {}) };
  const record = invoice;
  let next: BusinessData = { ...data, purchaseDraft: undefined, purchaseInvoices: [...(data.purchaseInvoices ?? []), record], suppliers: data.suppliers!.map((s) => s.id === supplier.id ? { ...s, balance: safe(BigInt(s.balance) + BigInt(invoice.due)) } : s) };
  if (input.status === "received") next = receiveItems(next, record, input.createdAt);
  return next;
}
export function receivePurchase(data: BusinessData, id: string, stamp: string): BusinessData {
  const invoice = data.purchaseInvoices?.find((i) => i.id === id);
  if (!invoice || !date(stamp)) throw new Error("receiptMissing");
  if (invoice.status === "received") return data;
  const next = receiveItems(data, invoice, stamp);
  return { ...next, purchaseInvoices: next.purchaseInvoices!.map((i) => i.id === id ? { ...i, status: "received", receivedAt: stamp } : i) };
}
export function validPurchasing(data: BusinessData) {
  try {
    if (data.suppliers !== undefined && (!Array.isArray(data.suppliers) || !data.suppliers.every(validSupplier) || new Set(data.suppliers.map((s) => s.id)).size !== data.suppliers.length)) return false;
    const suppliers = new Set(data.suppliers?.map((s) => s.id));
    if (data.purchaseDraft && (!validPurchaseDraft(data.purchaseDraft) || !suppliers.has(data.purchaseDraft.supplierId))) return false;
    if (data.purchaseDraft !== undefined && !data.purchaseDraft) return false;
    if (data.purchaseInvoices !== undefined && !Array.isArray(data.purchaseInvoices)) return false;
    const invoices = data.purchaseInvoices ?? [];
    if (new Set(invoices.map((i) => i.id)).size !== invoices.length || new Set(invoices.map((i) => i.invoiceNumber)).size !== invoices.length) return false;
    const rows = data.purchases ?? [], moves = data.stockMovements ?? [];
    for (const i of invoices) {
      const draft = { ...i, lines: i.items };
      if (!validPurchaseDraft(draft) || !i.items.length || !nonempty(i.invoiceNumber) || !suppliers.has(i.supplierId) || !nonempty(i.supplierName) || !text(i.supplierPhone) || !text(i.supplierAddress) || !text(i.shopName) || !date(i.createdAt) || !text(i.note) || !text(i.reference) || !["cash", "bkash", "nagad", "bank", "other"].includes(i.method) || !["pending", "received"].includes(i.status) || !moneyValue(i.paid) || !moneyValue(i.due) || !moneyValue(i.total)) return false;
      const totals = purchaseTotals(draft);
      if (totals.subtotal !== i.subtotal || totals.discount !== i.discountAmount || totals.total !== i.total || BigInt(i.paid) + BigInt(i.due) !== BigInt(i.total) || i.items.some((l, n) => l.grossTotal !== totals.lines[n] || !moneyValue(l.netTotal)) || i.items.reduce((n, l) => n + BigInt(l.netTotal), 0n) !== BigInt(i.total)) return false;
      const discounts = allocateAmount(totals.discount, totals.lines);
      const extras = allocateAmount(safe(BigInt(i.transport) + BigInt(i.other)), totals.lines.some((n) => n > 0) ? totals.lines : totals.lines.map(() => 1));
      if (i.items.some((l, n) => l.netTotal !== totals.lines[n] - discounts[n] + extras[n] || !data.products.some((p) => p.id === l.productId))) return false;
      const linkedRows = rows.filter((p) => p.invoiceId === i.id), linkedMoves = moves.filter((m) => m.purchaseId === i.id);
      if (i.status === "pending") { if (i.receivedAt !== undefined || linkedRows.length || linkedMoves.length) return false; }
      else {
        if (!date(i.receivedAt) || linkedRows.length !== i.items.length || linkedMoves.length !== i.items.length) return false;
        for (const [index, l] of i.items.entries()) {
          const row = linkedRows.find((r) => r.id === `${i.id}-${index}`), move = linkedMoves.find((m) => m.id === `purchase-${i.id}-${index}`);
          if (!row || row.productId !== l.productId || row.quantity !== l.quantity || row.unitCost !== l.unitCost || row.netTotal !== l.netTotal || row.unit !== l.unit || row.createdAt !== i.receivedAt || !move || move.kind !== "add" || move.productId !== l.productId || move.quantity !== l.quantity || move.unit !== l.unit || move.createdAt !== i.receivedAt) return false;
        }
      }
    }
    return rows.every((p) => p.invoiceId === undefined ? p.netTotal === undefined : invoices.some((i) => i.id === p.invoiceId)) && moves.every((m) => m.purchaseId === undefined || invoices.some((i) => i.id === m.purchaseId));
  } catch { return false; }
}
