import type { Product } from "./business";
export type PriceType = "retail" | "wholesale";
export function hasWholesalePrice(product: Product): boolean {
  return Number.isSafeInteger(product.wholesalePrice) && product.wholesalePrice! > 0;
}
export function productSalePrice(product: Product, type: PriceType): number {
  if (type !== "retail" && type !== "wholesale") throw new Error("invalidPriceType");
  if (type === "wholesale") { if (!hasWholesalePrice(product)) throw new Error("wholesaleUnavailable"); return product.wholesalePrice!; }
  return product.price;
}
