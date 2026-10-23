import type { BusinessData } from "../store/business.ts";
import { setSaleCardQuantity, saleCardStep } from "../store/inlineCart.ts";
import { sellableStock } from "../store/expiry.ts";
import { productSalePrice, type PriceType } from "../store/productPricing.ts";
import { quantityTicks, validQuantity, type UnitId } from "../store/productUnits.ts";

export type ScannedSaleItem = { productId: string; quantity: number; unit: UnitId; unitPrice: number; priceType: PriceType };

/** A continuous camera detection counts once. Remove the code from view before rescanning. */
export function createSaleScanGuard() {
  let previous = "", seenAt = -Infinity;
  return (code: string, now: number) => {
    const accept = code !== previous || now - seenAt >= 1400;
    previous = code; seenAt = now;
    return accept;
  };
}

export function stageSaleScan(data: BusinessData, rows: ScannedSaleItem[], productId: string, stamp = new Date().toISOString()): ScannedSaleItem[] {
  const product = data.products.find(p => p.id === productId && !p.deletedAt);
  if (!product) throw new Error("productNotFound");
  const line = data.saleDraft?.lines.find(l => l.productId === productId);
  const existing = rows.find(r => r.productId === productId);
  const unit = product.unit ?? "piece", priceType = line?.priceType ?? "retail";
  const unitPrice = line?.unitPrice ?? productSalePrice(product, priceType);
  if (existing && (existing.unit !== unit || existing.unitPrice !== unitPrice || existing.priceType !== priceType)) throw new Error("invalidCart");
  if (line && line.unit !== unit) throw new Error("stockUnavailable");
  const reserved = line?.quantity ?? 0;
  const available = (quantityTicks(sellableStock(data, productId, stamp))! - quantityTicks(reserved)!) / 1000;
  if (available <= 0 || (existing?.quantity ?? 0) >= available) throw new Error("stockUnavailable");
  const quantity = saleCardStep(existing?.quantity ?? 0, available, unit, 1);
  return [{ productId, quantity, unit, unitPrice, priceType }, ...rows.filter(r => r.productId !== productId)];
}

/** Quantity buttons keep the row in place; only a fresh scan changes list order. */
export function stepSaleScan(data: BusinessData, rows: ScannedSaleItem[], productId: string, direction: -1 | 1, stamp = new Date().toISOString()): ScannedSaleItem[] {
  const row = rows.find(r => r.productId === productId);
  if (!row) return rows;
  if (direction === 1) {
    const next = stageSaleScan(data, rows, productId, stamp)[0];
    return rows.map(r => r.productId === productId ? next : r);
  }
  const quantity = saleCardStep(row.quantity, row.quantity, row.unit, -1);
  return quantity ? rows.map(r => r.productId === productId ? { ...r, quantity } : r) : rows.filter(r => r.productId !== productId);
}

/** Commit the whole scan session in one business update; Cancel never writes a cart. */
export function commitSaleScans(data: BusinessData, rows: ScannedSaleItem[], expectedDraftId: string | undefined, newDraftId: string, stamp = new Date().toISOString()): BusinessData {
  if (data.saleDraft?.id !== expectedDraftId || new Set(rows.map(r => r.productId)).size !== rows.length) throw new Error("invalidCart");
  return rows.reduce((current, row) => {
    if (!validQuantity(row.quantity, row.unit, false)) throw new Error("invalidQuantity");
    const product = current.products.find(p => p.id === row.productId && !p.deletedAt);
    const line = current.saleDraft?.lines.find(l => l.productId === row.productId);
    if (!product || (product.unit ?? "piece") !== row.unit || (line?.priceType ?? "retail") !== row.priceType || (line?.unitPrice ?? productSalePrice(product, row.priceType)) !== row.unitPrice) throw new Error("invalidCart");
    const quantity = (quantityTicks(line?.quantity ?? 0)! + quantityTicks(row.quantity)!) / 1000;
    return setSaleCardQuantity(current, expectedDraftId ?? newDraftId, row.productId, quantity, row.priceType, stamp);
  }, data);
}
