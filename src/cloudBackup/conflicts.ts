import { settleBalance, type Settlement } from "../store/finance.ts";
import { isolateIncoming } from "./isolation.ts";
import { entryKeys } from "./outboxTypes.ts";
import { parseBusiness, type BusinessData } from "../store/business.ts";
import { mapBackupImages } from "../store/backupFormat.ts";
import {
  applyChanges,
  canonical,
  joinRecords,
  splitRecords,
  type Records,
} from "./records.ts";
import type { OutboxEntry, WireOperation } from "./outboxTypes.ts";
export { entryKeys } from "./outboxTypes.ts";
export type ConflictChoice = "local" | "cloud" | "merge";
export type ReviewReply = {
  generation: string;
  cursor: number;
  viewerDeviceId: string;
  records: Record<string, unknown | null>;
  hashes: Record<string, string | null>;
  baseline: Record<string, unknown | null>;
  editors: Record<string, { deviceId: string; deviceName: string; at: string }>;
  changes: { key: string; value: unknown | null }[];
};
export type ConflictGroup = {
  id: string;
  changeIds: string[];
  keys: string[];
  financial: boolean;
  at?: string;
};
export type ConflictReview = {
  shop: string;
  generation: string;
  sequence: number;
  expected: string;
  local: Records;
  images?: Record<string, string>;
  entries: OutboxEntry[];
  groups: ConflictGroup[];
  server: ReviewReply;
};
export function eligibleEntries(entries: OutboxEntry[], sequence: number) {
  const blocked = new Set(
    conflictGroups(entries).flatMap((group) => group.changeIds),
  );
  return entries.filter(
    (entry) =>
      entry.sequence <= sequence &&
      entry.status === "pending" &&
      !blocked.has(entry.changeId),
  );
}
/** A sale and all dependent edits must remain an indivisible decision. */
export function conflictGroups(entries: OutboxEntry[]): ConflictGroup[] {
  const remaining = new Set(entries);
  const groups: ConflictGroup[] = [];
  for (const seed of entries.filter((e) => e.status === "conflict")) {
    if (!remaining.has(seed)) continue;
    const selected = new Set([seed]),
      keys = new Set(entryKeys(seed));
    remaining.delete(seed);
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const entry of remaining)
        if (entryKeys(entry).some((k) => keys.has(k))) {
          remaining.delete(entry);
          selected.add(entry);
          entryKeys(entry).forEach((k) => keys.add(k));
          expanded = true;
        }
    }
    groups.push({
      id: seed.changeId,
      changeIds: [...selected].map((e) => e.changeId),
      keys: [...keys].sort(
        (a, b) =>
          Number(!a.startsWith("products/")) -
            Number(!b.startsWith("products/")) || a.localeCompare(b),
      ),
      at: seed.createdAt,
      financial: [...keys].some((k) =>
        /^(sales|invoices|payments|purchases|purchaseInvoices|customerCollections|supplierPayments|saleReturns|cashDays|stockMovements|productBatches|stockCounts)\//.test(
          k,
        ),
      ),
    });
  }
  return groups;
}
/** Include the other device's new settlement IDs so all three choices describe complete payment branches. */
export function includeCloudPaymentKeys(
  local: Records,
  groups: ConflictGroup[],
  changes: ReviewReply["changes"],
): ConflictGroup[] {
  return groups.map((group) => {
    if (
      !group.keys.some((k) =>
        /^(customerCollections|supplierPayments)\//.test(k),
      ) ||
      group.keys.some(
        (k) =>
          !/^(customerCollections|supplierPayments|customers|suppliers)\//.test(
            k,
          ),
      )
    )
      return group;
    const keys = new Set(group.keys);
    for (const change of changes) {
      if (
        local[change.key] ||
        !change.value ||
        typeof change.value !== "object"
      )
        continue;
      const payment = change.value as { partyId?: unknown };
      if (typeof payment.partyId !== "string") continue;
      const partyKey = change.key.startsWith("customerCollections/")
        ? `customers/${encodeURIComponent(payment.partyId)}`
        : change.key.startsWith("supplierPayments/")
          ? `suppliers/${encodeURIComponent(payment.partyId)}`
          : undefined;
      if (partyKey && keys.has(partyKey)) keys.add(change.key);
    }
    return { ...group, keys: [...keys] };
  });
}
export type FieldDifference = {
  path: string;
  local: unknown;
  cloud: unknown;
  before?: unknown;
  originalKnown: boolean;
};
export function fieldDifferences(
  local: unknown,
  cloud: unknown,
  before?: unknown,
  originalKnown = false,
): FieldDifference[] {
  const rows: FieldDifference[] = [];
  const walk = (a: unknown, b: unknown, old: unknown, path: string) => {
    if (canonical(a) === canonical(b)) return;
    const object = (v: unknown): v is Record<string, unknown> =>
      !!v && typeof v === "object" && !Array.isArray(v);
    if (object(a) || object(b)) {
      for (const key of new Set([
        ...Object.keys(object(a) ? a : {}),
        ...Object.keys(object(b) ? b : {}),
      ])) {
        if (["id", "createdAt", "updatedAt"].includes(key)) continue;
        walk(
          object(a) ? a[key] : undefined,
          object(b) ? b[key] : undefined,
          object(old) ? old[key] : undefined,
          path ? `${path}.${key}` : key,
        );
      }
    } else
      rows.push({
        path: path || "record",
        local: a,
        cloud: b,
        before: old,
        originalKnown,
      });
  };
  walk(local, cloud, before, "");
  return rows;
}
export function resolutionRecords(
  review: ConflictReview,
  group: ConflictGroup,
  choice: ConflictChoice,
): Records {
  if (choice === "merge") {
    const merged = paymentMerge(review, group);
    if (!merged.available || !merged.records)
      throw new Error("paymentMergeUnavailable");
    return merged.records;
  }
  // A decision releases only its selected group; other pending/conflicted ledgers remain protected.
  const selected = new Set(group.changeIds);
  // Remove the selected local branch before installing cloud dependencies, so two
  // local/cloud allocations cannot temporarily overpay a bill and hide its new invoices.
  const cloudBranch = applyChanges(
    review.local,
    group.keys.map((key) => ({
      key,
      value: review.server.records[key] ?? null,
    })),
  );
  const records = isolateIncoming(
    cloudBranch,
    review.server.changes,
    review.entries.filter((entry) => !selected.has(entry.changeId)),
  ).records;
  return applyChanges(
    records,
    group.keys.map((key) => ({
      key,
      value:
        choice === "local"
          ? (review.local[key] ?? null)
          : (review.server.records[key] ?? null),
    })),
  );
}
export async function resolutionWire(
  review: ConflictReview,
  group: ConflictGroup,
  choice: ConflictChoice,
  changeId: string,
  hash: (s: string) => Promise<string>,
): Promise<WireOperation> {
  const changes: WireOperation["changes"] = [];
  const merged =
    choice === "merge" ? resolutionRecords(review, group, choice) : undefined;
  for (const key of group.keys) {
    const value = merged
      ? (merged[key] ?? null)
      : choice === "local"
        ? (review.local[key] ?? null)
        : (review.server.records[key] ?? null);
    const after = value === null ? null : await hash(canonical(value));
    if (choice === "merge" || after !== review.server.hashes[key])
      changes.push({ key, value, before: review.server.hashes[key] });
  }
  return { changeId, changes };
}

