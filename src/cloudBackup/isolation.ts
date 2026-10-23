import { parseBusiness, type BusinessData } from "../store/business.ts";
import { mapBackupImages } from "../store/backupFormat.ts";
import { dayKey } from "../store/finance.ts";
import { entryKeys } from "./outboxTypes.ts";
import { applyChanges, joinRecords, type Records } from "./records.ts";
import type { LocalChange, OutboxEntry } from "./outboxTypes.ts";

export function latestChanges(changes: LocalChange[]): LocalChange[] {
  const latest = new Map<string, unknown | null>();
  for (const change of changes) latest.set(change.key, change.value);
  return [...latest].map(([key, value]) => ({ key, value }));
}
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
function references(
  key: string,
  value: unknown,
  closedDays: Set<string>,
  lookup: (key: string) => unknown,
) {
  const row = object(value),
    tokens = new Set([key]),
    kind = key.split("/")[0];
  const link = (collection: string, id: unknown) => {
    if (typeof id === "string" && id)
      tokens.add(`${collection}/${encodeURIComponent(id)}`);
  };
  if (["sales", "purchases", "stockMovements", "productBatches"].includes(kind))
    link("products", row.productId);
  if (kind === "sales" || kind === "saleReturns" || kind === "dueReminders")
    link("invoices", row.invoiceId);
  if (kind === "purchases") link("purchaseInvoices", row.invoiceId);
  if (kind === "payments") link("invoices", row.saleId);
  if (kind === "stockMovements") {
    link("invoices", row.saleId);
    link("purchaseInvoices", row.purchaseId);
    link("stockCounts", row.stockCountId);
  }
  if (kind === "productBatches") link("purchaseInvoices", row.purchaseId);
  if (kind === "invoices") link("customers", row.customerId);
  if (kind === "purchaseInvoices") link("suppliers", row.supplierId);
  if (
    ["invoices", "purchaseInvoices", "stockCounts"].includes(kind) &&
    Array.isArray(row.items)
  )
    for (const item of row.items) {
      const line = object(item);
      link("products", line.productId);
      link("stockMovements", line.movementId);
      if (Array.isArray(line.batchAllocations))
        for (const allocation of line.batchAllocations)
          link("productBatches", object(allocation).batchId);
    }
  if (kind === "customerCollections" || kind === "supplierPayments") {
    link(
      kind === "customerCollections" ? "customers" : "suppliers",
      row.partyId,
    );
    if (Array.isArray(row.allocations))
      for (const allocation of row.allocations)
        link(
          kind === "customerCollections" ? "invoices" : "purchaseInvoices",
          object(allocation).invoiceId,
        );
  }
  if (kind === "saleReturns" && typeof row.invoiceId === "string") {
    const invoice = object(
      lookup(`invoices/${encodeURIComponent(row.invoiceId)}`),
    );
    if (typeof row.dueReduction === "number" && row.dueReduction > 0)
      link("customers", invoice.customerId);
    if (Array.isArray(row.items))
      for (const item of row.items) {
        const returned = object(item);
        if (!returned.restock) continue;
        const line = Array.isArray(invoice.items)
          ? invoice.items
              .map(object)
              .find((line) => line.id === returned.lineId)
          : undefined;
        link("products", line?.productId);
        if (Array.isArray(returned.batchReturns))
          for (const batch of returned.batchReturns)
            link("productBatches", object(batch).batchId);
      }
  }
  if (kind === "cashDays" && typeof row.day === "string" && row.closedAt)
    tokens.add(`@cash/${row.day}`);
  const cash =
    kind === "expenses" ||
    ([
      "customerCollections",
      "supplierPayments",
      "saleReturns",
      "purchaseInvoices",
    ].includes(kind) &&
      row.method === "cash") ||
    (kind === "invoices" && ["cash", "due"].includes(String(row.method)));
  if (cash && typeof row.createdAt === "string") {
    const day = dayKey(row.createdAt);
    if (closedDays.has(day)) tokens.add(`@cash/${day}`);
  }
  return tokens;
}
export function isolateIncoming(
  local: Records,
  incoming: LocalChange[],
  entries: OutboxEntry[],
) {
  const changes = latestChanges(incoming),
    protectedKeys = new Set(entries.flatMap(entryKeys));
  const closedDays = new Set<string>();
  for (const [key, value] of [
    ...Object.entries(local),
    ...changes.map((c) => [c.key, c.value] as const),
  ])
    if (
      key.startsWith("cashDays/") &&
      object(value).closedAt &&
      typeof object(value).day === "string"
    )
      closedDays.add(object(value).day as string);
  const latest = new Map(changes.map((change) => [change.key, change.value]));
  const lookup = (key: string) => latest.get(key) ?? local[key];
  const protectedTokens = new Set(protectedKeys);
  for (const key of protectedKeys)
    for (const token of references(key, local[key], closedDays, lookup))
      protectedTokens.add(token);
  for (const entry of entries)
    for (const [key, value] of entry.seed
      ? Object.entries(entry.changes)
      : entry.changes.map((c) => [c.key, c.value] as const)) {
      for (const token of references(
        key,
        value ?? entry.beforeValues?.[key],
        closedDays,
        lookup,
      ))
        protectedTokens.add(token);
    }
  const parent = changes.map((_, i) => i),
    rank = changes.map(() => 0),
    owners = new Map<string, number>();
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    a = find(a);
    b = find(b);
    if (a === b) return;
    if (rank[a] < rank[b]) [a, b] = [b, a];
    parent[b] = a;
    if (rank[a] === rank[b]) rank[a]++;
  };
  const tokens = changes.map(
    (change) =>
      new Set([
        ...references(change.key, change.value, closedDays, lookup),
        ...references(change.key, local[change.key], closedDays, lookup),
      ]),
  );
  tokens.forEach((set, i) =>
    set.forEach((token) => {
      const prior = owners.get(token);
      if (prior !== undefined) union(i, prior);
      else owners.set(token, i);
    }),
  );
  const groups = new Map<number, LocalChange[]>(),
    blocked = new Set<number>();
  changes.forEach((change, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(change);
    if ([...tokens[i]].some((k) => protectedTokens.has(k))) blocked.add(root);
  });
  let records = local;
  let waiting = [...groups].filter(([root]) => !blocked.has(root));
  let validations = 0;
  const applyGroupBatch = (batch: typeof waiting): typeof waiting => {
    if (!batch.length || validations >= 64) return batch;
    validations++;
    try {
      const candidate = applyChanges(
        records,
        batch.flatMap(([, rows]) => rows),
      );
      parseBusiness(
        JSON.stringify(
          mapBackupImages(joinRecords(candidate) as BusinessData, (uri) =>
            uri.startsWith("asset://")
              ? `file:///sync-review/${uri.slice(8)}`
              : uri,
          ),
        ),
      );
      records = candidate;
      return [];
    } catch {
      if (batch.length === 1) return batch;
      const middle = Math.floor(batch.length / 2);
      return [
        ...applyGroupBatch(batch.slice(0, middle)),
        ...applyGroupBatch(batch.slice(middle)),
      ];
    }
  };
  // Usually one validation handles the full unblocked download. Split only on a linked-ledger failure.
  let previous = waiting.length + 1;
  while (waiting.length && waiting.length < previous && validations < 64) {
    previous = waiting.length;
    waiting = applyGroupBatch(waiting);
  }
  const deferred = [
    ...[...groups]
      .filter(([root]) => blocked.has(root))
      .flatMap(([, rows]) => rows),
    ...waiting.flatMap(([, rows]) => rows),
  ];
  return {
    records,
    deferred,
    protectedKeys: [
      ...new Set([...protectedKeys, ...deferred.map((c) => c.key)]),
    ],
  };
}
