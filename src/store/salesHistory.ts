import { normalizeNumericInput } from "./productUnits.ts";
export function localDateInput(text: string) {
  const value = normalizeNumericInput(text);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}
export function historyRange(period: string, now: Date, from: string, to: string) {
  let start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (period === "week") { start.setDate(start.getDate() - (start.getDay() + 6) % 7); end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7); }
  if (period === "month") { start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 1); }
  if (period === "customDate") {
    const a = localDateInput(from), b = localDateInput(to);
    if (!a || !b || a > b) return null;
    start = a; end = new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1);
  }
  return { start: start.getTime(), end: end.getTime() };
}
