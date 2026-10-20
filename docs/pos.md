# Sales and POS implementation

Implemented the supplied four-screen reference as a product selection, cart, payment and receipt flow inside the existing Sales tab. Actual inventory supplies product cards; no demo records are seeded into a shop.

## Completed behavior

- Product search by name, ID or barcode; dynamic category filters; responsive virtualized grid; stock colors and quantity limits; camera barcode input with the existing feedback provider.
- Persistent cart draft, per-unit fractional quantity editing, remove/clear actions, customer selection and inline customer creation.
- Fixed or percentage discount, optional tax defaulting to zero and exact integer-minor-unit calculations. Largest-remainder allocation keeps discounted/taxed line records consistent with the invoice, including many tiny lines.
- Cash, manually recorded bKash/Nagad/Card, full due and partial payment. Due requires a customer; outstanding balance is shown in the existing Customers screen. Digital methods are explicitly not gateway-verified.
- Stock revalidation, stable UUID invoice identity, local-business-date invoice number, idempotent completion and protection against double submission. No stock is reserved/reduced merely by adding a cart item.
- Receipt snapshots preserve shop/customer names, product names, unit selling prices, checkout-time costs, quantities, adjustments, payment and change/due.
- FlatList sales history with today/week/month/custom inclusive local-date filters and invoice/customer search. Earlier single-product sales remain visible with an explicit indication that payment/invoice details were not recorded.
- English/Bangla text and localized monetary display through the existing translation/theme providers. Reduced-motion-aware animations. Selection/cart/payment retain the existing five-tab bar and center Sales button. Tap Sales to open product selection; long press opens quick actions using the existing shared sheet component. The old permanently mounted quick-actions sheet was removed from the tab bar so it cannot cover navigation while closed.
- Native receipt print uses Expo Print; native PDF sharing uses Expo Print + Expo Sharing. The browser prints an isolated receipt document and reports file sharing as unavailable. No fake printing/sharing/payment success is reported.

## Database changes

The existing `business_state` SQLite snapshot remains the persistence boundary. Optional backward-compatible fields were added for `saleDraft`, `invoices`, `payments` and shop phone; customer balance and sale tax/discount/invoice linkage were added. POS stock movements reference the invoice. Older local records still load without these fields.

One SQLite INSERT/UPDATE commits the full next snapshot: stock, invoice/items, sale reporting lines, payment, customer balance, stock movements and draft removal. SQLite's implicit transaction makes that single statement atomic. The provider publishes the new in-memory state only after the database write succeeds. A failed write leaves the prior snapshot and draft intact. A trigger-aborted-write test verifies rollback against SQLite itself.

The existing repository migration, product IDs, archived deletions and offline storage are retained. Current POS quantities use the product's selling unit and are never silently converted. Product photos referenced by a draft or receipt are retained when a product image is edited. Cloud sync/backup remains deferred as recorded in `future-plans.md`.

## Files created

- `app/(tabs)/sales/_layout.tsx`, `index.tsx`, `cart.tsx`, `payment.tsx`, `receipt.tsx`, `history.tsx`: nested Sales stack; replaces the old single `app/(tabs)/sales.tsx` entry.
- `components/pos/ProductSelection.tsx`, `Cart.tsx`, `CartItem.tsx`, `CustomerSelector.tsx`, `Payment.tsx`, `Receipt.tsx`, `History.tsx`, `Shared.tsx`: reusable UI and flow.
- `src/store/pos.ts`, `usePOS.ts`, `salesHistory.ts`, `receipt.ts`, `receiptOutput.ts`, `receiptOutput.web.ts`: business rules, persisted draft actions, date filtering, escaped receipt HTML and platform output.
- `src/i18n/resources/pos.ts`: complete English/Bangla POS labels and errors, included from the existing `en.ts` / `bn.ts` resources.
- `tests/pos.test.mjs`: cart, payment, financial allocation, persistence, rollback, history-date and receipt-escaping regression coverage.
- `docs/pos.md`: implementation and validation report.

## Files modified

- `components/business/Sales.tsx`: compatibility export for the new selection screen.
- `src/store/business.ts`, `inventory.ts`: optional POS entities/metadata and persistence validation.
- `src/dashboard/selectors.ts`, `components/business/Dashboard.tsx`, `src/i18n/resources/en.ts`, `bn.ts`: preserve existing reporting and exclude collected tax from profit.
- `components/business/ProductForm.tsx`: retain photo files referenced by persisted POS drafts/invoices.
- `app/business/customers.tsx`: show outstanding balances.
- `components/navigation/CustomTabBar.tsx`, `FloatingButton.tsx`: direct Sales action and long-press quick actions, preserving the existing tab component/icons.
- `package.json`, `package-lock.json`, `app.json`: SDK-compatible Expo Print and Sharing; Sharing config plugin.

