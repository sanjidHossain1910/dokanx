import type { BusinessData } from "../store/business";
import { allowsFraction, lineAmount, quantityTicks, validQuantity, validUnitSelection, type UnitId } from "../store/productUnits.ts";
import { purchaseTotals, selectPurchaseSupplier, setPurchaseItem } from "../store/purchasing.ts";

export type RestockSettings = { historyDays: 30 | 60 | 90; targetDays: number; leadDays: number; safetyDays: number; budget: number | null };
export type RestockRule = { productId: string; unit: UnitId; packSize: number; leadDays?: number; shelfLifeDays?: number; maxOrder?: number; supplierId?: string };
export type RestockPlanItem = { productId: string; unit: UnitId; quantity: number };
export type RestockData = { version: 1; settings: RestockSettings; rules: RestockRule[]; plan: RestockPlanItem[] };
export const defaultRestockSettings: RestockSettings = { historyDays: 30, targetDays: 7, leadDays: 2, safetyDays: 1, budget: null };
export const restockData = (data: BusinessData): RestockData => data.restock ?? { version: 1, settings: { ...defaultRestockSettings }, rules: [], plan: [] };
const whole = (n: unknown, min: number, max: number) => Number.isSafeInteger(n) && Number(n) >= min && Number(n) <= max;
export function validRestockSettings(s: RestockSettings) {
  return !!s && [30, 60, 90].includes(s.historyDays) && whole(s.targetDays, 1, 90) && whole(s.leadDays, 0, 30) && whole(s.safetyDays, 0, 30) && (s.budget === null || whole(s.budget, 1, Number.MAX_SAFE_INTEGER));
}
export function validRestockRule(r: RestockRule) {
  return !!r && typeof r.productId === "string" && !!r.productId.trim() && typeof r.unit === "string" && validUnitSelection(r.unit) && validQuantity(r.packSize, r.unit, false) &&
    (r.leadDays === undefined || whole(r.leadDays, 0, 30)) && (r.shelfLifeDays === undefined || whole(r.shelfLifeDays, 1, 3650)) &&
    (r.maxOrder === undefined || validQuantity(r.maxOrder, r.unit, false)) && (r.supplierId === undefined || typeof r.supplierId === "string" && !!r.supplierId.trim());
}
export function validRestock(data: BusinessData) {
  if (data.restock === undefined) return true;
  const v = data.restock;
  // Rules and plans retain their saved unit if a product is edited or archived.
  // Such entries are shown as stale and cannot enter a purchase without review.
  return !!v && v.version === 1 && validRestockSettings(v.settings) && Array.isArray(v.rules) && Array.isArray(v.plan) &&
    new Set(v.rules.map(r => r?.productId)).size === v.rules.length && new Set(v.plan.map(r => r?.productId)).size === v.plan.length &&
    v.rules.every(r => validRestockRule(r) && data.products.some(p => p.id === r.productId)) &&
    v.plan.every(l => l && data.products.some(p => p.id === l.productId) && typeof l.unit === "string" && validUnitSelection(l.unit) && validQuantity(l.quantity, l.unit, false));
}
export function saveRestockSettings(data: BusinessData, settings: RestockSettings): BusinessData {
  if (!validRestockSettings(settings)) throw new Error("invalidSettings");
  return { ...data, restock: { ...restockData(data), settings: { ...settings } } };
}
export function saveRestockRule(data: BusinessData, rule: RestockRule): BusinessData {
  const p = data.products.find(p => p.id === rule.productId && !p.deletedAt);
  if (!p || (p.unit ?? "piece") !== rule.unit || !validRestockRule(rule) || rule.supplierId && !data.suppliers?.some(s => s.id === rule.supplierId)) throw new Error("invalidRule");
  const state = restockData(data);
  return { ...data, restock: { ...state, rules: [...state.rules.filter(r => r.productId !== p.id), { ...rule }] } };
}
export function setRestockPlanItem(data: BusinessData, productId: string, quantity: number, expectedUnit: UnitId): BusinessData {
  const state = restockData(data);
  if (quantity === 0) return { ...data, restock: { ...state, plan: state.plan.filter(l => l.productId !== productId) } };
  const p = data.products.find(p => p.id === productId && !p.deletedAt);
  if (!p || (p.unit ?? "piece") !== expectedUnit || !validQuantity(quantity, p.unit, false) || lineAmount(p.cost, quantity) === null) throw new Error("productChanged");
  const line = { productId, unit: expectedUnit, quantity };
  return { ...data, restock: { ...state, plan: state.plan.some(l => l.productId === productId) ? state.plan.map(l => l.productId === productId ? line : l) : [...state.plan, line] } };
}
export const defaultPackSize = (unit: UnitId) => allowsFraction(unit) ? 0.001 : 1;
export function roundToPack(quantity: number, pack: number, down = false) {
  const ticks = quantity * 1000, step = quantityTicks(pack)!;
  const lots = down ? Math.floor(ticks / step + 1e-8) : Math.ceil(ticks / step - 1e-8);
  return Number.isSafeInteger(lots * step) && lots >= 0 ? lots * step / 1000 : null;
}
export function planTotal(data: BusinessData) {
  let total = 0;
  for (const l of restockData(data).plan) {
    const p = data.products.find(p => p.id === l.productId && !p.deletedAt && (p.unit ?? "piece") === l.unit);
    const amount = p ? lineAmount(p.cost, l.quantity) : null;
    if (amount === null || !Number.isSafeInteger(total + amount)) return null;
    total += amount;
  }
  return total;
}
/** An explicit, atomic hand-off. Existing purchase drafts are never replaced. */
export function beginRestockPurchase(data: BusinessData, supplierId: string, draftId: string, expectedPlan: string, productIds = restockData(data).plan.map(l => l.productId)): BusinessData {
  if (data.purchaseDraft) throw new Error("draftExists");
  const state = restockData(data);
  if (JSON.stringify(state.plan) !== expectedPlan || !state.plan.length || !draftId.trim() || data.purchaseInvoices?.some(i => i.id === draftId)) throw new Error("planChanged");
  if (!productIds.length || new Set(productIds).size !== productIds.length || productIds.some(id => !state.plan.some(l => l.productId === id))) throw new Error("planChanged");
  let next = selectPurchaseSupplier(data, supplierId, draftId);
  for (const l of state.plan.filter(l => productIds.includes(l.productId))) {
    const p = next.products.find(p => p.id === l.productId && !p.deletedAt && (p.unit ?? "piece") === l.unit);
    if (!p) throw new Error("productChanged");
    next = setPurchaseItem(next, p.id, l.quantity, p.cost);
  }
  purchaseTotals(next.purchaseDraft!);
  return { ...next, restock: { ...state, plan: state.plan.filter(l => !productIds.includes(l.productId)) } };
}
