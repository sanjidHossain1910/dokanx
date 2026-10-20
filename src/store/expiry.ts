import type { BusinessData } from "./business.ts";
import { dayKey } from "./finance.ts";
import { quantityTicks, validQuantity } from "./productUnits.ts";
export type ProductBatch = { id: string; productId: string; batchNumber: string; expiryDate: string; quantity: number; createdAt: string; purchaseId?: string };
export type BatchAllocation = { batchId: string; quantity: number };
export function validExpiryDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && dayKey(date) === value;
}
const tracked = (data: BusinessData, productId: string) => (data.productBatches ?? []).filter((b) => b.productId === productId).reduce((n, b) => n + quantityTicks(b.quantity)!, 0);
export function sellableStock(data: BusinessData, productId: string, stamp = new Date().toISOString()) {
  const product = data.products.find((p) => p.id === productId);
  if (!product) return 0;
  const blocked = data.blockExpiredSales !== false ? (data.productBatches ?? []).filter((b) => b.productId === productId && b.expiryDate < dayKey(stamp)).reduce((n, b) => n + quantityTicks(b.quantity)!, 0) : 0;
  return Math.max(0, quantityTicks(product.stock)! - blocked) / 1000;
}
export function addProductBatch(data: BusinessData, input: ProductBatch): BusinessData {
  if (data.productBatches?.some((b) => b.id === input.id)) throw new Error("duplicateBatch");
  const product = data.products.find((p) => p.id === input.productId && !p.deletedAt);
  if (!product || !input.id.trim() || !input.batchNumber.trim() || !validExpiryDate(input.expiryDate) || !validQuantity(input.quantity, product.unit, false) || !Number.isFinite(Date.parse(input.createdAt)) || tracked(data, product.id) + quantityTicks(input.quantity)! > quantityTicks(product.stock)!) throw new Error("invalidBatch");
  return { ...data, productBatches: [...(data.productBatches ?? []), input] };
}
export function consumeBatches(data: BusinessData, productId: string, quantity: number, stamp: string, stockAdjustment = false) {
  const product = data.products.find((p) => p.id === productId);
  if (!product || !validQuantity(quantity, product.unit) || (!stockAdjustment && quantity > sellableStock(data, productId, stamp))) throw new Error("expiredStock");
  let remaining = quantityTicks(quantity)!;
  const allocations: BatchAllocation[] = [];
  const batches = [...(data.productBatches ?? [])];
  const sorted = batches.filter((b) => b.productId === productId && b.quantity > 0 && (stockAdjustment || data.blockExpiredSales === false || b.expiryDate >= dayKey(stamp))).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  for (const batch of sorted) {
    const amount = Math.min(remaining, quantityTicks(batch.quantity)!);
    if (amount > 0) { allocations.push({ batchId: batch.id, quantity: amount / 1000 }); remaining -= amount; }
    if (!remaining) break;
  }
  return { allocations, productBatches: batches.map((b) => { const taken = allocations.find((a) => a.batchId === b.id); return taken ? { ...b, quantity: (quantityTicks(b.quantity)! - quantityTicks(taken.quantity)!) / 1000 } : b; }) };
}
export function validBatchState(data: BusinessData) {
  try {
    if (data.blockExpiredSales !== undefined && typeof data.blockExpiredSales !== "boolean") return false;
    if (data.productBatches === undefined) return !(data.invoices ?? []).some((i) => i.items.some((l) => l.batchAllocations !== undefined && l.batchAllocations.length > 0));
    if (!Array.isArray(data.productBatches) || new Set(data.productBatches.map((b) => b.id)).size !== data.productBatches.length) return false;
    for (const b of data.productBatches) {
      const p = data.products.find((p) => p.id === b.productId);
      if (!p || typeof b.id !== "string" || !b.id.trim() || typeof b.batchNumber !== "string" || !b.batchNumber.trim() || !validExpiryDate(b.expiryDate) || !validQuantity(b.quantity, p.unit) || typeof b.createdAt !== "string" || !Number.isFinite(Date.parse(b.createdAt)) || (b.purchaseId !== undefined && !data.purchaseInvoices?.some((i) => i.id === b.purchaseId))) return false;
    }
    for (const invoice of data.invoices ?? []) for (const line of invoice.items) if (line.batchAllocations !== undefined && (!Array.isArray(line.batchAllocations) || new Set(line.batchAllocations.map((a) => a.batchId)).size !== line.batchAllocations.length || line.batchAllocations.some((a) => !data.productBatches!.some((b) => b.id === a.batchId && b.productId === line.productId) || !validQuantity(a.quantity, line.unit, false)) || line.batchAllocations.reduce((n, a) => n + quantityTicks(a.quantity)!, 0) > quantityTicks(line.quantity)!)) return false;
    return data.products.every((p) => tracked(data, p.id) <= quantityTicks(p.stock)!);
  } catch { return false; }
}
