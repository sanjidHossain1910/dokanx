import type { BusinessData } from "../store/business.ts";
import { profitMargin } from "./profitReport.ts";

/** Receipts are money actually retained, not sale value or cash tendered before change. */
export function selectLifetimeSummary(data: BusinessData) {
  const sales = data.sales.reduce((n, s) => n + s.total, 0) - (data.saleReturns ?? []).reduce((n, r) => n + r.total, 0);
  const costAndTax = data.sales.reduce((n, s) => n + s.cost + (s.tax ?? 0), 0);
  const returnedCostAndTax = (data.saleReturns ?? []).reduce((n, r) => n + r.items.reduce((sum, item) => sum + item.tax + (item.restock ? item.cost : 0), 0), 0);
  const expenses = (data.expenses ?? []).reduce((n, e) => n + e.total, 0);
  const netRevenue = sales - data.sales.reduce((n, s) => n + (s.tax ?? 0), 0) + (data.saleReturns ?? []).reduce((n, r) => n + r.items.reduce((sum, item) => sum + item.tax, 0), 0);
  const profit = sales - costAndTax + returnedCostAndTax - expenses;
  const amounts = { cash: 0, bkash: 0, nagad: 0, card: 0 };
  for (const invoice of data.invoices ?? []) {
    const method = invoice.method === "due" ? "cash" : invoice.method;
    amounts[method] += invoice.amountPaid;
  }
  for (const payment of data.customerCollections ?? []) amounts[payment.method] += payment.amount;
  for (const returned of data.saleReturns ?? []) amounts[returned.method] -= returned.refund;
  return {
    sales,
    profit,
    netRevenue,
    margin: profitMargin(profit, netRevenue),
    due: (data.customers ?? []).reduce((n, c) => n + (c.balance ?? 0), 0),
    received: Object.values(amounts).reduce((n, amount) => n + amount, 0),
    ...amounts,
    digital: amounts.bkash + amounts.nagad + amounts.card,
    untrackedSales: data.sales.filter(s => !s.invoiceId).reduce((n, s) => n + s.total, 0),
  };
}
