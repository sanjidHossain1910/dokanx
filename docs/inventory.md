# Products and inventory implementation

The supplied shared ChatGPT design URL returned an error page in the connected browser. The accompanying specification was used for layout and behavior; pixel matching to that unavailable image is not claimed.

## Screens and components

- `components/business/Products.tsx`: virtualized product cards, name/ID/barcode search, exclusive stock filters with live counts, category filtering, sorting, empty states and the existing tab bar.
- `components/business/ProductForm.tsx`: shared add/edit form with required category, inline category creation, prices, selected selling unit, threshold, description and inline validation. Retains the existing camera, square crop, preview, photo size limit and barcode input scanner.
- `app/inventory/add-product.tsx`: add form entry point.
- `app/inventory/edit-product.tsx`: loads the selected product into the shared form.
- `app/inventory/product.tsx`: owner details, square photo, fixed bottom actions and stock adjustment history.
- `app/inventory/update-stock.tsx`: add/remove/set quantity, exact new-stock preview, optional reason/notes and persisted audit record.
- `components/business/ProductActions.tsx`, `InventorySheet.tsx`, `StockBadge.tsx`: theme-aware menus, explicit deletion confirmation and status labels.
- `components/business/Screen.tsx`: keyboard avoidance and optional safe-area footer.

## Data and compatibility

- `src/store/inventory.ts`: product editing, archived deletion, individual stock thresholds and audited stock adjustments. Fractional quantities use the existing fixed-point unit helpers. Unit changes require zero stock to avoid reinterpreting inventory silently.
- `src/store/business.ts`: validates new optional metadata/history, retains compatibility with legacy records and rejects sales/purchases of deleted products.
- `src/store/sqliteRepository.ts`: atomic SQLite snapshot repository with revision and update timestamp. Keeps the existing serialized business-state contract, avoiding separate commits for stock and its history.
- `src/store/repository.native.ts`: Expo SQLite for Android/iOS. Imports the existing AsyncStorage record once and retains that original record as a recovery backup. Corrupt legacy data is surfaced instead of reset. No cloud synchronization is performed.
- `src/store/repository.ts`: existing browser AsyncStorage adapter retained; Expo SQLite web requires additional cross-origin isolation and WASM hosting that this app does not currently configure.
- `src/dashboard/selectors.ts`, `components/business/Dashboard.tsx`, `components/dashboard/HomeDashboard.tsx`, `components/business/Sales.tsx`, `app/business/purchases.tsx`, `app/(scanner)/product.tsx`: exclude archived products from active inventory and use product thresholds where relevant. Historical transactions remain intact.
- `src/i18n/resources/inventory.ts`, `en.ts`, `bn.ts`: new English/Bangla text integrated into the existing i18n system.
- `package.json`, `package-lock.json`, `app.json`: SDK-compatible `expo-sqlite` dependency/plugin.

Stable product IDs are never reused. Deletion requires UI confirmation and retains the product identity, previous sales, purchases and adjustments for audit/future synchronization. Product photos stay in persistent native app storage. No demo inventory is injected into a real shop.

## Validation

TypeScript and lint passed. The test suite has 41 passing tests, including stock status boundaries, fractional adjustments, invalid/negative quantities, identity-preserving edits, historical values after edit/delete, persistence validation and real SQLite migration/read/write tests using Node's SQLite engine.

Production web and Android bundle exports succeeded. A bundle export is not an installed APK or physical-device test.

An isolated browser preview on port 8094 was used at 360px width to create a category/product, confirm fractional stock previews and history, edit a Bangla product name and selling price, verify persistence after reload and check deletion confirmation without deleting the product. Final save feedback and back navigation to Products were also verified. Language changes updated the module immediately; both palettes, case-insensitive ID search, filter sheets and a translated low-stock empty state were checked. These records belong only to that preview origin. Native camera/gallery and Expo SQLite execution on an actual phone remain device checks.

Saved previews: [Light](previews/inventory-light.png), [Dark](previews/inventory-dark.png). The pictured product is an isolated test record, not seeded shop inventory.
