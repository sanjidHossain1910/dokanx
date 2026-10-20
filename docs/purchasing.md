# Purchase workflow

The supplied six-screen reference is implemented as a nested purchase flow, using the existing theme, language, business repository, custom header, product form, camera and receipt-output modules. Existing Home purchase actions and inventory purchase links still open `/business/purchases`. No sample suppliers or products are seeded into a shop.

## Screens

1. Purchase list: virtualized records, invoice/supplier/product search, All/This Month/Pending/Received filters and newest/oldest/amount sorting. Receipt status and payment status are separate. Older single-product purchases remain readable without fabricated supplier/payment data.
2. Supplier selection: saved suppliers, search and inline creation with optional phone/address. Selection and outstanding supplier balances are stored locally.
3. Product selection: searchable inventory/category grid, barcode camera input, per-unit quantity and purchase-price editing, count controls, and saved purchase draft. Out-of-stock products can be purchased. Selecting a purchase item does not change stock.
4. New product: reuses the existing camera/gallery, square cropped preview and 1 MB photo preparation, category creation, unit selection and stable product ID. The add-to-purchase switch saves the new product with zero live stock and optionally adds the entered quantity to the purchase draft in the same repository update.
5. Summary/payment: item editing, fixed/percentage discount, transport and other costs, received/pending goods, full/partial/due payment, Cash/bKash/Nagad/Bank/Other method, reference and note. Payments are manual supplier-payment records, not money transfers. The shop's incoming wallet QR settings are not used to pay suppliers.
6. Success/receipt: immutable financial/product/supplier snapshots, stable invoice ID and readable purchase number, received/pending status, print/PDF share, new purchase/history actions. Pending goods can be marked received once from their receipt.

Screens have English/Bangla labels, shared light/dark colors, safe-area handling and scrolling. Purchase pages are opened from the existing dashboard/navigation and use the custom header; no duplicate tab navigator was introduced.

## Persistence and accounting

Added optional `suppliers`, `purchaseDraft` and `purchaseInvoices` collections to the existing business snapshot. Purchase rows now optionally contain `invoiceId` and `netTotal`; purchase stock movements contain `purchaseId`. Older data remains valid. Stable IDs, snapshot validation and retained product/photo references preserve future backup requirements.

Completion writes invoice, supplier due balance, draft removal and (for received goods) product stock, weighted average cost, purchase rows and stock movements as one snapshot. The existing SQLite repository's single write remains the atomic boundary. The provider publishes state only after a successful write. Duplicate completion and duplicate receive are idempotent.

Pending invoices do not change stock or create received purchase rows. Receiving later revalidates current product identity/unit and commits all receipt changes together without charging the supplier balance again. Deleted products or changed units block receipt rather than silently updating another product.

Discounts and extra costs are allocated exactly among invoice lines using integer minor currency units. Landed line costs feed weighted average product costs; previous sales retain their historical costs. Dashboard Purchase totals count invoice totals on their recorded date plus earlier unlinked purchases, avoiding duplicate counting on goods receipt. Supplier due collection/settlement and partial goods deliveries are outside this change.

## Files

- New routes: `app/business/purchases/_layout.tsx`, `index.tsx`, `suppliers.tsx`, `items.tsx`, `add-product.tsx`, `summary.tsx`, `receipt.tsx`; replace the old `app/business/purchases.tsx` entry while preserving its URL.
- New UI: `components/purchase/List.tsx`, `Suppliers.tsx`, `Products.tsx`, `ItemEditor.tsx`, `Summary.tsx`, `Receipt.tsx`, `Shared.tsx`.
- New core: `src/store/purchasing.ts`, `usePurchasing.ts`, `purchaseReceipt.ts`.
- New translations/tests: `src/i18n/resources/purchase.ts`, `tests/purchasing.test.mjs`.
- Modified: `src/store/business.ts`, `inventory.ts`, `src/dashboard/selectors.ts`, `components/business/ProductForm.tsx`, existing `en.ts`/`bn.ts` resources, `docs/future-plans.md`.

## Verification

TypeScript, lint, all 60 tests and Web/Android production exports passed. Eight purchase tests cover supplier/draft validation, decimal/count quantities, exact discounts/charges, weighted costs, supplier balances, pending/received semantics, duplicate retries, changed/deleted products, legacy data, corrupt links, escaped receipt HTML and a real SQLite trigger-aborted write retaining the old draft/stock.

Browser verification used only the isolated port-8095 preview store:

- Created a supplier, selected 2.5 kg Rice at 70 BDT and 5 Chips at 20 BDT, and created Cooking Oil with 3 litres at 150 BDT directly into the draft. Oil stock remained zero until completion.
- Completed a received purchase: subtotal 725, discount 50, transport 60, payable 735, paid 300, supplier due 435 BDT. Stock became Rice 12.5 kg, Chips 8 pieces, Oil 3 litres; the receipt survived reload.
- Recorded a pending, full-due purchase for another 1 kg at 70 BDT. Rice stayed at 12.5 kg while pending. Receiving it later changed stock to 13.5 kg, and supplier balance remained 505 BDT (435 + 70).
- Pending filtering and product-name history search returned the expected records. Bangla/Dark and English/Light layouts were checked. The new product form had no horizontal page overflow at 360 px. Browser sharing reported its unsupported state honestly.

Native camera/gallery, physical printer compatibility and the native PDF share sheet still require real-device testing. No backend, gateway, authentication or cloud backup was added.

## Screenshots

- [Purchase list — light](previews/purchase-list-light.png)
- [Purchase list — dark](previews/purchase-list-dark.png)
- [Supplier selection](previews/purchase-supplier-light.png)
- [Product selection](previews/purchase-items-light.png)
- [New product](previews/purchase-add-product-light.png)
- [Summary/payment](previews/purchase-summary-light.png)
- [Receipt — light](previews/purchase-receipt-light.png)
- [Receipt — dark](previews/purchase-receipt-dark.png)
