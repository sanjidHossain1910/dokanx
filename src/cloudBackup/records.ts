/** Portable record keys are stable across devices; absence is an explicit deletion. */
export type Records = Record<string, unknown>;
export type Change = {
  key: string;
  before: string | null;
  value: unknown | null;
};
const collections = new Set([
  "products",
  "sales",
  "customers",
  "suppliers",
  "stockMovements",
  "invoices",
  "payments",
  "purchaseInvoices",
  "purchases",
  "expenses",
  "customerCollections",
  "supplierPayments",
  "saleReturns",
  "cashDays",
  "productBatches",
  "stockCounts",
  "heldSales",
  "dueReminders",
]);
const local = new Set([
  "heldSales",
  "saleDraft",
  "purchaseDraft",
  "notificationReadSignature",
]);
// Reminders are keyed by their invoice; they intentionally have no separate id.
const identityField = (collection:string) => collection === 'dueReminders' ? 'invoiceId' : 'id';
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function splitRecords(data: object): Records {
  const result: Records = Object.create(null);
  for (const [field, value] of Object.entries(data)) {
    if (local.has(field) || value === undefined) continue;
    if (collections.has(field)) {
      if (!Array.isArray(value)) throw new Error("invalidData");
      for (const item of value) {
        const identity = item?.[identityField(field)];
        if (
          !item ||
          typeof identity !== "string" ||
          !identity ||
          identity.length > 200
        )
          throw new Error("invalidData");
        const key = `${field}/${encodeURIComponent(identity)}`;
        if (key in result) throw new Error("invalidData");
        result[key] = item;
      }
    } else result[`settings/${field}`] = value;
  }
  return result;
}
export function joinRecords(records: Records): Record<string, unknown> {
  const result: Record<string, unknown> = {
    products: [],
    sales: [],
    categories: [],
  };
  for (const [key, value] of Object.entries(records).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    const slash = key.indexOf("/"),
      field = key.slice(0, slash),
      id = key.slice(slash + 1);
    if(field==='heldSales')continue; // Ignore held carts retained by older cloud snapshots.
    if (slash < 1 || !id || value === null) throw new Error("invalidData");
    if (field === "settings") {
      if (
        !/^[A-Za-z][A-Za-z0-9]*$/.test(id) ||
        ["__proto__", "constructor", "prototype"].includes(id) ||
        collections.has(id) ||
        local.has(id)
      )
        throw new Error("invalidData");
      result[id] = value;
    } else {
      if (
        !collections.has(field) ||
        !value ||
        typeof value !== "object" ||
        (value as Record<string,unknown>)[identityField(field)] !== decodeURIComponent(id)
      )
        throw new Error("invalidData");
      result[field] ??= [];
      (result[field] as unknown[]).push(value);
    }
  }
  return result;
}
export async function fingerprints(
  records: Records,
  hash: (s: string) => Promise<string>,
) {
  const result: Record<string, string> = Object.create(null);
  for (const [key, value] of Object.entries(records))
    result[key] = await hash(canonical(value));
  return result;
}
export function changesSince(
  records: Records,
  hashes: Record<string, string>,
  base: Record<string, string>,
): Change[] {
  return [...new Set([...Object.keys(base), ...Object.keys(records)])]
    .filter((key) => hashes[key] !== base[key])
    .map((key) => ({
      key,
      before: base[key] ?? null,
      value: records[key] ?? null,
    }));
}
export function applyChanges(
  records: Records,
  changes: { key: string; value: unknown | null }[],
): Records {
  const next = Object.assign(Object.create(null), records) as Records;
  for (const change of changes) {
    if (change.value === null) delete next[change.key];
    else next[change.key] = change.value;
  }
  joinRecords(next);
  return next;
}
