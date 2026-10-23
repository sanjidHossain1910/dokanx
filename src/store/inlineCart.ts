import type { BusinessData } from "./business.ts";
import { addCartProduct, changeCartQuantity, setCartPriceType } from "./pos.ts";
import { sellableStock } from "./expiry.ts";
import { productSalePrice, type PriceType } from "./productPricing.ts";
import { lineAmount, quantityTicks, validQuantity, type UnitId } from "./productUnits.ts";

/** Inline inputs replace the quantity; pressing Add must not accumulate an existing line twice. */
export function setSaleCardQuantity(data: BusinessData, draftId: string, productId: string, quantity: number, priceType?: PriceType, stamp = new Date().toISOString()): BusinessData {
  if (data.saleDraft && data.saleDraft.id !== draftId) throw new Error("invalidCart");
  const product = data.products.find((p) => p.id === productId && !p.deletedAt);
  const line = data.saleDraft?.lines.find((l) => l.productId === productId);
  if (!product || !validQuantity(quantity, product.unit)) throw new Error("invalidQuantity");
  if (line && line.unit !== (product.unit ?? "piece")) throw new Error("stockUnavailable");
  if (!quantity) return line ? changeCartQuantity(data, draftId, productId, 0) : data;
  if (quantity > sellableStock(data, productId, stamp)) throw new Error("stockUnavailable");
  const selectedType = priceType ?? line?.priceType ?? "retail";
  const currentPrice = productSalePrice(product, selectedType);
  const price = line && (line.priceType ?? "retail") === selectedType ? line.unitPrice : currentPrice;
  if (lineAmount(price, quantity) === null) throw new Error("invalidTotals");
  if (!line) return addCartProduct(data, productId, draftId, quantity, selectedType);
  const next = changeCartQuantity(data, draftId, productId, quantity);
  return selectedType === (line.priceType ?? "retail") ? next : setCartPriceType(next, draftId, productId, selectedType);
}

/** Step one selling unit, retaining decimal precision and clamping to available stock. */
export function saleCardStep(quantity: number, stock: number, unit: UnitId | undefined, direction: -1 | 1) {
  if (!validQuantity(quantity, unit) || !validQuantity(stock, unit)) throw new Error("invalidQuantity");
  const ticks = quantityTicks(quantity)!, available = quantityTicks(stock)!;
  return (direction === -1 ? Math.max(0, ticks - 1000) : ticks >= available ? available : ticks + Math.min(1000, available - ticks)) / 1000;
}
