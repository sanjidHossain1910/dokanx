import { validQuantity, validUnitSelection, quantityTicks, lineAmount, type UnitId, type UnitGroupId } from "./productUnits.ts";
import { validInventoryMetadata, validMovement, type StockMovement } from "./inventory.ts";
import { validPOS, type Invoice, type Payment, type SaleDraft } from "./pos.ts";
import { validPurchasing, type Supplier, type PurchaseDraft, type PurchaseInvoice } from "./purchasing.ts";
import { validPaymentSettings, type PaymentSettings } from "./paymentSettings.ts";
import { validShopState } from "./shop.ts";
import { validBusinessSettings, type BusinessSettings } from "./businessSettings.ts";
import { assertCashOpen, validFinance, type Settlement, type SaleReturn, type CashDay } from "./finance.ts";
import { consumeBatches, validBatchState, type ProductBatch } from "./expiry.ts";
export type Product = { id: string; name: string; barcode: string; category: string; price: number; cost: number; stock: number; unit?: UnitId; unitGroup?: UnitGroupId; photoUri?: string; lowStockThreshold?: number; description?: string; createdAt?: string; updatedAt?: string; deletedAt?: string };
export type Sale = { id: string; productId: string; name: string; quantity: number; total: number; cost: number; createdAt: string; unit?: UnitId; invoiceId?: string; tax?: number; discount?: number; grossTotal?: number };
export type Purchase = { invoiceId?: string; netTotal?: number; id: string; productId: string; name: string; quantity: number; unitCost: number; total: number; createdAt: string; unit?: UnitId };
export type Expense = { id: string; name: string; total: number; createdAt: string };
export type Customer = { id: string; name: string; phone: string; balance?: number };
export type BusinessData = { customerCollections?: Settlement[]; supplierPayments?: Settlement[]; saleReturns?: SaleReturn[]; cashDays?: CashDay[]; productBatches?: ProductBatch[]; blockExpiredSales?: boolean; businessSettings?: BusinessSettings; shopActive?: boolean; shopId?: string; ownerName?: string; shopAddress?: string; shopPhotoUri?: string; shopRegisteredAt?: string; suppliers?: Supplier[]; purchaseDraft?: PurchaseDraft; purchaseInvoices?: PurchaseInvoice[]; products: Product[]; categories: string[]; sales: Sale[]; shopName: string; shopPhone?: string; paymentSettings?: PaymentSettings; purchases?: Purchase[]; expenses?: Expense[]; customers?: Customer[]; notificationReadSignature?: string; stockMovements?: StockMovement[]; saleDraft?: SaleDraft; invoices?: Invoice[]; payments?: Payment[] };
export const emptyBusiness: BusinessData = { products: [], categories: [], sales: [], shopName: "DokanX" };

export function addProduct(data: BusinessData, product: Product): BusinessData {
  if (typeof product.id !== "string" || !product.id.trim() || typeof product.name !== "string" || !product.name.trim() || !Number.isSafeInteger(product.price) || product.price < 0 ||
    !Number.isSafeInteger(product.cost) || product.cost < 0 || !validUnitSelection(product.unit, product.unitGroup) || !validQuantity(product.stock, product.unit) ||
    !validInventoryMetadata(product) || (product.photoUri !== undefined && (typeof product.photoUri !== "string" || !product.photoUri))) {
    throw new Error("invalidProduct");
  }
  if (data.products.some((item) => item.id === product.id)) throw new Error("duplicateProductId");
  if (product.barcode && data.products.some((item) => !item.deletedAt && item.barcode === product.barcode)) throw new Error("duplicateBarcode");
  return { ...data, products: [...data.products, product] };
}

export function recordSale(data: BusinessData, productId: string, quantity: number, id: string, createdAt: string): BusinessData {
  const product = data.products.find((item) => item.id === productId);
  if (!product || product.deletedAt || !validQuantity(quantity, product.unit, false) || quantity > product.stock) throw new Error("invalidQuantity");
  assertCashOpen(data, createdAt);
  const total = lineAmount(product.price, quantity), cost = lineAmount(product.cost, quantity);
  if (total === null || cost === null) throw new Error("invalidQuantity");
  return {
    ...data,
    productBatches: consumeBatches(data, productId, quantity, createdAt).productBatches,
    products: data.products.map((item) => item.id === productId ? { ...item, stock: (quantityTicks(item.stock)! - quantityTicks(quantity)!) / 1000 } : item),
    sales: [...data.sales, { id, productId, name: product.name, quantity, total, cost, createdAt, unit: product.unit ?? "piece" }],
  };
}

