import { localeFor } from "../dashboard/format.ts";
export type BusinessSettings = { invoicePrefix: string; receiptFooter: string; defaultDiscountPercent: number; lowStockDefault: number; dateFormat: "locale" | "dmy" | "ymd"; hour12: boolean };
export const defaultBusinessSettings: BusinessSettings = { invoicePrefix: "INV", receiptFooter: "", defaultDiscountPercent: 0, lowStockDefault: 5, dateFormat: "locale", hour12: true };
export function validBusinessSettings(value: BusinessSettings) {
  return !!value && typeof value.invoicePrefix === "string" && /^[A-Z0-9]{1,12}$/.test(value.invoicePrefix) && typeof value.receiptFooter === "string" && value.receiptFooter.length <= 200 && Number.isSafeInteger(value.defaultDiscountPercent) && value.defaultDiscountPercent >= 0 && value.defaultDiscountPercent <= 10000 && Number.isSafeInteger(value.lowStockDefault) && value.lowStockDefault >= 0 && value.lowStockDefault <= 999999 && ["locale", "dmy", "ymd"].includes(value.dateFormat) && typeof value.hour12 === "boolean";
}
export function formatBusinessDate(value: string | Date, language: string, settings?: BusinessSettings, time = true) {
  const date = value instanceof Date ? value : new Date(value);
  const locale = localeFor(language);
  if (!settings) return time ? date.toLocaleString(locale) : date.toLocaleDateString(locale);
  let day: string;
  if (settings.dateFormat === "locale") day = date.toLocaleDateString(locale);
  else {
    const parts = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(date);
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    day = (settings.dateFormat === "dmy" ? [part("day"), part("month"), part("year")] : [part("year"), part("month"), part("day")]).join(settings.dateFormat === "dmy" ? "/" : "-");
  }
  return time ? `${day}, ${date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: settings.hour12 })}` : day;
}
