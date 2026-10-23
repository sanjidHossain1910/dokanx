import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { strToU8 } from "fflate";
import type { BusinessData } from "../store/business";
import { lineAmount, validQuantity, type UnitId } from "../store/productUnits.ts";
import { restockData, roundToPack } from "./settings.ts";
import { suggestRestock, type RestockSuggestion } from "./engine.ts";

export type PredictionSnapshot = { version: 1; fingerprint: string; generatedAt: string; settings: ReturnType<typeof restockData>["settings"]; products: {
  id: string; unit: UnitId; stock: number; incoming: number; daily: { day: string; sold: number; available: boolean }[]; leadDays: number; packSize: number; shelfLifeDays?: number; maxOrder?: number; baseline: number | null;
}[] };
export type RemotePrediction = { version: 1; source: "ai"; fingerprint: string; generatedAt: string; expiresAt: string; items: { productId: string; unit: UnitId; quantity: number; explanation: string }[] };
export interface PredictionProvider { predict(snapshot: PredictionSnapshot, signal: AbortSignal): Promise<unknown> }
// The adapter is deliberately unconfigured. A future authenticated backend must
// keep provider credentials off the phone. No network or consent is implied here.
export const onlinePredictionProvider: PredictionProvider | undefined = undefined;
export function buildPredictionSnapshot(data: BusinessData, now: Date, rows = suggestRestock(data, now)): PredictionSnapshot {
  const settings = { ...restockData(data).settings };
  const products = rows.map(r => ({ id: r.product.id, unit: r.unit, stock: r.stock, incoming: r.incoming, daily: r.daily.map(d => ({ ...d })), leadDays: r.leadDays, packSize: r.packSize, ...(r.rule?.shelfLifeDays ? { shelfLifeDays: r.rule.shelfLifeDays } : {}), ...(r.rule?.maxOrder !== undefined ? { maxOrder: r.rule.maxOrder } : {}), baseline: r.quantity })).sort((a, b) => a.id.localeCompare(b.id));
  // Only aggregates and canonical units cross this boundary; no names, contacts,
  // photos, payment data, security settings, API keys, or purchase-list edits.
  const payload = JSON.stringify({ settings, products, costs: [...rows].sort((a, b) => a.product.id.localeCompare(b.product.id)).map(r => [r.product.id, r.product.cost]) });
  const fingerprint = bytesToHex(sha256(strToU8(payload)));
  return { version: 1, fingerprint, generatedAt: now.toISOString(), settings, products };
}
export function validRemotePrediction(value: unknown, snapshot: PredictionSnapshot, rows: RestockSuggestion[], now: Date): value is RemotePrediction {
  const v = value as RemotePrediction;
  if (!v || v.version !== 1 || v.source !== "ai" || v.fingerprint !== snapshot.fingerprint || !Array.isArray(v.items) || v.items.length > rows.length) return false;
  const time = now.getTime(), generated = Date.parse(v.generatedAt), expires = Date.parse(v.expiresAt);
  if (!Number.isFinite(time) || !Number.isFinite(generated) || !Number.isFinite(expires) || generated > time || generated < Date.parse(snapshot.generatedAt) || expires <= time || expires > generated + 86_400_000) return false;
  const ids = new Set<string>(); let total = 0;
  for (const item of v.items) {
    const row = rows.find(r => r.product.id === item?.productId);
    if (!row || ids.has(item.productId) || item.unit !== row.unit || row.quantity === null || !validQuantity(item.quantity, item.unit) || roundToPack(item.quantity, row.packSize) !== item.quantity || typeof item.explanation !== "string" || !item.explanation.trim() || item.explanation.length > 500) return false;
    let cap = Math.max(0, row.rate * (snapshot.settings.targetDays + row.leadDays + snapshot.settings.safetyDays) * 2 - row.stock - row.incoming);
    if (row.rule?.maxOrder !== undefined) cap = Math.min(cap, row.rule.maxOrder);
    if (row.rule?.shelfLifeDays) cap = Math.min(cap, Math.max(0, row.rate * row.rule.shelfLifeDays - row.stock - row.incoming));
    const amount = lineAmount(row.product.cost, item.quantity);
    if (item.quantity > (roundToPack(cap, row.packSize, true) ?? 0) || amount === null || !Number.isSafeInteger(total + amount)) return false;
    total += amount;
    if (snapshot.settings.budget !== null && (total > snapshot.settings.budget || item.quantity > 0 && row.product.cost === 0)) return false;
    ids.add(item.productId);
  }
  return true;
}
export async function requestPrediction(snapshot: PredictionSnapshot, rows: RestockSuggestion[], provider?: PredictionProvider, options: { now?: () => Date; timeoutMs?: number; signal?: AbortSignal; currentFingerprint?: () => string } = {}) {
  if (!provider) return { source: "device" as const, reason: "unconfigured" as const };
  const abort = new AbortController(), now = options.now ?? (() => new Date());
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectCancellation: (() => void) | undefined;
  const cancelled = new Promise<never>((_, reject) => { rejectCancellation = () => reject(new Error("cancelled")); });
  const cancel = () => { abort.abort(); rejectCancellation?.(); }; options.signal?.addEventListener("abort", cancel, { once: true });
  try {
    if (options.signal?.aborted) return { source: "device" as const, reason: "cancelled" as const };
    const delay = options.timeoutMs ?? 8000;
    if (!Number.isSafeInteger(delay) || delay < 1 || delay > 30000) throw new Error("timeout");
    const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { abort.abort(); reject(new Error("timeout")); }, delay); });
    const result = await Promise.race([provider.predict(snapshot, abort.signal), deadline, cancelled]);
    if (abort.signal.aborted) return { source: "device" as const, reason: "cancelled" as const };
    if (options.currentFingerprint && options.currentFingerprint() !== snapshot.fingerprint) return { source: "device" as const, reason: "stale" as const };
    return validRemotePrediction(result, snapshot, rows, now()) ? { source: "ai" as const, prediction: result } : { source: "device" as const, reason: "invalid" as const };
  } catch { return { source: "device" as const, reason: "unavailable" as const }; }
  finally { if (timer) clearTimeout(timer); options.signal?.removeEventListener("abort", cancel); }
}
