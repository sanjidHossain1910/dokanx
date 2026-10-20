import type { BusinessData } from "./business.ts";
import { walletPhone } from "./paymentSettings.ts";

export type ShopDetails = { shopName: string; ownerName: string; shopPhone: string; shopAddress: string; shopPhotoUri?: string };
export function cleanShopDetails(input: ShopDetails): ShopDetails {
  const details = { ...input, shopName: input.shopName.trim(), ownerName: input.ownerName.trim(), shopPhone: walletPhone(input.shopPhone), shopAddress: input.shopAddress.trim() };
  if (!details.shopName || details.shopName.length > 160 || !details.ownerName || details.ownerName.length > 120 || details.shopAddress.length > 500 || (details.shopPhone && !/^\+?\d{7,15}$/.test(details.shopPhone))) throw new Error("invalidShop");
  return details;
}
export function validShopState(data: BusinessData) {
  if (data.shopActive !== undefined && typeof data.shopActive !== "boolean") return false;
  if ([data.shopId, data.ownerName, data.shopAddress, data.shopPhotoUri, data.shopRegisteredAt].some((value) => value !== undefined && (typeof value !== "string" || !value.trim()))) return false;
  if (data.shopRegisteredAt && !Number.isFinite(Date.parse(data.shopRegisteredAt))) return false;
  if (data.shopActive === true) {
    try { cleanShopDetails({ shopName: data.shopName, ownerName: data.ownerName ?? "", shopPhone: data.shopPhone ?? "", shopAddress: data.shopAddress ?? "" }); }
    catch { return false; }
    if (!data.shopId || !data.shopRegisteredAt) return false;
  }
  return true;
}
export function saveShopDetails(data: BusinessData, input: ShopDetails, id: string): BusinessData {
  const details = cleanShopDetails(input);
  if (!id.trim()) throw new Error("invalidShop");
  return { ...data, shopId: data.shopId ?? id, shopName: details.shopName, ownerName: details.ownerName, shopPhone: details.shopPhone,
    shopAddress: details.shopAddress || undefined, shopPhotoUri: details.shopPhotoUri, shopActive: data.shopActive === true };
}
export function activateShop(data: BusinessData, stamp: string): BusinessData {
  const next = { ...data, shopActive: true, shopRegisteredAt: data.shopRegisteredAt ?? stamp };
  if (!validShopState(next)) throw new Error("invalidShop");
  return next;
}
