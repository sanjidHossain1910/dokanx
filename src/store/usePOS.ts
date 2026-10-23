import { useCallback, useMemo, useState } from "react";
import { useBusiness } from "./BusinessProvider";
import type { BusinessData } from "./business";
import { cartTotals } from "./pos";

const errors = ["invalidPriceType", "wholesaleUnavailable", "invalidHeldSale", "heldMissing", "heldChanged", "activeSaleExists", "heldProductChanged", "cashDayClosed", "expiredStock", "stockUnavailable", "invalidCart", "invalidTotals", "invalidDiscount", "invalidPayment", "walletUnavailable", "customerRequired", "duplicateInvoice", "invalidCustomer", "duplicateCustomer", "productNotFound", "invalidQuantity", "invalidRate"];
export function usePOS() {
  const store = useBusiness();
  const { update } = store;
  const [pending, setPending] = useState(0);
  const [issue, setIssue] = useState("");
  const draft = store.data.saleDraft;
  const calculation = useMemo(() => {
    try { return { totals: draft ? cartTotals(draft) : { lines: [], subtotal: 0, discount: 0, tax: 0, total: 0 }, error: "" }; }
    catch (cause) { return { totals: null, error: cause instanceof Error ? cause.message : "invalidTotals" }; }
  }, [draft]);
  const run = useCallback(async (change: (current: BusinessData) => BusinessData) => {
    setPending((n) => n + 1); setIssue("");
    try { await update(change); return true; }
    catch (cause) { const message = cause instanceof Error ? cause.message : ""; setIssue(message === "emptyCart" ? "emptyCartError" : errors.includes(message) ? message : "saveFailed"); return false; }
    finally { setPending((n) => n - 1); }
  }, [update]);
  return { ...store, draft, totals: calculation.totals, totalError: calculation.error, run, issue, setIssue, busy: pending > 0 };
}
