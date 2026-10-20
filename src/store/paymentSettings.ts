import { normalizeNumericInput } from "./productUnits.ts";

export type WalletMethod = "bkash" | "nagad";
export type WalletAccount = { enabled: boolean; phone: string; qrUri?: string; accountName?: string; isDefault?: boolean };
export type PaymentSettings = Record<WalletMethod, WalletAccount>;
export const emptyPaymentSettings: PaymentSettings = { bkash: { enabled: false, phone: "" }, nagad: { enabled: false, phone: "" } };
export function walletPhone(input: string) {
  return normalizeNumericInput(input).replace(/[\s()-]/g, "").replace(/^(\+88|88)(?=01)/, "");
}
export function validWalletAccount(account: WalletAccount) {
  return !!account && typeof account.enabled === "boolean" && typeof account.phone === "string" &&
    (account.phone === "" || /^01[3-9]\d{8}$/.test(account.phone)) &&
    (account.qrUri === undefined || typeof account.qrUri === "string" && /^(file:\/\/|data:image\/(png|jpeg);base64,)/.test(account.qrUri)) &&
    (account.accountName === undefined || typeof account.accountName === "string" && account.accountName.length <= 120) &&
    (account.isDefault === undefined || typeof account.isDefault === "boolean" && (!account.isDefault || account.enabled)) &&
    (!account.enabled || !!account.phone);
}
export function validPaymentSettings(settings: PaymentSettings) {
  return !!settings && validWalletAccount(settings.bkash) && validWalletAccount(settings.nagad) && !(settings.bkash.isDefault && settings.nagad.isDefault);
}
export function saveWalletAccount(settings: PaymentSettings, method: WalletMethod, account: WalletAccount): PaymentSettings {
  const next = { ...settings, [method]: { ...account, isDefault: account.enabled && !!account.isDefault } };
  if (next[method].isDefault) {
    const other = method === "bkash" ? "nagad" : "bkash";
    next[other] = { ...next[other], isDefault: false };
  }
  if (!validPaymentSettings(next)) throw new Error("walletInvalid");
  return next;
}
