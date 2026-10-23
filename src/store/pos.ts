import { setDuePlan, type DuePlanInput } from "./dueReminders.ts";
import type { BusinessData } from "./business";
import { lineAmount, quantityTicks, validQuantity, validUnitSelection, type UnitId } from "./productUnits.ts";
import { validWalletAccount } from "./paymentSettings.ts";
import { assertCashOpen } from "./finance.ts";
import { consumeBatches, type BatchAllocation } from "./expiry.ts";
import { hasWholesalePrice, productSalePrice, type PriceType } from "./productPricing.ts";

export type PaymentMethod = "cash" | "bkash" | "nagad" | "card" | "due";
export type CartLine = { productId: string; name: string; quantity: number; unit: UnitId; unitPrice: number; priceType?: PriceType; photoUri?: string };
export type SaleDraft = { id: string; lines: CartLine[]; customerId?: string; discount: { kind: "fixed" | "percent"; value: number }; taxRate: number };
export type InvoiceItem = CartLine & { id: string; unitCost: number; grossTotal: number; discount: number; tax: number; lineTotal: number; cost: number; batchAllocations?: BatchAllocation[] };
export type Invoice = { id: string; invoiceNumber: string; shopName: string; shopPhone?: string; receiptFooter?: string; customerId?: string; customerName: string; items: InvoiceItem[]; subtotal: number; discount: number; tax: number; total: number; amountReceived: number; amountPaid: number; amountDue: number; change: number; method: PaymentMethod; status: "paid" | "partial" | "due"; note: string; reference: string; createdAt: string };
export type Payment = { id: string; saleId: string; method: PaymentMethod; amount: number; reference: string; createdAt: string; verified: false };
export const moneyValue = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
const text = (s: unknown): s is string => typeof s === "string";
const nonempty = (s: unknown): s is string => text(s) && !!s.trim();
const dated = (s: unknown) => text(s) && Number.isFinite(Date.parse(s));
const methodValid = (s: unknown): s is PaymentMethod => ["cash", "bkash", "nagad", "card", "due"].includes(s as string);
function safe(n: bigint) { if (n < 0n || n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("invalidTotals"); return Number(n); }
const sum = (values: number[]) => safe(values.reduce((total, n) => total + BigInt(n), 0n));
function percentage(amount: number, basisPoints: number) { return safe((BigInt(amount) * BigInt(basisPoints) + 5000n) / 10000n); }
export function validCartLine(l: CartLine) {
  return !!l && nonempty(l.productId) && nonempty(l.name) && typeof l.unit === "string" && validUnitSelection(l.unit) && validQuantity(l.quantity, l.unit, false) && moneyValue(l.unitPrice) && (l.priceType === undefined || l.priceType === "retail" || l.priceType === "wholesale") && (l.priceType !== "wholesale" || l.unitPrice > 0) && (l.photoUri === undefined || nonempty(l.photoUri));
}
export function validDraft(d: SaleDraft) {
  if (!d || !nonempty(d.id) || !Array.isArray(d.lines) || d.lines.some((l) => !validCartLine(l)) || new Set(d.lines.map((l) => l.productId)).size !== d.lines.length || !d.discount || !["fixed", "percent"].includes(d.discount.kind) || !moneyValue(d.discount.value) || (d.discount.kind === "percent" && d.discount.value > 10000) || !moneyValue(d.taxRate) || d.taxRate > 10000 || (d.customerId !== undefined && !nonempty(d.customerId))) return false;
  return true;
}
export function cartTotals(d: SaleDraft) {
  if (!validDraft(d)) throw new Error("invalidCart");
  const lines = d.lines.map((l) => { const total = lineAmount(l.unitPrice, l.quantity); if (total === null) throw new Error("invalidTotals"); return total; });
  const subtotal = sum(lines);
  const discount = d.discount.kind === "fixed" ? d.discount.value : percentage(subtotal, d.discount.value);
  if (discount > subtotal) throw new Error("invalidDiscount");
  const tax = percentage(subtotal - discount, d.taxRate);
  return { lines, subtotal, discount, tax, total: safe(BigInt(subtotal - discount) + BigInt(tax)) };
}
/** Largest-remainder allocation keeps invoice and line totals exact, including tiny lines. */
export function allocateAmount(total: number, weights: number[]) {
  if (!moneyValue(total) || weights.some((n) => !moneyValue(n))) throw new Error("invalidTotals");
  const denominator = weights.reduce((n, w) => n + BigInt(w), 0n);
  if (!denominator) { if (total) throw new Error("invalidTotals"); return weights.map(() => 0); }
  const rows = weights.map((w, i) => ({ i, value: Number(BigInt(total) * BigInt(w) / denominator), remainder: BigInt(total) * BigInt(w) % denominator }));
  let remaining = total - rows.reduce((n, row) => n + row.value, 0);
  const ranked = [...rows].sort((a, b) => a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : a.i - b.i);
  for (const row of ranked) { if (remaining <= 0) break; row.value++; remaining--; }
  return rows.map((r) => r.value);
}
export function addCartProduct(data: BusinessData, productId: string, draftId: string, amount?: number, priceType?: PriceType): BusinessData {
  const p = data.products.find((p) => p.id === productId && !p.deletedAt);
  if (!p || p.stock <= 0) throw new Error("stockUnavailable");
  if (!data.saleDraft && ((data.heldSales ?? []).some((h) => h.id === draftId) || data.invoices?.some((i) => i.id === draftId))) throw new Error("duplicateInvoice");
  const draft: SaleDraft = data.saleDraft ?? { id: draftId, lines: [], discount: { kind: data.businessSettings?.defaultDiscountPercent ? "percent" : "fixed", value: data.businessSettings?.defaultDiscountPercent ?? 0 }, taxRate: 0 };
  const existing = draft.lines.find((l) => l.productId === productId);
  const selectedType = priceType ?? existing?.priceType ?? "retail";
  if (selectedType === "wholesale" || priceType !== undefined) productSalePrice(p, selectedType);
  if (amount !== undefined && !validQuantity(amount, p.unit, false)) throw new Error("invalidQuantity");
  const increment = amount ?? Math.min(1000, quantityTicks(p.stock)! - quantityTicks(existing?.quantity ?? 0)!) / 1000;
  if (increment <= 0) throw new Error("stockUnavailable");
  const quantity = existing ? (quantityTicks(existing.quantity)! + quantityTicks(increment)!) / 1000 : increment;
  if (quantity > p.stock || !validQuantity(quantity, p.unit, false) || existing && existing.unit !== (p.unit ?? "piece")) throw new Error("stockUnavailable");
  const changedType = !!existing && selectedType !== (existing.priceType ?? "retail");
  const unitPrice = existing && !changedType ? existing.unitPrice : productSalePrice(p, selectedType);
  const line: CartLine = existing ? { ...existing, quantity, unitPrice, ...(priceType !== undefined ? { priceType: selectedType } : {}) } : { productId, name: p.name, quantity, unit: p.unit ?? "piece", unitPrice, ...(priceType !== undefined ? { priceType: selectedType } : {}), ...(p.photoUri ? { photoUri: p.photoUri } : {}) };
  return { ...data, saleDraft: { ...draft, lines: existing ? draft.lines.map((l) => l.productId === productId ? line : l) : [...draft.lines, line] } };
}
export function setCartPriceType(data: BusinessData, draftId: string, productId: string, priceType: PriceType): BusinessData {
  const draft = data.saleDraft, product = data.products.find((p) => p.id === productId && !p.deletedAt);
  const line = draft?.lines.find((l) => l.productId === productId);
  if (!draft || draft.id !== draftId || !product || !line || line.unit !== (product.unit ?? "piece")) throw new Error("stockUnavailable");
  const price = productSalePrice(product, priceType);
  if ((line.priceType ?? "retail") === priceType) return data;
  return { ...data, saleDraft: { ...draft, lines: draft.lines.map((l) => l.productId === productId ? { ...l, priceType, unitPrice: price } : l) } };
}
export function changeCartQuantity(data: BusinessData, draftId: string, productId: string, quantity: number): BusinessData {
  const draft = data.saleDraft;
  const p = data.products.find((p) => p.id === productId && !p.deletedAt);
  const line = draft?.lines.find((l) => l.productId === productId);
  if (!draft || draft.id !== draftId || !line || !p || line.unit !== (p.unit ?? "piece") || !validQuantity(quantity, line.unit) || quantity > p.stock) throw new Error("stockUnavailable");
  return { ...data, saleDraft: { ...draft, lines: quantity === 0 ? draft.lines.filter((l) => l.productId !== productId) : draft.lines.map((l) => l.productId === productId ? { ...l, quantity } : l) } };
}
export function completeSale(data: BusinessData, draftId: string, input: { method: PaymentMethod; received: number; note: string; reference: string; createdAt: string; duePlan?: DuePlanInput }): BusinessData {
  if (data.invoices?.some((i) => i.id === draftId)) return data;
  const draft = data.saleDraft;
  if (!draft || draft.id !== draftId || !draft.lines.length) throw new Error("emptyCart");
  const totals = cartTotals(draft);
  if (!methodValid(input.method) || !moneyValue(input.received) || !text(input.note) || !text(input.reference) || !dated(input.createdAt)) throw new Error("invalidPayment");
  if ((input.method === "bkash" || input.method === "nagad") && (!data.paymentSettings?.[input.method]?.enabled || !validWalletAccount(data.paymentSettings[input.method]))) throw new Error("walletUnavailable");
  const customer = data.customers?.find((c) => c.id === draft.customerId);
  if (draft.customerId && !customer) throw new Error("customerRequired");
  if (input.method === "due" && !customer) throw new Error("customerRequired");
  if (input.method !== "due" && input.received < totals.total || input.method === "due" && input.received > totals.total || !["cash", "due"].includes(input.method) && input.received !== totals.total) throw new Error("invalidPayment");
  const amountPaid = Math.min(input.received, totals.total), amountDue = totals.total - amountPaid, change = input.method === "cash" ? input.received - totals.total : 0;
  if (amountPaid && (input.method === "cash" || input.method === "due")) assertCashOpen(data, input.createdAt);
  if (customer && !moneyValue((customer.balance ?? 0) + amountDue)) throw new Error("invalidTotals");
  const discounts = allocateAmount(totals.discount, totals.lines);
  const taxes = allocateAmount(totals.tax, totals.lines.map((n, i) => n - discounts[i]));
  const invoiceDate = new Date(input.createdAt);
  const day = `${invoiceDate.getFullYear()}${String(invoiceDate.getMonth() + 1).padStart(2, "0")}${String(invoiceDate.getDate()).padStart(2, "0")}`;
  const invoiceNumber = `${data.businessSettings?.invoicePrefix ?? "INV"}-${day}-${draft.id.toUpperCase()}`;
  if (data.invoices?.some((i) => i.invoiceNumber === invoiceNumber)) throw new Error("duplicateInvoice");
  let batched = data;
  const items: InvoiceItem[] = draft.lines.map((line, index) => {
    const p = data.products.find((p) => p.id === line.productId && !p.deletedAt);
    if (!p || p.stock < line.quantity || (p.unit ?? "piece") !== line.unit) throw new Error("stockUnavailable");
    if (line.priceType === "wholesale" && !hasWholesalePrice(p)) throw new Error("wholesaleUnavailable");
    const cost = lineAmount(p.cost, line.quantity);
    const consumed = consumeBatches(batched, p.id, line.quantity, input.createdAt);
    batched = { ...batched, productBatches: consumed.productBatches };
    if (cost === null) throw new Error("invalidTotals");
    return { ...line, id: `${draft.id}-${index}`, unitCost: p.cost, cost, grossTotal: totals.lines[index], discount: discounts[index], tax: taxes[index], lineTotal: totals.lines[index] - discounts[index] + taxes[index], ...(consumed.allocations.length ? { batchAllocations: consumed.allocations } : {}) };
  });
  const invoice: Invoice = { id: draft.id, invoiceNumber, shopName: data.shopName, ...(data.businessSettings?.receiptFooter ? { receiptFooter: data.businessSettings.receiptFooter } : {}), ...(data.shopPhone ? { shopPhone: data.shopPhone } : {}), ...(customer ? { customerId: customer.id } : {}), customerName: customer?.name ?? "", items, subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total, amountReceived: input.received, amountPaid, amountDue, change, method: input.method, status: amountDue === 0 ? "paid" : amountPaid === 0 ? "due" : "partial", note: input.note, reference: input.reference, createdAt: input.createdAt };
  const result: BusinessData = { ...data, saleDraft: undefined,
    productBatches: batched.productBatches,
    products: data.products.map((p) => { const line = items.find((l) => l.productId === p.id); return line ? { ...p, stock: (quantityTicks(p.stock)! - quantityTicks(line.quantity)!) / 1000, updatedAt: input.createdAt } : p; }),
    sales: [...data.sales, ...items.map((l) => ({ id: l.id, invoiceId: invoice.id, productId: l.productId, name: l.name, quantity: l.quantity, total: l.lineTotal, cost: l.cost, unit: l.unit, tax: l.tax, discount: l.discount, grossTotal: l.grossTotal, createdAt: input.createdAt }))],
    invoices: [...(data.invoices ?? []), invoice],
    payments: [...(data.payments ?? []), { id: `PAY-${invoice.id}`, saleId: invoice.id, method: input.method, amount: amountPaid, reference: input.reference, createdAt: input.createdAt, verified: false }],
    customers: (data.customers ?? []).map((c) => c.id === customer?.id ? { ...c, balance: (c.balance ?? 0) + amountDue } : c),
    stockMovements: [...(data.stockMovements ?? []), ...items.map((l) => { const p = data.products.find((p) => p.id === l.productId)!; return { id: `SALE-${l.id}`, saleId: invoice.id, productId: p.id, kind: "remove" as const, quantity: l.quantity, before: p.stock, after: (quantityTicks(p.stock)! - quantityTicks(l.quantity)!) / 1000, unit: l.unit, reason: invoiceNumber, notes: input.note, createdAt: input.createdAt }; })],
  };
  if (input.duePlan && amountDue <= 0) throw new Error("invalidDuePlan");
  return input.duePlan ? setDuePlan(result, invoice.id, input.duePlan, new Date(input.createdAt)) : result;
}
export function validInvoice(i: Invoice) {
  try {
    if (!i || !nonempty(i.id) || !nonempty(i.invoiceNumber) || !text(i.shopName) || (i.shopPhone !== undefined && !text(i.shopPhone)) || (i.receiptFooter !== undefined && (!text(i.receiptFooter) || i.receiptFooter.length > 200)) || !text(i.customerName) || (i.customerId !== undefined && !nonempty(i.customerId)) || !Array.isArray(i.items) || !i.items.length || !methodValid(i.method) || !dated(i.createdAt) || !text(i.note) || !text(i.reference)) return false;
    if (![i.subtotal, i.discount, i.tax, i.total, i.amountReceived, i.amountPaid, i.amountDue, i.change].every(moneyValue) || new Set(i.items.map((l) => l.productId)).size !== i.items.length) return false;
    if (i.items.some((l) => !validCartLine(l) || !nonempty(l.id) || ![l.unitCost, l.grossTotal, l.discount, l.tax, l.lineTotal, l.cost].every(moneyValue) || l.grossTotal !== lineAmount(l.unitPrice, l.quantity) || l.cost !== lineAmount(l.unitCost, l.quantity) || l.discount > l.grossTotal || l.lineTotal !== l.grossTotal - l.discount + l.tax)) return false;
    if (sum(i.items.map((l) => l.grossTotal)) !== i.subtotal || sum(i.items.map((l) => l.discount)) !== i.discount || sum(i.items.map((l) => l.tax)) !== i.tax || sum(i.items.map((l) => l.lineTotal)) !== i.total || i.total !== i.subtotal - i.discount + i.tax || i.amountPaid + i.amountDue !== i.total || i.amountReceived !== i.amountPaid + i.change) return false;
    return i.status === (i.amountDue === 0 ? "paid" : i.amountPaid === 0 ? "due" : "partial") && (!i.amountDue || i.method === "due" && !!i.customerId) && (i.method === "cash" || i.change === 0);
  } catch { return false; }
}
export function validPayment(p: Payment) { return !!p && nonempty(p.id) && nonempty(p.saleId) && methodValid(p.method) && moneyValue(p.amount) && text(p.reference) && dated(p.createdAt) && p.verified === false; }
function validHeldSales(data: BusinessData) {
  try {
    if (data.heldSales === undefined) return true;
    if (!Array.isArray(data.heldSales) || new Set(data.heldSales.map((h) => h.id)).size !== data.heldSales.length) return false;
    for (const h of data.heldSales) {
      if (!validDraft(h) || !h.lines.length || typeof h.label !== "string" || h.label.length > 80 || !dated(h.heldAt) || h.id === data.saleDraft?.id || data.invoices?.some((i) => i.id === h.id) || h.lines.some((l) => !data.products.some((p) => p.id === l.productId)) || h.customerId && !data.customers?.some((c) => c.id === h.customerId)) return false;
      cartTotals(h);
    }
    return true;
  } catch { return false; }
}
export function validPOS(data: BusinessData) {
  if (!validHeldSales(data)) return false;
  if (data.saleDraft !== undefined && !validDraft(data.saleDraft)) return false;
  if (data.invoices !== undefined && (!Array.isArray(data.invoices) || data.invoices.some((i) => !validInvoice(i)) || new Set(data.invoices.map((i) => i.id)).size !== data.invoices.length || new Set(data.invoices.map((i) => i.invoiceNumber)).size !== data.invoices.length)) return false;
  if (data.payments !== undefined && (!Array.isArray(data.payments) || data.payments.some((p) => !validPayment(p)) || new Set(data.payments.map((p) => p.id)).size !== data.payments.length)) return false;
  const salesById = new Map(data.sales.map((s) => [s.id, s]));
  const movementsById = new Map((data.stockMovements ?? []).map((m) => [m.id, m]));
  const invoiceIds = new Set((data.invoices ?? []).map((i) => i.id));
  const paymentsBySale = new Map<string, Payment[]>();
  for (const payment of data.payments ?? []) paymentsBySale.set(payment.saleId, [...(paymentsBySale.get(payment.saleId) ?? []), payment]);
  for (const i of data.invoices ?? []) {
    const payments = paymentsBySale.get(i.id) ?? [];
    if (payments.length !== 1 || payments[0].amount !== i.amountPaid || payments[0].method !== i.method) return false;
    for (const l of i.items) {
      const s = salesById.get(l.id);
      const m = movementsById.get(`SALE-${l.id}`);
      if (!s || s.invoiceId !== i.id || s.productId !== l.productId || s.total !== l.lineTotal || s.cost !== l.cost || s.quantity !== l.quantity || s.name !== l.name || s.unit !== l.unit || s.tax !== l.tax || s.discount !== l.discount || s.grossTotal !== l.grossTotal || !m || m.saleId !== i.id || m.productId !== l.productId || m.kind !== "remove" || m.quantity !== l.quantity || m.unit !== l.unit) return false;
    }
  }
  return !(data.payments ?? []).some((p) => !invoiceIds.has(p.saleId)) && !data.sales.some((s) => s.invoiceId !== undefined && !invoiceIds.has(s.invoiceId)) && !(data.stockMovements ?? []).some((m) => m.saleId !== undefined && !invoiceIds.has(m.saleId));
}
export function quickAmounts(total: number) {
  if (!moneyValue(total)) return [];
  return [5000, 10000, 50000, 100000].filter((amount) => amount >= total);
}

