import { formatBusinessDate, type BusinessSettings } from "./businessSettings.ts";
import type { PurchaseInvoice } from "./purchasing";
import { formatMoney, formatNumber } from "../dashboard/format.ts";
import { unitLabel } from "./productUnits.ts";
import { paperHTML, type ReceiptPaper } from "./receipt.ts";
export function purchasePaper(i: PurchaseInvoice, language: string, settings?: BusinessSettings): ReceiptPaper {
  return { shopName: i.shopName, transactionId: i.invoiceNumber, date: formatBusinessDate(i.createdAt, language, settings), items: i.items.map((l) => ({ id: l.productId, name: l.name, detail: `${formatNumber(l.quantity, language)} ${unitLabel(l.unit, language)} × ${formatMoney(l.unitCost, language)}`, price: formatMoney(l.netTotal, language) })), total: formatMoney(i.total, language), totalLabel: language.startsWith("bn") ? "মোট" : "Total" };
}
export function purchaseReceiptHTML(i: PurchaseInvoice, language: string, _t: (key: string) => string, settings?: BusinessSettings) { return paperHTML(purchasePaper(i, language, settings), language); }

