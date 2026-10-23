import type { BusinessData } from "./business.ts";
import { adjustStock } from "./inventory.ts";
import { validQuantity, validUnitSelection, type UnitId } from "./productUnits.ts";

export const COUNT_REASONS = ["damage", "missing", "extra", "correction", "other"] as const;
export type CountReason = typeof COUNT_REASONS[number] | "";
export type CountItem = { productId: string; name: string; photoUri?: string; unit: UnitId; before: number; counted: number; reason: CountReason; movementId?: string };
export type StockCount = { id: string; number: string; createdAt: string; note: string; items: CountItem[] };
export type CountEntry = Omit<CountItem, "movementId"> & { version: string };
const text = (v: unknown): v is string => typeof v === "string";
const id = (v: unknown): v is string => text(v) && !!v.trim();
const dated = (v: unknown): v is string => text(v) && Number.isFinite(Date.parse(v));
export const countDifference = (item: Pick<CountItem, "before" | "counted">) => (Math.round(item.counted * 1000) - Math.round(item.before * 1000)) / 1000;
export function validCountReason(item: Pick<CountItem, "before" | "counted" | "reason">) {
  const diff = countDifference(item);
  if (!diff) return item.reason === "";
  return COUNT_REASONS.some((r) => r === item.reason) && (item.reason !== "extra" || diff > 0) && (!["damage", "missing"].includes(item.reason) || diff < 0);
}
/** Detect stock activity even if a sale and purchase happen to leave the same final stock. */
export function stockCountVersion(data: BusinessData, productId: string) {
  const p = data.products.find((p) => p.id === productId && !p.deletedAt);
  if (!p) return "";
  return JSON.stringify([p.stock, p.unit ?? "piece", p.updatedAt ?? "", (data.stockMovements ?? []).filter((m) => m.productId === productId).map((m) => m.id), data.sales.filter((s) => s.productId === productId).map((s) => s.id), (data.purchases ?? []).filter((s) => s.productId === productId).map((s) => s.id), (data.productBatches ?? []).filter((b) => b.productId === productId)]);
}
export function beginCountEntry(data: BusinessData, productId: string): CountEntry {
  const p = data.products.find((p) => p.id === productId && !p.deletedAt);
  if (!p) throw new Error("countStale");
  return { productId: p.id, name: p.name, ...(p.photoUri ? { photoUri: p.photoUri } : {}), unit: p.unit ?? "piece", before: p.stock, counted: p.stock, reason: "", version: stockCountVersion(data, p.id) };
}
const validItem = (l: CountItem) => !!l && id(l.productId) && id(l.name) && typeof l.unit === "string" && validUnitSelection(l.unit) && validQuantity(l.before, l.unit) && validQuantity(l.counted, l.unit) && validCountReason(l) && (l.photoUri === undefined || id(l.photoUri));
export function completeStockCount(data: BusinessData, input: { id: string; createdAt: string; note: string; items: CountEntry[] }): BusinessData {
  if (!id(input.id) || !dated(input.createdAt) || !text(input.note) || input.note.length > 1000 || !Array.isArray(input.items) || !input.items.length || new Set(input.items.map((i) => i.productId)).size !== input.items.length || input.items.some((i) => !validItem(i) || !id(i.version))) throw new Error("invalidStockCount");
  const existing = data.stockCounts?.find((c) => c.id === input.id);
  if (existing) {
    if (existing.createdAt !== input.createdAt || existing.note !== input.note || existing.items.length !== input.items.length || existing.items.some((l, i) => ["productId", "name", "photoUri", "unit", "before", "counted", "reason"].some((key) => l[key as keyof CountItem] !== input.items[i][key as keyof CountEntry]))) throw new Error("duplicateStockCount");
    return data;
  }
  if (input.items.some((l) => stockCountVersion(data, l.productId) !== l.version || data.products.find((p) => p.id === l.productId)?.stock !== l.before)) throw new Error("countStale");
  let next = data;
  const items = input.items.map((entry, index): CountItem => {
    const snapshot: CountItem = { productId: entry.productId, name: entry.name, ...(entry.photoUri ? { photoUri: entry.photoUri } : {}), unit: entry.unit, before: entry.before, counted: entry.counted, reason: entry.reason };
    if (!countDifference(entry)) return snapshot;
    const movementId = `COUNT-${input.id}-${index}`;
    next = adjustStock(next, { id: movementId, stockCountId: input.id, productId: entry.productId, kind: "set", quantity: entry.counted, reason: `stockCount:${entry.reason}`, notes: input.note, createdAt: input.createdAt });
    return { ...snapshot, movementId };
  });
  const count: StockCount = { id: input.id, number: `SC-${String((data.stockCounts?.length ?? 0) + 1).padStart(5, "0")}`, createdAt: input.createdAt, note: input.note, items };
  return { ...next, stockCounts: [...(data.stockCounts ?? []), count] };
}
export function validStockCounts(data: BusinessData) {
  try {
    if (data.stockCounts !== undefined && !Array.isArray(data.stockCounts)) return false;
    const counts = data.stockCounts ?? [];
    if (!Array.isArray(counts) || new Set(counts.map((c) => c.id)).size !== counts.length) return false;
    const used = new Set<string>();
    for (const c of counts) {
      if (!c || !id(c.id) || !/^SC-\d{5,}$/.test(c.number) || !dated(c.createdAt) || !text(c.note) || c.note.length > 1000 || !Array.isArray(c.items) || !c.items.length || new Set(c.items.map((l) => l.productId)).size !== c.items.length) return false;
      for (const l of c.items) {
        if (!validItem(l) || !data.products.some((p) => p.id === l.productId)) return false;
        if (!countDifference(l)) { if (l.movementId !== undefined) return false; continue; }
        if (!id(l.movementId) || used.has(l.movementId)) return false;
        const m = data.stockMovements?.find((m) => m.id === l.movementId);
        if (!m || m.stockCountId !== c.id || m.productId !== l.productId || m.unit !== l.unit || m.kind !== "set" || m.before !== l.before || m.after !== l.counted || m.quantity !== l.counted || m.createdAt !== c.createdAt || m.notes !== c.note || m.reason !== `stockCount:${l.reason}`) return false;
        used.add(l.movementId);
      }
    }
    return !(data.stockMovements ?? []).some((m) => m.stockCountId !== undefined && !used.has(m.id));
  } catch { return false; }
}