export type PaymentMergePreview = {
  applicable: boolean;
  available: boolean;
  reason?:
    | "unsupported"
    | "missingBase"
    | "editedPayment"
    | "overpayment"
    | "invalidLedger"
    | "closedCashDay";
  records?: Records;
  reallocated: number;
  parties: {
    key: string;
    name: string;
    otherDueChange: number;
    originalDue: number;
    localDue: number;
    cloudDue: number;
    localNew: number;
    remaining: number;
  }[];
  payments: {
    key: string;
    partyId: string;
    amount: number;
    method: string;
    at: string;
    side: "local" | "cloud" | "both";
  }[];
};
/** Merge independent settlement events, never add two balance snapshots together. */
export function paymentMerge(
  review: ConflictReview,
  group: ConflictGroup,
): PaymentMergePreview {
  const result: PaymentMergePreview = {
    applicable: group.keys.some((k) =>
      /^(customerCollections|supplierPayments)\//.test(k),
    ),
    available: false,
    reallocated: 0,
    parties: [],
    payments: [],
  };
  if (!result.applicable) return result;
  const stop = (reason: PaymentMergePreview["reason"]) => ({
    ...result,
    reason,
  });
  if (
    group.keys.some(
      (k) =>
        !/^(customerCollections|supplierPayments|customers|suppliers)\//.test(
          k,
        ),
    )
  )
    return stop("unsupported");
  const selected = review.entries.filter((e) =>
    group.changeIds.includes(e.changeId),
  );
  if (!selected.length || selected.some((e) => e.seed))
    return stop("unsupported");
  const record = (value: unknown): Record<string, unknown> | undefined =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  const money = (n: unknown): n is number =>
    typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  const ownedKeys = new Set(selected.flatMap(entryKeys));
  const payments = new Map<
    string,
    { partyKey: string; amount: number; exclusive: boolean }
  >();
  for (const key of group.keys.filter(
    (k) =>
      ownedKeys.has(k) && /^(customerCollections|supplierPayments)\//.test(k),
  )) {
    const local = record(review.local[key]),
      cloud = review.server.records[key];
    // Only newly created, immutable settlements qualify; changed/deleted payment IDs require a version choice.
    if (
      !local ||
      review.server.baseline[key] !== null ||
      !money(local.amount) ||
      local.amount === 0 ||
      typeof local.partyId !== "string" ||
      typeof local.id !== "string" ||
      key.split("/")[1] !== encodeURIComponent(local.id)
    )
      return stop("editedPayment");
    for (const entry of selected) {
      const change = !entry.seed
        ? entry.changes.find((c) => c.key === key)
        : undefined;
      if (change && canonical(change.value) !== canonical(local))
        return stop("editedPayment");
      const wire = entry.wire?.changes.find((c) => c.key === key);
      if (
        (wire && wire.before !== null) ||
        (change && entry.beforeValues && entry.beforeValues[key] !== null)
      )
        return stop("editedPayment");
    }
    if (cloud !== null && canonical(cloud) !== canonical(local))
      return stop("editedPayment");
    const partyKey = `${key.startsWith("customerCollections/") ? "customers" : "suppliers"}/${encodeURIComponent(local.partyId)}`;
    if (!group.keys.includes(partyKey)) return stop("unsupported");
    payments.set(key, {
      partyKey,
      amount: local.amount,
      exclusive: cloud === null,
    });
    result.payments.push({
      key,
      partyId: local.partyId,
      amount: local.amount,
      method: String(local.method),
      at: String(local.createdAt),
      side: cloud === null ? "local" : "both",
    });
  }
  let records = resolutionRecords(review, group, "cloud");
  for (const key of group.keys.filter((k) =>
    /^(customers|suppliers)\//.test(k),
  )) {
    const local = record(review.local[key]),
      cloud = record(review.server.records[key]),
      base = record(review.server.baseline[key]);
    if (!local || !cloud || !base) return stop("missingBase");
    const withoutBalance = (v: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(v).filter(([k]) => k !== "balance"));
    if (canonical(withoutBalance(local)) !== canonical(withoutBalance(base)))
      return stop("unsupported");
    const changes = [...payments.values()].filter((p) => p.partyKey === key);
    if (!changes.length) return stop("unsupported");
    const total = changes.reduce((n, p) => n + p.amount, 0),
      added = changes
        .filter((p) => p.exclusive)
        .reduce((n, p) => n + p.amount, 0);
    const before = base.balance ?? 0,
      localDue = local.balance ?? 0,
      cloudDue = cloud.balance ?? 0;
    if (
      !money(before) ||
      !money(localDue) ||
      !money(cloudDue) ||
      !money(total) ||
      !money(added) ||
      before - total !== localDue
    )
      return stop("missingBase");
    const remaining = cloudDue - added;
    result.parties.push({
      key,
      name: String(cloud.name),
      otherDueChange: 0,
      originalDue: before,
      localDue,
      cloudDue,
      localNew: added,
      remaining,
    });
    if (!money(remaining)) return stop("overpayment");
    const collection = key.startsWith("customers/")
      ? "customerCollections/"
      : "supplierPayments/";
    // Include cloud-only payments in the explanation, without counting common history a second time.
    for (const change of review.server.changes) {
      const payment = record(change.value);
      if (
        !change.key.startsWith(collection) ||
        review.local[change.key] ||
        !payment ||
        payment.partyId !== cloud.id ||
        result.payments.some((p) => p.key === change.key)
      )
        continue;
      if (!money(payment.amount)) return stop("invalidLedger");
      result.payments.push({
        key: change.key,
        partyId: String(payment.partyId),
        amount: payment.amount,
        method: String(payment.method),
        at: String(payment.createdAt),
        side: "cloud",
      });
    }
  }
  for (const party of result.parties) {
    const id = decodeURIComponent(party.key.slice(party.key.indexOf("/") + 1));
    const collection = party.key.startsWith("customers/")
      ? "customerCollections/"
      : "supplierPayments/";
    const cloudPaid = result.payments
      .filter(
        (payment) =>
          payment.key.startsWith(collection) &&
          payment.partyId === id &&
          payment.side !== "local",
      )
      .reduce((n, payment) => n + payment.amount, 0);
    party.otherDueChange = party.cloudDue + cloudPaid - party.originalDue;
    if (
      !Number.isSafeInteger(cloudPaid) ||
      !Number.isSafeInteger(party.otherDueChange)
    )
      return stop("invalidLedger");
  }
  try {
    let merged = joinRecords(records) as BusinessData;
    const order = new Map<string, number>();
    for (const entry of [...selected].sort((a, b) => a.sequence - b.sequence))
      for (const key of entryKeys(entry))
        if (!order.has(key)) order.set(key, order.size);
    const exclusive = [...payments]
      .filter(([, payment]) => payment.exclusive)
      .sort(
        ([a], [b]) =>
          (order.get(a) ?? 0) - (order.get(b) ?? 0) || a.localeCompare(b),
      );
    for (const [key] of exclusive) {
      const payment = review.local[key] as Settlement;
      const kind = key.startsWith("customerCollections/")
        ? "customer"
        : "supplier";
      // Only still-local new events are reallocated. Accepted cloud payments stay immutable.
      const existing =
        kind === "customer"
          ? merged.customerCollections
          : merged.supplierPayments;
      if (existing?.some((row) => row.id === payment.id))
        return stop("invalidLedger");
      const { allocations: previousAllocations, ...input } = payment;
      merged = settleBalance(merged, kind, input);
      const saved = (
        kind === "customer"
          ? merged.customerCollections
          : merged.supplierPayments
      )!.find((row) => row.id === payment.id)!;
      if (canonical(saved.allocations) !== canonical(previousAllocations))
        result.reallocated++;
    }
    for (const party of result.parties) {
      const rows = party.key.startsWith("customers/")
        ? merged.customers
        : merged.suppliers;
      const id = decodeURIComponent(
        party.key.slice(party.key.indexOf("/") + 1),
      );
      if (rows?.find((row) => row.id === id)?.balance !== party.remaining)
        return stop("invalidLedger");
    }
    records = splitRecords(merged);
    // Validate invoice allocations, overpayments, cash-day totals and every linked record before offering merge.
    parseBusiness(
      JSON.stringify(
        mapBackupImages(joinRecords(records) as BusinessData, (uri) =>
          uri.startsWith("asset://") ? `file:///review/${uri.slice(8)}` : uri,
        ),
      ),
    );
  } catch (error) {
    return stop(
      error instanceof Error && error.message === "cashDayClosed"
        ? "closedCashDay"
        : "invalidLedger",
    );
  }
  return { ...result, available: true, records };
}
