# Future plans — recorded user preferences

Recorded on 2026-10-20 at the user's request.

## Backend backup, restore and device transfer

The user wants to connect DokanX to a backend later so shop data can be backed up and restored on another device. Local file backup and restore were subsequently approved with the operations feature design. Backend authentication, cloud backup and remote synchronization are still deferred.

The future backup should include product details and IDs, photos, categories, units, quantities, thresholds, sales, purchases, expenses, customers, stock movement history and relevant shop settings. Restoring on another device must retain transaction relationships and product identities.

Preserve the offline-first repository boundary and stable IDs. Existing timestamps, deletion markers and repository revisions can support future synchronization, but a complete sync protocol and conflict policy have not been designed yet.

Product photos must be transferred as files or backend-managed assets. Current device-local photo URIs are not portable; a future restore must download/import photos into the destination device's app storage and rebuild the local references.

Future implementation should use versioned backup data and migrations, validate restores before replacing local data, avoid duplicate records on retry and preserve history. Backend provider, account/shop ownership, backup scheduling, encryption and conflict handling remain decisions for that future task.

Current status: native local persistence with manual, versioned `.dokanx` file backup/restore. Backups include photos and wallet QR files, drafts, history, business settings and language/appearance preferences. Restore validates references and asset hashes, stages new assets under a unique document folder, then atomically replaces the shop payload. A safety backup is created first and stale reviews cannot overwrite newer changes. No cloud backup or remote synchronization is enabled. Bluetooth printer addresses are device-specific and deliberately cleared on restore.

The app now targets Android phones and iPhone only. Native SQLite/document storage remains the persistence boundary; browser-only storage and UI adapters are no longer maintained. Preserve the native database and document-file migration requirements above when adding future backups.

Profile settings add `businessSettings` (invoice prefix/message, default sale discount, new-product low-stock limit and date/time display preferences), wallet `isDefault` flags and an optional invoice `receiptFooter` snapshot. Future backup/restore must preserve these along with existing identity and payment data. Appearance and language continue to use their existing local preference keys.

Printed receipts now follow the user's smaller fixed format: shop name, Transaction ID, original sale/purchase date/time, products with quantities and prices, total, then `Thank you`. Old footer snapshots remain in historical data but are not printed. Payment, customer, contact, tax and discount sections are omitted from printed receipts.

Operations data adds immutable `customerCollections`, `supplierPayments`, `saleReturns`, `cashDays` and remaining `productBatches`, with optional invoice batch allocations and purchase batch metadata. Keep stable IDs and allocation links intact in future cloud migrations. Returns leave original invoice/sale snapshots unchanged; reports net out returns on the return date. Expired lots are excluded from sales by default; batch assignment labels existing stock, while received purchases add stock and lots together.

Offline shop registration now stores `shopId`, `shopActive`, owner name, contact number, address, shop photo URI and registration timestamp. Future backups must preserve that identity and registration state, transfer the shop's `SHOP-` photo file from `product-photos/`, and rebuild its URI. Login/signup are currently replaced by this local setup flow; it does not create a backend account. Wallet account names are now optional saved metadata, and an enabled wallet requires a valid phone number while QR images are optional.

Payment setup now also contains enabled bKash/Nagad methods, account numbers and QR images. Future backup/restore must include these settings and transfer QR files from `payment-qr/`, rebuilding local URIs on the destination device. The reusable payment setup currently lives in Profile; connect it to account onboarding when that flow is implemented. Card support is deferred.

Purchasing now also stores suppliers with outstanding balances, a purchase draft, immutable supplier/product invoice snapshots, payment details, receipt status and stock movement links. Future backup/restore must retain supplier and purchase invoice IDs and these relationships. Purchase draft/receipt photos reuse retained product photo files. Pending invoices must remain pending after restore and must not receive stock twice.
