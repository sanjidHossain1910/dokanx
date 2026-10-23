import type { BusinessData, Product } from "../store/business";
import { quantityTicks } from "../store/productUnits.ts";

export type TopSellingProduct = { product: Product; saleCount: number; lastSoldAt: string };
type Options = { now?: Date; days?: number; limit?: number };

/** Promote ranked products once, keeping current stock and the remaining catalog order. */
export function prioritizeTopSellingProducts(products: Product[], ranked: TopSellingProduct[]): Product[] {
  const available = new Map(products.map((p) => [p.id, p]));
  const promoted = new Set<string>();
  const first: Product[] = [];
  for (const row of ranked) {
    const product = available.get(row.product.id);
    if (product && !promoted.has(product.id)) { first.push(product); promoted.add(product.id); }
  }
  return [...first, ...products.filter((p) => !promoted.has(p.id))];
}

/** Rank completed sales by frequency across units. Drafts and payments are not sales. */
export function selectTopSellingProducts(data: BusinessData, { now = new Date(), days = 30, limit = 10 }: Options = {}): TopSellingProduct[] {
  const until = now.getTime();
  if (!Number.isFinite(until) || !Number.isSafeInteger(days) || days < 1 || !Number.isSafeInteger(limit) || limit < 0) throw new RangeError("invalidRankingOptions");
  // Include today plus the preceding local calendar days, including DST changes.
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1).getTime();
  if (!Number.isFinite(since)) throw new RangeError("invalidRankingOptions");
  if (!limit) return [];

  const products = new Map(data.products.filter((p) => !p.deletedAt).map((p) => [p.id, p]));
  const returned = new Map<string, number>();
  for (const record of data.saleReturns ?? []) {
    const stamp = Date.parse(record.createdAt);
    if (!Number.isFinite(stamp) || stamp > until) continue;
    for (const item of record.items) {
      const key = JSON.stringify([record.invoiceId, item.lineId]);
      returned.set(key, (returned.get(key) ?? 0) + (quantityTicks(item.quantity) ?? 0));
    }
  }

  const seen = new Set<string>();
  const ranked = new Map<string, { product: Product; transactions: Set<string>; lastStamp: number; lastSoldAt: string }>();
  // POS invoices already have corresponding sale rows; do not count both sources.
  for (const sale of data.sales) {
    const product = products.get(sale.productId), stamp = Date.parse(sale.createdAt);
    if (!product || !Number.isFinite(stamp) || stamp < since || stamp > until) continue;
    const key = JSON.stringify([sale.invoiceId ?? null, sale.id]);
    if (seen.has(key)) continue;
    seen.add(key);
    const sold = quantityTicks(sale.quantity) ?? 0;
    if (sold - (sale.invoiceId ? returned.get(key) ?? 0 : 0) <= 0) continue;
    const row = ranked.get(product.id) ?? { product, transactions: new Set<string>(), lastStamp: -Infinity, lastSoldAt: sale.createdAt };
    row.transactions.add(JSON.stringify(sale.invoiceId ? ["invoice", sale.invoiceId] : ["legacy", sale.id]));
    if (stamp > row.lastStamp) { row.lastStamp = stamp; row.lastSoldAt = sale.createdAt; }
    ranked.set(product.id, row);
  }
  return [...ranked.values()].sort((a, b) => b.transactions.size - a.transactions.size || b.lastStamp - a.lastStamp || a.product.name.localeCompare(b.product.name) || a.product.id.localeCompare(b.product.id))
    .slice(0, limit).map(({ product, transactions, lastSoldAt }) => ({ product, saleCount: transactions.size, lastSoldAt }));
}
