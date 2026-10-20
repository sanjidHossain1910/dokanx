import { useCallback, useMemo, useRef, useState } from "react";
import { useBusiness } from "./BusinessProvider";
import type { BusinessData } from "./business";
import { purchaseTotals } from "./purchasing";

export function usePurchasing() {
  const store = useBusiness();
  const { update } = store;
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState("");
  const lock = useRef(false);
  const calculation = useMemo(() => {
    try { return { totals: store.data.purchaseDraft ? purchaseTotals(store.data.purchaseDraft) : null, error: "" }; }
    catch (cause) { return { totals: null, error: cause instanceof Error ? cause.message : "invalidTotals" }; }
  }, [store.data.purchaseDraft]);
  const run = useCallback(async (change: (data: BusinessData) => BusinessData) => {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setIssue("");
    try { await update(change); return true; }
    catch (cause) { const message = cause instanceof Error ? cause.message : ""; setIssue(["invalidBatch", "cashDayClosed", "invalidTotals", "invalidDraft", "invalidDiscount", "invalidItem", "emptyItems", "invalidSupplier", "supplierRequired", "invalidPayment", "productChanged", "receiptMissing"].includes(message) ? message : "saveFailed"); return false; }
    finally { lock.current = false; setBusy(false); }
  }, [update]);
  return { ...store, draft: store.data.purchaseDraft, totals: calculation.totals, totalError: calculation.error, busy, issue, setIssue, run };
}

