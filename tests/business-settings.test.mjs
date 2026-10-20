import assert from "node:assert/strict";
import test from "node:test";
import { addProduct, emptyBusiness, parseBusiness } from "../src/store/business.ts";
import { defaultBusinessSettings, formatBusinessDate, validBusinessSettings } from "../src/store/businessSettings.ts";
import { addCartProduct, completeSale } from "../src/store/pos.ts";
import { emptyPaymentSettings, saveWalletAccount, validPaymentSettings } from "../src/store/paymentSettings.ts";
import { receiptHTML } from "../src/store/receipt.ts";

test("business settings validate and round trip while legacy records still load", () => {
  assert.equal(validBusinessSettings(defaultBusinessSettings), true);
  assert.deepEqual(parseBusiness(JSON.stringify({ ...emptyBusiness, businessSettings: defaultBusinessSettings })).businessSettings, defaultBusinessSettings);
  assert.equal(parseBusiness(JSON.stringify(emptyBusiness)).businessSettings, undefined);
  for (const value of [{ invoicePrefix: "a<script>" }, { defaultDiscountPercent: 10001 }, { defaultDiscountPercent: 1.5 }, { lowStockDefault: -1 }, { lowStockDefault: 0.5 }, { dateFormat: "invalid" }, { hour12: "yes" }, { receiptFooter: "x".repeat(201) }]) {
    assert.throws(() => parseBusiness(JSON.stringify({ ...emptyBusiness, businessSettings: { ...defaultBusinessSettings, ...value } })), /invalidData/);
  }
});
test("new sale defaults do not rewrite a current cart or historical receipt", () => {
  const base = addProduct(emptyBusiness, { id: "p", name: "Product", barcode: "", category: "", stock: 5, price: 10000, cost: 7000 });
  const current = addCartProduct(base, "p", "draft-old");
  const settings = { ...defaultBusinessSettings, defaultDiscountPercent: 1000, invoicePrefix: "DX", receiptFooter: "Thank you <shop>" };
  const changed = { ...current, businessSettings: settings };
  assert.deepEqual(addCartProduct(changed, "p", "ignored").saleDraft.discount, { kind: "fixed", value: 0 });
  const fresh = addCartProduct({ ...base, businessSettings: settings }, "p", "draft-new");
  assert.deepEqual(fresh.saleDraft.discount, { kind: "percent", value: 1000 });
  const saved = completeSale(fresh, fresh.saleDraft.id, { method: "cash", received: 9000, note: "", reference: "", createdAt: "2026-10-20T10:00:00Z" });
  assert.match(saved.invoices[0].invoiceNumber, /^DX-/);
  assert.equal(saved.invoices[0].total, 9000);
  const next = { ...saved, businessSettings: defaultBusinessSettings };
  assert.equal(next.invoices[0].receiptFooter, settings.receiptFooter);
  const print = receiptHTML(next.invoices[0], "en", (key) => key);
  assert.match(print, /<footer>Thank you<\/footer>/);
  assert.doesNotMatch(print, /Thank you &lt;shop&gt;/);
  assert.equal(parseBusiness(JSON.stringify(next)).invoices[0].receiptFooter, settings.receiptFooter);
});
test("date preferences format local dates and Bangla digits without changing stored dates", () => {
  const date = new Date(2026, 9, 20, 15, 5);
  assert.equal(formatBusinessDate(date, "en", { ...defaultBusinessSettings, dateFormat: "dmy" }, false), "20/10/2026");
  assert.equal(formatBusinessDate(date, "bn", { ...defaultBusinessSettings, dateFormat: "ymd" }, false), "২০২৬-১০-২০");
  assert.match(formatBusinessDate(date, "en", { ...defaultBusinessSettings, dateFormat: "ymd", hour12: false }), /2026-10-20, 15:05/);
});
test("only one enabled wallet can be default, and disabling clears its default flag", () => {
  const bkash = saveWalletAccount(emptyPaymentSettings, "bkash", { enabled: true, phone: "01712345678", isDefault: true });
  const nagad = saveWalletAccount(bkash, "nagad", { enabled: true, phone: "01812345678", isDefault: true });
  assert.equal(nagad.bkash.isDefault, false);
  assert.equal(nagad.nagad.isDefault, true);
  assert.equal(bkash.bkash.isDefault, true);
  const disabled = saveWalletAccount(nagad, "nagad", { ...nagad.nagad, enabled: false });
  assert.equal(disabled.nagad.isDefault, false);
  assert.equal(validPaymentSettings(disabled), true);
  assert.equal(validPaymentSettings({ bkash: { ...bkash.bkash, isDefault: true }, nagad: { ...nagad.nagad, isDefault: true } }), false);
});