export function parseBusiness(raw: string | null): BusinessData {
  if (raw === null) return emptyBusiness;
  const data: BusinessData = JSON.parse(raw);
  const money = (value: number) => Number.isSafeInteger(value) && value >= 0;
  if (!data || !Array.isArray(data.products) || !Array.isArray(data.categories) || !Array.isArray(data.sales) ||
    typeof data.shopName !== "string" || data.categories.some((item) => typeof item !== "string") ||
    data.products.some((p) => !p || typeof p.id !== "string" || !p.id.trim() || typeof p.name !== "string" || typeof p.barcode !== "string" || typeof p.category !== "string" || !money(p.price) || !money(p.cost) || !validUnitSelection(p.unit, p.unitGroup) || !validQuantity(p.stock, p.unit) || !validInventoryMetadata(p) || (p.photoUri !== undefined && (typeof p.photoUri !== "string" || !p.photoUri))) ||
    new Set(data.products.map((p) => p.id)).size !== data.products.length ||
    data.sales.some((s) => !s || typeof s.id !== "string" || typeof s.productId !== "string" || typeof s.name !== "string" || !validQuantity(s.quantity, s.unit, false) || !money(s.total) || !money(s.cost) || [s.tax, s.discount, s.grossTotal].some((n) => n !== undefined && !money(n)) || (s.invoiceId !== undefined && typeof s.invoiceId !== "string") || typeof s.createdAt !== "string" || !Number.isFinite(Date.parse(s.createdAt)))) {
    throw new Error("invalidData");
  }
  const dated = (item: Expense) => item && typeof item.id === "string" && typeof item.name === "string" && money(item.total) && typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt));
  if ((data.purchases !== undefined && (!Array.isArray(data.purchases) || data.purchases.some((p) => !dated(p) || typeof p.productId !== "string" || !validQuantity(p.quantity, p.unit, false) || !money(p.unitCost) || p.total !== lineAmount(p.unitCost, p.quantity) || (p.invoiceId !== undefined && typeof p.invoiceId !== "string") || (p.netTotal !== undefined && !money(p.netTotal))))) ||
    (data.expenses !== undefined && (!Array.isArray(data.expenses) || data.expenses.some((e) => !dated(e)))) ||
    (data.customers !== undefined && (!Array.isArray(data.customers) || data.customers.some((c) => !c || typeof c.id !== "string" || typeof c.name !== "string" || typeof c.phone !== "string" || (c.balance !== undefined && !money(c.balance))))) ||
    (data.notificationReadSignature !== undefined && typeof data.notificationReadSignature !== "string") ||
    (data.stockMovements !== undefined && (!Array.isArray(data.stockMovements) || data.stockMovements.some((m) => !validMovement(m)) || new Set(data.stockMovements.map((m) => m.id)).size !== data.stockMovements.length))) throw new Error("invalidData");
  if (!validFinance(data) || !validBatchState(data) || (data.businessSettings !== undefined && !validBusinessSettings(data.businessSettings)) || !validShopState(data) || !validPurchasing(data) || !validPOS(data) || (data.shopPhone !== undefined && typeof data.shopPhone !== "string") || (data.paymentSettings !== undefined && !validPaymentSettings(data.paymentSettings))) throw new Error("invalidData");
  return data;
}

export function recordPurchase(data: BusinessData, purchase: Omit<Purchase, "name" | "total">): BusinessData {
  const product = data.products.find((p) => p.id === purchase.productId);
  if (!product || product.deletedAt || !validQuantity(purchase.quantity, product.unit, false) || !Number.isSafeInteger(purchase.unitCost) || purchase.unitCost < 0) throw new Error("invalidPurchase");
  const ticks = quantityTicks(product.stock)! + quantityTicks(purchase.quantity)!;
  const total = lineAmount(purchase.unitCost, purchase.quantity);
  if (!Number.isSafeInteger(ticks) || total === null) throw new Error("invalidPurchase");
  const weighted = (BigInt(quantityTicks(product.stock)!) * BigInt(product.cost) + BigInt(total) * 1000n + BigInt(ticks) / 2n) / BigInt(ticks);
  if (weighted > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("invalidPurchase");
  return { ...data, products: data.products.map((p) => p.id === product.id ? { ...p, stock: ticks / 1000, cost: Number(weighted) } : p), purchases: [...(data.purchases ?? []), { ...purchase, name: product.name, total, unit: product.unit ?? "piece" }] };
}



