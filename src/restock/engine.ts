import type { BusinessData, Product } from "../store/business";
import { dayKey } from "../store/finance.ts";
import { getUnit, lineAmount, quantityTicks, type UnitId } from "../store/productUnits.ts";
import { defaultPackSize, restockData, roundToPack, validRestockSettings, type RestockRule, type RestockSettings } from "./settings.ts";

export type RestockStatus = "out" | "low" | "buy" | "enough" | "limited" | "slow";
export type RestockWarning = "stockouts" | "partialStockouts" | "incomplete" | "unitChanged" | "expired" | "nearExpiry" | "pending" | "shelfCap" | "maxCap" | "budgetCap" | "unknownCost" | "ruleChanged" | "draft" | "overflow";
export type RestockSuggestion = {
  product: Product; unit: UnitId; status: RestockStatus; confidence: "low" | "medium" | "high"; quantity: number | null; unconstrained: number | null; estimatedCost: number | null;
  stock: number; expired: number; nearExpiry: number; incoming: number; draftQuantity: number; rate: number; baseRate: number; recentRate: number | null; trend: number | null; daysLeft: number | null;
  observedDays: number; availableDays: number; stockoutDays: number; saleDays: number; sold: number; todaySold: number; daily: { day: string; sold: number; available: boolean }[];
  target: number; safety: number; leadDays: number; packSize: number; rule?: RestockRule; warnings: RestockWarning[];
};
type Bucket = { net: number; gross: number; delta: number };
type Stats = { buckets: Map<string, Bucket>; earliest: number; mismatch: boolean; incoming: number; expired: number; nearExpiry: number; draft: number };
const millis = (value?: string) => value ? Date.parse(value) : NaN;
const midnight = (d: Date, offset = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
const round = (n: number) => Math.round(n * 1000) / 1000;
/** Complete local days only. Today changes stock immediately, never dilutes a daily rate. */
export function suggestRestock(data: BusinessData, now = new Date(), settings: RestockSettings = restockData(data).settings): RestockSuggestion[] {
  if (!Number.isFinite(now.getTime()) || !validRestockSettings(settings)) throw new Error("invalidSettings");
  const until = now.getTime(), today = midnight(now).getTime(), since = midnight(now, -settings.historyDays).getTime();
  const products = new Map(data.products.filter(p => !p.deletedAt).map(p => [p.id, p]));
  const rules = new Map(restockData(data).rules.map(r => [r.productId, r]));
  const stats = new Map<string, Stats>([...products.values()].map(p => [p.id, { buckets: new Map(), earliest: millis(p.createdAt), mismatch: false, incoming: 0, expired: 0, nearExpiry: 0, draft: 0 }]));
  const bucket = (id: string, stamp: string, unit: UnitId | undefined) => {
    const s = stats.get(id), p = products.get(id), time = millis(stamp);
    if (!s || !p || !Number.isFinite(time) || time > until) return;
    if ((unit ?? "piece") !== (p.unit ?? "piece")) { if (time >= since) s.mismatch = true; return; }
    s.earliest = Number.isFinite(s.earliest) ? Math.min(s.earliest, time) : time;
    if (time < since) return;
    const day = dayKey(stamp), b = s.buckets.get(day) ?? { net: 0, gross: 0, delta: 0 }; s.buckets.set(day, b); return b;
  };
  const returned = new Map<string, number>();
  for (const r of data.saleReturns ?? []) if (millis(r.createdAt) <= until) for (const l of r.items) {
    const key = JSON.stringify([r.invoiceId, l.lineId]); returned.set(key, (returned.get(key) ?? 0) + l.quantity);
  }
  const saleMoves = new Set((data.stockMovements ?? []).filter(m => m.saleId).map(m => JSON.stringify([m.saleId, m.productId])));
  const purchaseMoves = new Set((data.stockMovements ?? []).filter(m => m.purchaseId).map(m => JSON.stringify([m.purchaseId, m.productId])));
  const seen = new Set<string>();
  for (const sale of data.sales) {
    const key = JSON.stringify([sale.invoiceId ?? null, sale.id]); if (seen.has(key)) continue; seen.add(key);
    const b = bucket(sale.productId, sale.createdAt, sale.unit); if (!b) continue;
    b.gross += sale.quantity; b.net += Math.max(0, sale.quantity - (sale.invoiceId ? returned.get(key) ?? 0 : 0));
    if (!sale.invoiceId || !saleMoves.has(JSON.stringify([sale.invoiceId, sale.productId]))) b.delta -= sale.quantity;
  }
  for (const m of data.stockMovements ?? []) { const b = bucket(m.productId, m.createdAt, m.unit); if (b) b.delta += m.after - m.before; }
  for (const p of data.purchases ?? []) {
    if (p.invoiceId && purchaseMoves.has(JSON.stringify([p.invoiceId, p.productId]))) continue;
    const b = bucket(p.productId, p.createdAt, p.unit); if (b) b.delta += p.quantity;
  }
  for (const invoice of data.purchaseInvoices ?? []) if (invoice.status === "pending" && millis(invoice.createdAt) <= until) for (const l of invoice.items) {
    const s = stats.get(l.productId); if (s && (products.get(l.productId)?.unit ?? "piece") === l.unit && (!l.expiryDate || l.expiryDate >= dayKey(now))) s.incoming += l.quantity;
  }
  for (const l of data.purchaseDraft?.lines ?? []) { const s = stats.get(l.productId); if (s && (products.get(l.productId)?.unit ?? "piece") === l.unit) s.draft += l.quantity; }
  for (const b of data.productBatches ?? []) {
    const s = stats.get(b.productId); if (!s || millis(b.createdAt) > until) continue;
    if (b.expiryDate < dayKey(now)) s.expired += b.quantity;
    else {
      const rule = rules.get(b.productId), unit = products.get(b.productId)?.unit ?? "piece";
      const lead = rule?.unit === unit ? rule.leadDays ?? settings.leadDays : settings.leadDays;
      if (b.expiryDate <= dayKey(midnight(now, settings.targetDays + lead))) s.nearExpiry += b.quantity;
    }
  }
  const rows: RestockSuggestion[] = [];
  for (const p of products.values()) {
    const s = stats.get(p.id)!, unit = p.unit ?? "piece", savedRule = rules.get(p.id), rule = savedRule?.unit === unit ? savedRule : undefined;
    const warnings: RestockWarning[] = [], pack = rule?.packSize ?? defaultPackSize(unit), lead = rule?.leadDays ?? settings.leadDays;
    if (savedRule && !rule) warnings.push("ruleChanged"); if (s.mismatch) warnings.push("unitChanged");
    const daily: RestockSuggestion["daily"] = []; let end = p.stock - (s.buckets.get(dayKey(now))?.delta ?? 0), reliable = !s.mismatch, partialStockouts = false;
    const first = Number.isFinite(s.earliest) ? Math.max(since, midnight(new Date(s.earliest)).getTime()) : today;
    for (let offset = 1; offset <= settings.historyDays; offset++) {
      const date = midnight(now, -offset); if (date.getTime() < first) break;
      const day = dayKey(date), b = s.buckets.get(day) ?? { net: 0, gross: 0, delta: 0 }, start = end - b.delta;
      if (start < -0.001 || end < -0.001) reliable = false;
      if (b.gross > 0 && (start <= 0.0001 || end <= 0.0001)) partialStockouts = true;
      daily.push({ day, sold: round(b.net), available: start > 0.0001 || end > 0.0001 || b.gross > 0 }); end = start;
    }
    daily.reverse();
    const available = daily.filter(d => d.available), sold = available.reduce((n, d) => n + d.sold, 0), saleDays = available.filter(d => d.sold > 0).length;
    const recent = daily.slice(-7).filter(d => d.available), prior = daily.slice(0, -7).filter(d => d.available);
    const baseRate = available.length ? sold / available.length : 0, recentRate = recent.length >= 3 ? recent.reduce((n, d) => n + d.sold, 0) / recent.length : null;
    const priorRate = prior.length ? prior.reduce((n, d) => n + d.sold, 0) / prior.length : 0;
    const trend = daily.length >= 14 && recentRate !== null && priorRate > 0 ? recentRate / priorRate - 1 : null;
    let rate = baseRate;
    if (daily.length >= 14 && recentRate !== null) rate = Math.max(baseRate * 0.5, Math.min(baseRate * 1.5, recentRate * 0.6 + baseRate * 0.4));
    const enough = available.length >= 7 && saleDays >= 3 && reliable;
    const dormant = recent.length >= 5 && recent.every(d => d.sold === 0) && daily.slice(-14).every(d => d.sold === 0);
    const stock = Math.max(0, round(p.stock - s.expired)), incoming = round(s.incoming), target = rate * (settings.targetDays + lead), safety = rate * settings.safetyDays;
    let quantity: number | null = enough ? roundToPack(Math.max(0, target + safety - stock - incoming), pack) : null;
    const unconstrained = quantity;
    if (dormant && quantity !== null) quantity = 0;
    if (quantity !== null && rule?.shelfLifeDays) {
      const cap = roundToPack(Math.max(0, rate * rule.shelfLifeDays - stock - incoming), pack, true);
      if (cap !== null && quantity > cap) { quantity = cap; warnings.push("shelfCap"); }
    }
    if (quantity !== null && rule?.maxOrder !== undefined) {
      const cap = roundToPack(rule.maxOrder, pack, true)!; if (quantity > cap) { quantity = cap; warnings.push("maxCap"); }
    }
    if (!reliable) warnings.push("incomplete"); if (daily.length > available.length) warnings.push("stockouts");
    if (partialStockouts) warnings.push("partialStockouts");
    if (s.expired > 0) warnings.push("expired"); if (s.nearExpiry > 0) warnings.push("nearExpiry"); if (incoming > 0) warnings.push("pending"); if (s.draft > 0) warnings.push("draft"); if (!p.cost) warnings.push("unknownCost");
    if (getUnit(unit)?.group === "time") { quantity = null; }
    if (quantity !== null && (quantityTicks(quantity) === null || lineAmount(p.cost, quantity) === null)) { quantity = null; warnings.push("overflow"); }
    const daysLeft = rate > 0 ? stock / rate : null;
    rows.push({ product: p, unit, status: !stock ? "out" : quantity === null ? "limited" : dormant ? "slow" : daysLeft !== null && daysLeft <= lead + settings.safetyDays ? "low" : quantity ? "buy" : "enough",
      confidence: !enough || quantity === null || s.expired > 0 ? "low" : !partialStockouts && available.length >= 21 && saleDays >= 7 && daily.length === available.length ? "high" : "medium", quantity, unconstrained, estimatedCost: quantity === null ? null : lineAmount(p.cost, quantity),
      stock, incoming, expired: round(s.expired), nearExpiry: round(s.nearExpiry), draftQuantity: s.draft, rate, baseRate, recentRate, trend, daysLeft, observedDays: daily.length, availableDays: available.length, stockoutDays: daily.length - available.length, saleDays, sold: round(sold), todaySold: round(s.buckets.get(dayKey(now))?.net ?? 0), daily, target, safety, leadDays: lead, packSize: pack, rule, warnings });
  }
  const rank = { out: 0, low: 1, buy: 2, limited: 3, slow: 4, enough: 5 };
  rows.sort((a, b) => rank[a.status] - rank[b.status] || (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) || a.product.name.localeCompare(b.product.name) || a.product.id.localeCompare(b.product.id));
  if (settings.budget !== null) {
    let left = settings.budget;
    for (const row of rows) if (row.quantity !== null && row.quantity > 0) {
      const affordable = row.product.cost > 0 ? roundToPack(left / row.product.cost, row.packSize, true) : 0;
      if (affordable !== null && affordable < row.quantity) { row.quantity = affordable; row.warnings.push("budgetCap"); }
      row.estimatedCost = lineAmount(row.product.cost, row.quantity)!; left = Math.max(0, left - row.estimatedCost);
    }
  }
  return rows;
}