## Verification and practical limits

TypeScript, lint and 50 tests passed. POS tests cover fractional stock, fixed/percentage discounts and tax, allocation rounding, cash/change, full/partial due, manual digital payments, stock changes during checkout, idempotency, invoice/payment/movement references, historical snapshots and tax-free profit. Real SQLite tests cover atomic successful commits and a database-trigger-aborted write retaining the old stock/draft.

Web and Android production bundle exports passed. The browser preview uses port 8095, isolated from the phone and other preview origins. Browser verification completed product selection → cart → cash payment → receipt, with a reloaded draft; subtotal 270 BDT, discount 20, tax 25, payable 275, received 300 and change 25. A second sale of 120 BDT with 20 paid recorded 100 due against the selected customer's account. History search and inclusive custom-date filtering returned both saved invoices; the dashboard showed 395 billed and 110 profit excluding collected tax. An insufficient cash payment disabled completion, and browser file sharing reported its actual unsupported state.

Native camera scanning, physical printer compatibility and the native OS PDF share sheet still require a device test. No payment gateway, Bluetooth/ESC-POS printer driver, due-collection workflow, cloud synchronization or remote backup was added. System print dialogs may offer compatible printers or PDF output; selecting a payment method never performs a network payment.

A third cash sale of 30 BDT completed with the preview server stopped. After restarting the server and reopening its receipt, the saved invoice was still available. These test products, customers and transactions exist only in the isolated browser preview storage. This verifies the loaded web application's offline checkout and persistence; native airplane-mode behavior still requires a device test.

Bangla text and light/dark themes were checked in the browser. Product selection and cart were checked at 320 px without horizontal page overflow; screenshots below use a 360 px viewport. Receipt details and output actions remain accessible by scrolling.

## Preview screenshots

- [Product selection — light](previews/pos-selection-light.png)
- [Cart — light](previews/pos-cart-light.png)
- [Payment — dark](previews/pos-payment-dark.png)
- [Completed sale and receipt — light](previews/pos-receipt-light.png)

## Quantity and wallet setup update

Product selection now opens a quantity sheet before adding an item, including products opened from Inventory or matched by the barcode camera. Count/package units show minus/plus controls and a whole-number input; weight/volume/length/area/time units accept decimals in the product's configured unit. The sheet shows remaining available stock after the existing cart quantity and the additional line amount. One action adds the chosen quantity, and the core validates current stock again when saving.

Profile now hosts reusable bKash/Nagad setup cards. Each method can be enabled or disabled independently, with a Bangladesh account number and gallery QR image required when enabled. QR selection now offers full-image display or a user-approved crop/rotation in the editor. A large square preview and fullscreen viewer preserve the image aspect ratio on a white background. Native QR files live in the app's document `payment-qr/` directory; web previews persist the image as a data URI. Cancelled selections and failed saves retain the old configuration. Cash/due remain available; Card is hidden from new checkout, while historical Card receipts remain readable.

Checkout lists only enabled wallet methods and shows the selected account number and QR image. Core checkout also rejects unconfigured or disabled wallets. This remains a manual payment record: the shopkeeper confirms receipt of funds. Account/login onboarding is still deferred; connect the reusable setup component there when that existing placeholder flow is implemented. Future backup must include the wallet settings and QR files, as recorded in `future-plans.md`.

Added `components/pos/QuantityPicker.tsx`, `components/business/PaymentSettings.tsx`, `src/store/paymentSettings.ts` and `src/store/paymentQr.ts`. Updated selection, payment, Profile, business persistence validation, POS error handling, EN/BN text and POS regression tests. The expanded suite has 52 passing tests, including bulk quantities, remaining-stock rejection, wallet validation/persistence and enabled-method checkout guards.

Browser verification for this update: selected two pieces using plus/minus (240 BDT), saved them in one action, then added 2.5 kg entered as Bangla digits (200 BDT). Combined draft total was 440 BDT. Enabling bKash without details showed validation; a test account number and gallery image saved successfully and reappeared after reload. Checkout showed bKash with that number/image and omitted disabled Nagad and Card. The gallery test used an existing screenshot as an isolated UI fixture, not a live merchant payment QR; no money was transferred.

- [Piece quantity picker](previews/pos-quantity-picker.png)
- [Weight quantity picker](previews/pos-weight-quantity.png)
- [Wallet checkout with test image](previews/pos-wallet-payment.png)

Final validation for this update: TypeScript, lint, all 52 tests, web production export and Android Hermes production export passed. Physical-device gallery selection and QR readability with an actual wallet QR still need a device check.

For the later supplied wallet logos, QR editor/fullscreen viewer and inline custom amount update, see [payment-qr.md](payment-qr.md).
