import type { BusinessData } from "./business.ts";
import { dayKey, invoiceDue } from "./finance.ts";

/** Invoice-linked follow-up metadata. Historical invoice/payment snapshots stay immutable. */
export type DueReminder = { invoiceId: string; dueDate: string; remind: boolean; notifyAt?: string };
export type DuePlanInput = { dueDate: string; remind: boolean };
export function validDueDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  return y >= 2000 && y <= 2199 && dayKey(date) === value;
}
export function validDueReminders(data: BusinessData) {
  if (data.dueReminders === undefined) return true;
  if (!Array.isArray(data.dueReminders) || new Set(data.dueReminders.map((r) => r?.invoiceId)).size !== data.dueReminders.length) return false;
  return data.dueReminders.every((r) => !!r && typeof r.invoiceId === "string" && validDueDate(r.dueDate) && typeof r.remind === "boolean" &&
    (r.remind ? typeof r.notifyAt === "string" && Number.isFinite(Date.parse(r.notifyAt)) : r.notifyAt === undefined) &&
    data.invoices?.some((i) => i.id === r.invoiceId && !!i.customerId && i.amountDue > 0));
}
export function setDuePlan(data: BusinessData, invoiceId: string, input: DuePlanInput | undefined, now = new Date()): BusinessData {
  const invoice = data.invoices?.find((i) => i.id === invoiceId);
  if (!invoice?.customerId || invoiceDue(data, invoiceId) <= 0) throw new Error("invalidDuePlan");
  const others = (data.dueReminders ?? []).filter((r) => r.invoiceId !== invoiceId);
  if (!input) return { ...data, dueReminders: others };
  if (!validDueDate(input.dueDate) || typeof input.remind !== "boolean" || !Number.isFinite(now.getTime()) || input.dueDate < dayKey(now)) throw new Error("invalidDuePlan");
  const old = data.dueReminders?.find((r) => r.invoiceId === invoiceId);
  // Saving an unchanged plan never re-arms an already delivered notification.
  if (old?.dueDate === input.dueDate && old.remind === input.remind) return data;
  const [y, m, d] = input.dueDate.split("-").map(Number);
  const date = new Date(y, m - 1, d, 9);
  const notifyAt = new Date(Math.max(date.getTime(), now.getTime() + 30000)).toISOString();
  return { ...data, dueReminders: [...others, { invoiceId, dueDate: input.dueDate, remind: input.remind, ...(input.remind ? { notifyAt } : {}) }] };
}
export function selectDuePlans(data: BusinessData, now = new Date()) {
  const today = dayKey(now);
  return (data.dueReminders ?? []).flatMap((r) => {
    const invoice = data.invoices?.find((i) => i.id === r.invoiceId);
    const due = invoiceDue(data, r.invoiceId);
    if (!invoice || due <= 0) return [];
    const customer = data.customers?.find((c) => c.id === invoice.customerId);
    return [{ ...r, invoice, customer, due, status: r.dueDate < today ? "overdue" as const : r.dueDate === today ? "today" as const : "upcoming" as const }];
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.invoiceId.localeCompare(b.invoiceId));
}

export const DUE_NOTIFICATION_PREFIX = "dokanx-due-";
export type ReminderRequest = { id: string; at: number };
/** Private notification text is generic; neither customer names nor amounts reach the lock screen. */
export function desiredDueNotifications(data: BusinessData, now: number): ReminderRequest[] {
  return selectDuePlans(data, new Date(now)).filter((r) => r.remind && r.notifyAt && Date.parse(r.notifyAt) > now)
    .map((r) => ({ id: `${DUE_NOTIFICATION_PREFIX}${encodeURIComponent(r.invoiceId)}-${Date.parse(r.notifyAt!)}`, at: Date.parse(r.notifyAt!) }))
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}
