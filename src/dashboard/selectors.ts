import type { BusinessData } from "../store/business";
import { activeProducts, stockStatus } from "../store/inventory.ts";

export const LOW_STOCK_LIMIT = 5;
export function localDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
export function selectDashboard(data: BusinessData, now = new Date()) {
  const todayKey = localDayKey(now);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const byDay = <T extends { createdAt: string }>(items: T[], key: string) => items.filter((item) => localDayKey(new Date(item.createdAt)) === key);
  const todaySales = byDay(data.sales, todayKey);
  const yesterdaySales = byDay(data.sales, localDayKey(yesterday));
  const todayReturns = byDay(data.saleReturns ?? [], todayKey);
  const sales = todaySales.reduce((sum, item) => sum + item.total, 0) - todayReturns.reduce((n, r) => n + r.total, 0);
  const previousSales = yesterdaySales.reduce((sum, item) => sum + item.total, 0) - byDay(data.saleReturns ?? [], localDayKey(yesterday)).reduce((n, r) => n + r.total, 0);
  const expenses = byDay(data.expenses ?? [], todayKey).reduce((sum, item) => sum + item.total, 0);
  const purchase = byDay((data.purchases ?? []).filter((p) => !p.invoiceId), todayKey).reduce((sum, item) => sum + item.total, 0) + byDay(data.purchaseInvoices ?? [], todayKey).reduce((sum, item) => sum + item.total, 0);
  const profit = sales - todaySales.reduce((sum, item) => sum + item.cost + (item.tax ?? 0), 0) + todayReturns.flatMap((r) => r.items).reduce((n, r) => n + r.tax + (r.restock ? r.cost : 0), 0) - expenses;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7);
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
    const total = byDay(data.sales, localDayKey(date)).reduce((sum, item) => sum + item.total, 0) - byDay(data.saleReturns ?? [], localDayKey(date)).reduce((n, r) => n + r.total, 0);
    return { date, total };
  });
  const products = activeProducts(data);
  const alerts = products.filter((p) => stockStatus(p) !== "in").sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
  const alertSignature = alerts.map((p) => `${p.id}:${p.stock}`).sort().join("|");
  return {
    sales, purchase, profit, expenses, week, weeklyTotal: week.reduce((sum, day) => sum + day.total, 0),
    salesChange: previousSales > 0 ? (sales - previousSales) / previousSales * 100 : null,
    productCount: products.length,
    lowStockCount: products.filter((p) => stockStatus(p) === "low").length,
    outOfStockCount: products.filter((p) => stockStatus(p) === "out").length,
    alerts, alertSignature, unread: data.notificationReadSignature === alertSignature ? 0 : alerts.length,
  };
}
