import { formatMoney } from "../dashboard/format.ts";
const moneyFields = new Set([
  "balance",
  "price",
  "cost",
  "unitPrice",
  "unitCost",
  "wholesalePrice",
  "amount",
  "total",
  "subtotal",
  "grossTotal",
  "netTotal",
  "lineTotal",
  "paid",
  "due",
  "amountPaid",
  "amountDue",
  "amountReceived",
  "change",
  "refund",
  "dueReduction",
  "discountAmount",
  "tax",
]);
export function formatConflictNumber(
  value: number,
  path: string,
  language: string,
  recordKey = "",
) {
  const field = path.split(".").at(-1) ?? path;
  const cashMoney =
    recordKey.startsWith("cashDays/") &&
    ["opening", "counted", "expected"].includes(field);
  return moneyFields.has(field) || cashMoney
    ? formatMoney(value, language)
    : value.toLocaleString(language);
}
export function formatConflictStructure(
  value: unknown,
  path: string,
  language: string,
  recordKey = "",
): unknown {
  if (typeof value === "number")
    return formatConflictNumber(value, path, language, recordKey);
  if (Array.isArray(value))
    return value.map((item, i) =>
      formatConflictStructure(item, `${path}.${i}`, language, recordKey),
    );
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        formatConflictStructure(item, `${path}.${key}`, language, recordKey),
      ]),
    );
  return value;
}
export function settlementPresence(
  local: unknown,
  cloud: unknown,
  before: unknown,
  originalKnown: boolean,
) {
  const record = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  if (record(local) === record(cloud)) return undefined;
  if (record(local))
    return {
      value: local,
      side: "local" as const,
      label: originalKnown
        ? before === null
          ? "newLocal"
          : "deletedCloud"
        : "localCopy",
    };
  if (record(cloud))
    return {
      value: cloud,
      side: "cloud" as const,
      label: originalKnown
        ? before === null
          ? "newCloud"
          : "deletedLocal"
        : "cloudCopy",
    };
  return undefined;
}
