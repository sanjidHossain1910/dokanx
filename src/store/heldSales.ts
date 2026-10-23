import type { BusinessData } from "./business";
import { cartTotals, type SaleDraft, type CartLine } from "./pos.ts";
import { sellableStock } from "./expiry.ts";
import { lineAmount } from "./productUnits.ts";
import { hasWholesalePrice, productSalePrice } from "./productPricing.ts";
export type HeldSale = SaleDraft & { label: string; heldAt: string };
const dated = (s: unknown): s is string => typeof s === "string" && Number.isFinite(Date.parse(s));
export function holdSale(data: BusinessData, draftId: string, input: { label: string; createdAt: string }): BusinessData {
  const existing = data.heldSales?.find((h) => h.id === draftId);
  if (existing) {
    if (typeof input.label !== "string" || existing.label !== input.label.trim() || existing.heldAt !== input.createdAt) throw new Error("heldChanged");
    return data;
  }
  const draft = data.saleDraft;
  if (!draft || draft.id !== draftId || !draft.lines.length) throw new Error("emptyCart");
  if (typeof input.label !== "string" || input.label.trim().length > 80 || !dated(input.createdAt) || data.invoices?.some((i) => i.id === draft.id)) throw new Error("invalidHeldSale");
  cartTotals(draft);
  return { ...data, saleDraft: undefined, heldSales: [...(data.heldSales ?? []), { ...draft, label: input.label.trim(), heldAt: input.createdAt }] };
}
export function previewHeldSale(data: BusinessData, heldId: string, stamp: string) {
  const held = data.heldSales?.find((h) => h.id === heldId);
  if (!held) throw new Error("heldMissing");
  if (!dated(stamp)) throw new Error("invalidHeldSale");
  if (held.customerId && !data.customers?.some((c) => c.id === held.customerId)) throw new Error("customerRequired");
  let adjusted = false;
  const lines = held.lines.map((l) => {
    const product = data.products.find((p) => p.id === l.productId && !p.deletedAt);
    if (!product || (product.unit ?? "piece") !== l.unit) throw new Error("heldProductChanged");
    if (l.quantity > sellableStock(data, product.id, stamp)) throw new Error("stockUnavailable");
    const priceType = l.priceType === "wholesale" && hasWholesalePrice(product) ? "wholesale" : "retail";
    const unitPrice = productSalePrice(product, priceType);
    if (l.unitPrice !== unitPrice || priceType !== (l.priceType ?? "retail")) adjusted = true;
    const next: CartLine = { ...l, name: product.name, priceType, unitPrice, photoUri: product.photoUri };
    if (!next.photoUri) delete next.photoUri;
    return next;
  });
  const subtotal = lines.reduce((sum, line) => sum + BigInt(lineAmount(line.unitPrice, line.quantity) ?? -1), 0n);
  if (subtotal < 0n || subtotal > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("invalidTotals");
  const discount = held.discount.kind === "fixed" && held.discount.value > Number(subtotal) ? { ...held.discount, value: Number(subtotal) } : held.discount;
  if (discount.value !== held.discount.value) adjusted = true;
  const draft: SaleDraft = { id: held.id, lines, discount, taxRate: held.taxRate, ...(held.customerId ? { customerId: held.customerId } : {}) };
  return { draft, totals: cartTotals(draft), adjusted };
}
export function resumeHeldSale(data: BusinessData, heldId: string, stamp: string, expectedDraft?: string): BusinessData {
  if (data.saleDraft?.id === heldId && !data.heldSales?.some((h) => h.id === heldId)) return data;
  if (data.saleDraft?.lines.length) throw new Error("activeSaleExists");
  const preview = previewHeldSale(data, heldId, stamp);
  if (expectedDraft !== undefined && expectedDraft !== JSON.stringify(preview.draft)) throw new Error("heldChanged");
  return { ...data, saleDraft: preview.draft, heldSales: data.heldSales!.filter((h) => h.id !== heldId) };
}
export function removeHeldSale(data: BusinessData, heldId: string): BusinessData { return { ...data, heldSales: (data.heldSales ?? []).filter((h) => h.id !== heldId) }; }
