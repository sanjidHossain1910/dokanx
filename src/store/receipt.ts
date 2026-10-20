import { formatBusinessDate, type BusinessSettings } from "./businessSettings.ts";
import type { Invoice } from "./pos";
import { formatMoney, formatNumber } from "../dashboard/format.ts";
import { unitLabel } from "./productUnits.ts";
export const escapeReceipt = (value: unknown) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export type ReceiptPaper = { shopName: string; transactionId: string; date: string; items: { id: string; name: string; detail: string; price: string }[]; total: string; totalLabel: string };
export function salePaper(i: Invoice, language: string, settings?: BusinessSettings): ReceiptPaper {
  return { shopName: i.shopName, transactionId: i.invoiceNumber, date: formatBusinessDate(i.createdAt, language, settings), items: i.items.map((l) => ({ id: l.id, name: l.name, detail: `${formatNumber(l.quantity, language)} ${unitLabel(l.unit, language)} × ${formatMoney(l.unitPrice, language)}`, price: formatMoney(l.lineTotal, language) })), total: formatMoney(i.total, language), totalLabel: language.startsWith("bn") ? "মোট" : "Total" };
}
export function paperHTML(paper: ReceiptPaper, language: string) {
  const e = escapeReceipt;
  return `<!DOCTYPE html><html lang="${language.startsWith("bn") ? "bn" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(paper.transactionId)}</title><style>@page{margin:8mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#000;background:#fff;font-size:12px;line-height:1.6;margin:0;padding:12px}.receipt{max-width:380px;margin:auto}h1{font-size:22px;text-align:center;overflow-wrap:anywhere}p{overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;margin:12px 0}td{padding:8px 0;border-bottom:1px dashed #000;vertical-align:top;text-align:left;overflow-wrap:anywhere}td:last-child{text-align:right;white-space:nowrap}.total{display:flex;justify-content:space-between;gap:10px;font-size:18px;font-weight:bold;border-top:2px solid #000;padding-top:12px}footer{text-align:center;margin:24px 0 10px}</style></head><body><main class="receipt"><h1>${e(paper.shopName)}</h1><p>Transaction ID: ${e(paper.transactionId)}<br>${e(paper.date)}</p><table>${paper.items.map((l) => `<tr><td>${e(l.name)}<br><small>${e(l.detail)}</small></td><td>${e(l.price)}</td></tr>`).join("")}</table><div class="total"><span>${e(paper.totalLabel)}</span><span>${e(paper.total)}</span></div><footer>Thank you</footer></main></body></html>`;
}
export function receiptHTML(i: Invoice, language: string, _t: (key: string) => string, settings?: BusinessSettings) { return paperHTML(salePaper(i, language, settings), language); }

