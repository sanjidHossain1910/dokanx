import type { BusinessData } from "../store/business.ts";
export type LocalChange = { key: string; value: unknown | null };
export type WireOperation = {
  changeId: string;
  changes: { key: string; before: string | null; value: unknown | null }[];
};
export type OutboxEntry = {
  changeId: string;
  sequence: number;
  createdAt?: string;
  beforeValues?: Record<string, unknown | null>;
  status?: "pending" | "processing" | "conflict";
  error?: string | null;
  wire?: WireOperation;
} & (
  | { seed: true; changes: Record<string, unknown> }
  | { seed: false; changes: LocalChange[] }
);
export type QueueCounts = {
  pending: number;
  processing: number;
  conflict: number;
};
export type QueueSnapshot = {
  data: BusinessData;
  sequence: number;
  generation: string;
  counts: QueueCounts;
};
export type OutboxAck = {
  batchId: string;
  generation: string;
  acceptedChangeIds: string[];
  rejected: {
    changeId: string;
    code: string;
    status: "pending" | "conflict";
  }[];
  acceptedChanges: LocalChange[];
};
export type ConflictResolution = {
  shop: string;
  generation: string;
  sequence: number;
  expected: string;
  changeIds: string[];
  choice: "local" | "cloud" | "merge";
  data: BusinessData;
  wire: WireOperation;
  localChanges: LocalChange[];
  details: unknown;
};
export interface SyncOutbox {
  reviewEntries?(shop: string, generation: string): Promise<OutboxEntry[]>;
  resolve?(input: ConflictResolution): Promise<void>;
  snapshot(shop: string): Promise<QueueSnapshot>;
  recover(shop: string, generation: string): Promise<void>;
  entries(
    shop: string,
    generation: string,
    sequence: number,
  ): Promise<OutboxEntry[]>;
  claim(
    shop: string,
    generation: string,
    batch: string,
    operations: WireOperation[],
  ): Promise<void>;
  acknowledge(shop: string, result: OutboxAck): Promise<void>;
  retry(shop: string, generation: string, batch: string): Promise<void>;
  counts(shop: string, generation: string): Promise<QueueCounts>;
}

export const entryKeys = (entry: OutboxEntry): string[] =>
  entry.wire
    ? entry.wire.changes.map((c) => c.key)
    : entry.seed
      ? Object.keys(entry.changes)
      : entry.changes.map((c) => c.key);
