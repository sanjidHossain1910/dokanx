# Smart restock

Open from Home, Products or Purchase. The route also respects the optional Sales & Profit lock. Forecasting is local and read-only; a buy list is separate from a purchase draft and from inventory.

## Controls

- Shop plan: 30/60/90 complete days of history, 1–90 days of target stock, 0–30 days each for delivery and safety stock, optional BDT budget.
- Product rules: purchase multiple in the product's existing unit; optional delivery override, shelf life after receipt, maximum suggested quantity and preferred supplier.
- Buy list: editable quantities, including fractional units. Manual quantities need not equal a forecast or purchase multiple. A recalculation never edits the saved list.

## Offline estimate

Use canonical sale rows once, excluding invoice snapshots, drafts and future events. Returns reduce the original sale's demand. Use matched-unit inventory movements for POS sales, received purchases, returns and adjustments; legacy sale/purchase rows fill the paths that have no movements. Reconstruct day openings/closings backwards from current stock. Complete days with no stock and no sales are excluded. Days with sales that run out of stock remain observed lower bounds and reduce confidence; lost demand is unknown.

Today immediately changes current stock, but is not a complete observation day. At least seven available days and three distinct selling days are required for an automatic quantity. Inconsistent or insufficient histories remain manual. Time-based services also remain manual.

The baseline is net quantity divided by days with stock. With at least 14 observed days and three recent available days, blend 60% recent seven-day rate and 40% baseline, bounded to 0.5–1.5 times the baseline. This is an estimate, not a confidence probability or a learned AI model.

Initial need = daily estimate × (target days + delivery days + safety days) − usable stock − pending orders. Expired physical stock is excluded. Pending orders have no promised arrival date in the current data model, so the UI requests supplier confirmation. Unsent purchase drafts are displayed separately. Apply purchase multiples, optional shelf-life and maximum-order caps. An optional budget allocates whole purchase multiples to more urgent products first. Missing/zero costs must be reviewed; such products do not consume an assumed free budget allocation.

Near-expiry batches are flagged for review; future spoilage, seasonality, promotions, closures and unrecorded lost sales cannot be inferred reliably from current data. Sparse/new products do not receive invented demand. Confidence labels describe evidence coverage, not validated prediction accuracy.

## Persistence and purchasing

`BusinessData.restock` version 1 stores settings, product rules and the buy list. It is included in native SQLite storage and existing `.dokanx` backups. Rules/list lines retain their saved unit after product edits; stale entries require review and can always be removed.

Starting a purchase requires an explicit supplier and selected list items. It validates the current plan, product units and safe purchase totals. One immutable update creates the draft and removes only transferred items. It refuses to replace an existing draft. This does not pay, receive stock or record a purchase invoice. A supplier can be changed and prices reviewed in the existing purchase flow.

## Future online AI

`src/restock/prediction.ts` defines a versioned aggregate input, revision fingerprint, source-tagged response, provider interface, cancellation/deadline and validation. The UI says AI is unconnected. There is no live endpoint, data sharing, provider secret or generated prediction in the current app.

A future opt-in server integration must keep provider credentials off-device and exclude customer/owner identity, contact information, payment data, PINs and photos. Its responses must match the current input revision, units, freshness and local order/expiry/budget limits. Failed, cancelled or stale requests leave offline results usable. Remote predictions remain suggestions and never edit a manual list automatically. Validate performance against subsequent realised demand before claiming an accuracy improvement.
