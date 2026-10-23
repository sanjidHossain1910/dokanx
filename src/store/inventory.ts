import type { BusinessData, Product } from "./business";
import { quantityTicks, validQuantity, validUnitSelection, type UnitId } from "./productUnits.ts";
import { consumeBatches } from "./expiry.ts";

export type StockStatus = "in" | "low" | "out";
export type StockMovement = { id: string; productId: string; kind: "add" | "remove" | "set"; quantity: number; before: number; after: number; unit: UnitId; reason: string; notes: string; createdAt: string; stockCountId?: string; saleId?: string; purchaseId?: string };
export const stockStatus = (p: Product): StockStatus => p.stock === 0 ? "out" : p.stock <= (p.lowStockThreshold ?? 5) ? "low" : "in";
export const activeProducts = (data: BusinessData) => data.products.filter((p) => !p.deletedAt);
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
export function validInventoryMetadata(p: Product) {
  return (p.wholesalePrice === undefined || Number.isSafeInteger(p.wholesalePrice) && p.wholesalePrice > 0) && (p.isFavorite === undefined || typeof p.isFavorite === "boolean") && (p.lowStockThreshold === undefined || validQuantity(p.lowStockThreshold, p.unit)) && (p.description === undefined || typeof p.description === "string") &&
    [p.createdAt, p.updatedAt, p.deletedAt].every((value) => value === undefined || date(value));
}
export function stockResult(before: number, quantity: number, kind: StockMovement["kind"], unit?: UnitId) {
  if (!["add", "remove", "set"].includes(kind) || !validQuantity(before, unit) || !validQuantity(quantity, unit, kind === "set")) return null;
  const a = quantityTicks(before)!, b = quantityTicks(quantity)!;
  const result = kind === "add" ? a + b : kind === "remove" ? a - b : b;
  return Number.isSafeInteger(result) && result >= 0 ? result / 1000 : null;
}
export function validMovement(m: StockMovement) {
  return !!m && typeof m.id === "string" && !!m.id.trim() && typeof m.productId === "string" && !!m.productId.trim() && typeof m.unit === "string" && validUnitSelection(m.unit) && validQuantity(m.after, m.unit) &&
    stockResult(m.before, m.quantity, m.kind, m.unit) === m.after && typeof m.reason === "string" && typeof m.notes === "string" && date(m.createdAt) && (m.purchaseId === undefined || typeof m.purchaseId === "string" && !!m.purchaseId.trim()) && (m.stockCountId === undefined || typeof m.stockCountId === "string" && !!m.stockCountId.trim()) && (m.saleId === undefined || typeof m.saleId === "string" && !!m.saleId.trim());
}
export function adjustStock(data: BusinessData, input: Omit<StockMovement, "before" | "after" | "unit">): BusinessData {
  const product = data.products.find((p) => p.id === input.productId && !p.deletedAt);
  if (!product) throw new Error("productMissing");
  const after = stockResult(product.stock, input.quantity, input.kind, product.unit);
  const movement = { ...input, before: product.stock, after: after ?? -1, unit: product.unit ?? "piece" };
  if (after === null || !validMovement(movement) || data.stockMovements?.some((m) => m.id === input.id)) throw new Error("invalidAdjustment");
  return { ...data, productBatches: after < product.stock ? consumeBatches(data, product.id, (quantityTicks(product.stock)! - quantityTicks(after)!) / 1000, input.createdAt, true).productBatches : data.productBatches, products: data.products.map((p) => p.id === product.id ? { ...p, stock: after, updatedAt: input.createdAt } : p), stockMovements: [...(data.stockMovements ?? []), movement] };
}
export function editProduct(data: BusinessData, product: Product, stamp: string): BusinessData {
  const before = data.products.find((p) => p.id === product.id && !p.deletedAt);
  if (!before) throw new Error("productMissing");
  if ((before.unit ?? "piece") !== (product.unit ?? "piece") && before.stock > 0) throw new Error("unitHasStock");
  if (!product.name.trim() || typeof product.barcode !== "string" || typeof product.category !== "string" || !Number.isSafeInteger(product.price) || product.price < 0 || !Number.isSafeInteger(product.cost) || product.cost < 0 || !validUnitSelection(product.unit, product.unitGroup) || !validInventoryMetadata(product) || !date(stamp) || (product.photoUri !== undefined && (typeof product.photoUri !== "string" || !product.photoUri))) throw new Error("invalidProduct");
  if (product.barcode && data.products.some((p) => p.id !== product.id && !p.deletedAt && p.barcode === product.barcode)) throw new Error("duplicateBarcode");
  const next = { ...product, ...(before.isFavorite !== undefined ? { isFavorite: before.isFavorite } : {}), stock: before.stock, createdAt: before.createdAt, updatedAt: stamp, deletedAt: undefined };
  delete next.deletedAt;
  if (next.createdAt === undefined) delete next.createdAt;
  return { ...data, products: data.products.map((p) => p.id === product.id ? next : p) };
}
export function deleteProduct(data: BusinessData, productId: string, stamp: string): BusinessData {
  if (!data.products.some((p) => p.id === productId && !p.deletedAt) || !date(stamp)) throw new Error("productMissing");
  // Retain identities and historical references for audits and future synchronization.
  return { ...data, products: data.products.map((p) => p.id === productId ? { ...p, deletedAt: stamp, updatedAt: stamp } : p) };
}
export function setProductFavorite(data: BusinessData, productId: string, favorite: boolean, stamp: string): BusinessData {
  if (!data.products.some((p) => p.id === productId && !p.deletedAt) || typeof favorite !== "boolean" || !date(stamp)) throw new Error("productNotFound");
  return { ...data, products: data.products.map((p) => p.id === productId ? { ...p, isFavorite: favorite, updatedAt: stamp } : p) };
}
