import type { BusinessData, Sale } from "../store/business.ts";
import type { UnitId } from "../store/productUnits.ts";

export type ProfitEvent = {
  id: string; saleId: string; invoiceId?: string; productId: string; name: string; unit: UnitId;
  photoUri?: string; createdAt: string; returned: boolean; quantity: number;
  unitPrice: number; unitCost: number; gross: number; discount: number; tax: number;
  revenue: number; cost: number; profit: number;
};
export const profitMargin = (profit: number, revenue: number) => revenue > 0 ? profit / revenue * 100 : null;

/** One original transaction per row, matching the sale's immutable detail view. */
export function selectProfitHistory(data: BusinessData, range: { start: number; end: number } | null) {
  const invoices = new Map((data.invoices ?? []).map((i) => [i.id, i]));
  const returns = new Map<string, number>();
  for (const r of data.saleReturns ?? []) returns.set(r.invoiceId, (returns.get(r.invoiceId) ?? 0) + r.total);
  const groups = new Map<string, { key: string; saleId: string; title: string; customerName: string; names: string[]; createdAt: string; total: number; profit: number; returnedTotal: number }>();
  for (const s of data.sales) {
    const invoice = s.invoiceId ? invoices.get(s.invoiceId) : undefined;
    const createdAt = invoice?.createdAt ?? s.createdAt;
    const time = Date.parse(createdAt);
    if (!range || time < range.start || time >= range.end) continue;
    const key = s.invoiceId ? `invoice:${s.invoiceId}` : `legacy:${s.id}`;
    const row = groups.get(key) ?? { key, saleId: s.id, title: invoice?.invoiceNumber ?? s.invoiceId ?? s.id, customerName: invoice?.customerName ?? "", names: [], createdAt, total: 0, profit: 0, returnedTotal: s.invoiceId ? returns.get(s.invoiceId) ?? 0 : 0 };
    row.names.push(s.name); row.total += s.total; row.profit += s.total - (s.tax ?? 0) - s.cost;
    groups.set(key, row);
  }
  return [...groups.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.key.localeCompare(b.key));
}

/** Original invoice breakdown, regardless of the report period or later returns. */
export function selectSaleProfit(data: BusinessData, saleId: string) {
  const sale = data.sales.find((s) => s.id === saleId);
  const sales = sale ? data.sales.filter((s) => sale.invoiceId ? s.invoiceId === sale.invoiceId : s.id === sale.id) : [];
  return selectProfitReport({ ...data, sales, saleReturns: [], expenses: [] }, { start: -Infinity, end: Infinity });
}

/** Cash-period reporting: returns affect the day of return, including sales from earlier days. */
export function selectProfitReport(data: BusinessData, range: { start: number; end: number } | null) {
  const inRange = (stamp: string) => !!range && Date.parse(stamp) >= range.start && Date.parse(stamp) < range.end;
  const events: ProfitEvent[] = [];
  const invoices = new Map((data.invoices ?? []).map((i) => [i.id, i]));
  const sales = new Map(data.sales.map((s) => [s.id, s]));
  const products = new Map(data.products.map((p) => [p.id, p]));
  const snapshot = (s: Sale) => {
    const line = s.invoiceId ? invoices.get(s.invoiceId)?.items.find((l) => l.id === s.id) : undefined;
    return { photoUri: line?.photoUri ?? products.get(s.productId)?.photoUri, unitPrice: line?.unitPrice ?? (s.grossTotal ?? s.total - (s.tax ?? 0) + (s.discount ?? 0)) / s.quantity, unitCost: line?.unitCost ?? s.cost / s.quantity };
  };
  for (const s of data.sales) {
    if (!inRange(s.createdAt)) continue;
    const revenue = s.total - (s.tax ?? 0);
    events.push({ id: `sale:${s.id}`, saleId: s.id, invoiceId: s.invoiceId, productId: s.productId, name: s.name, unit: s.unit ?? "piece", ...snapshot(s), createdAt: s.createdAt, returned: false, quantity: s.quantity, gross: s.grossTotal ?? s.total - (s.tax ?? 0) + (s.discount ?? 0), discount: s.discount ?? 0, tax: s.tax ?? 0, revenue, cost: s.cost, profit: revenue - s.cost });
  }
  for (const r of data.saleReturns ?? []) {
    if (!inRange(r.createdAt)) continue;
    for (const l of r.items) {
      const s = sales.get(l.lineId);
      if (!s || s.invoiceId !== r.invoiceId) continue;
      const revenue = -(l.amount - l.tax), cost = l.restock ? -l.cost : 0;
      events.push({ id: `return:${r.id}:${l.lineId}`, saleId: s.id, invoiceId: s.invoiceId, productId: s.productId, name: s.name, unit: s.unit ?? "piece", ...snapshot(s), createdAt: r.createdAt, returned: true, quantity: l.quantity, gross: 0, discount: 0, tax: -l.tax, revenue, cost, profit: revenue - cost });
    }
  }
  events.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
  const groups = new Map<string, { key: string; productId: string; name: string; unit: UnitId; photoUri?: string; sold: number; returned: number; revenue: number; cost: number; profit: number; events: ProfitEvent[] }>();
  for (const e of events) {
    const key = JSON.stringify([e.productId, e.unit]);
    const g = groups.get(key) ?? { key, productId: e.productId, name: e.name, unit: e.unit, photoUri: e.photoUri, sold: 0, returned: 0, revenue: 0, cost: 0, profit: 0, events: [] };
    if (e.returned) g.returned = (Math.round(g.returned * 1000) + Math.round(e.quantity * 1000)) / 1000;
    else g.sold = (Math.round(g.sold * 1000) + Math.round(e.quantity * 1000)) / 1000;
    g.revenue += e.revenue; g.cost += e.cost; g.profit += e.profit; g.events.push(e); groups.set(key, g);
  }
  const rows = [...groups.values()].sort((a, b) => b.profit - a.profit || a.key.localeCompare(b.key));
  const revenue = rows.reduce((n, r) => n + r.revenue, 0), cost = rows.reduce((n, r) => n + r.cost, 0);
  const expenses = (data.expenses ?? []).filter((e) => inRange(e.createdAt)).reduce((n, e) => n + e.total, 0);
  return { rows, events, revenue, cost, grossProfit: revenue - cost, expenses, netProfit: revenue - cost - expenses };
}
