import { DUE_NOTIFICATION_PREFIX, type ReminderRequest } from "../store/dueReminders.ts";

export type ReminderAdapter = {
  pending: () => Promise<string[]>;
  delivered: () => Promise<string[]>;
  cancel: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  schedule: (request: ReminderRequest) => Promise<void>;
  readReceipts: () => Promise<string[]>;
  writeReceipts: (ids: string[]) => Promise<void>;
};
/** Call serially. Receipts prevent a notification that has fired from being reissued on reload. */
export async function reconcileReminders(adapter: ReminderAdapter, desired: ReminderRequest[], activeIds: string[], now: number) {
  const receipts = new Set(await adapter.readReceipts());
  const pending = new Set(await adapter.pending());
  const active = new Set(activeIds);
  // iOS has a finite pending-notification limit. Leave room for other app notifications.
  const wanted = desired.filter((r) => !receipts.has(r.id) || pending.has(r.id)).slice(0, 60);
  const wantedIds = new Set(wanted.map((r) => r.id));
  for (const id of pending) if (id.startsWith(DUE_NOTIFICATION_PREFIX) && !wantedIds.has(id)) {
    // A past active request may already have moved from pending to delivered; leave it alone.
    const at = Number(id.slice(id.lastIndexOf("-") + 1));
    if (active.has(id) && at <= now) continue;
    await adapter.cancel(id); receipts.delete(id);
  }
  for (const id of await adapter.delivered()) if (id.startsWith(DUE_NOTIFICATION_PREFIX) && !active.has(id)) await adapter.dismiss(id);
  for (const request of wanted) {
    if (!pending.has(request.id)) await adapter.schedule(request);
    receipts.add(request.id);
    // Persist each successful request. If interrupted before this write, its deterministic
    // pending identifier is discovered next time, so it is never scheduled twice.
    await adapter.writeReceipts([...receipts]);
  }
  const retained = [...receipts].filter((id) => {
    const at = Number(id.slice(id.lastIndexOf("-") + 1));
    return Number.isFinite(at) && (at <= now ? at > now - 120 * 86400000 : active.has(id));
  });
  await adapter.writeReceipts(retained);
  return desired.filter((r) => !receipts.has(r.id)).length > 0 ? "limited" as const : "ok" as const;
}
