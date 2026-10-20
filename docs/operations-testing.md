# Operations feature checks

Use a spare test shop or keep a backup of the current shop before manual testing.

- Customer: make a due sale, open Customers → ledger, collect a partial amount, confirm the remaining balance and original receipt. Retrying the same transaction must not collect twice.
- Supplier: make a partial/due purchase, open Purchase → Supplier ledger, record a payment and check invoice remaining due. Pending receipt status must not change when paying a supplier.
- Return: open Sales history → receipt → Return products. Try fractional units, a partly paid invoice, a second return, and a damaged item with restocking disabled. Confirm refund/due reduction, inventory and net daily sales/profit.
- Cash: open Reports/Profile → Daily cash. Enter opening cash, record cash and wallet transactions, count cash and close the day. A difference requires a note. Further cash transactions that day must be refused; wallet transactions remain available.
- Expiry: open Products → Expiry alerts or a product's Batch & expiry button. Assign existing untracked stock, then test yesterday's expiry, today's expiry, FEFO selection, returns and stock reductions. Add a batch to a pending purchase and receive it twice; stock/lot must only increase once.
- Backup: Profile → Backup & restore → Create → Save/share. Restore on a separate test install from the setup welcome screen. Verify shop activation, IDs, product/shop photos, QR images, drafts and all histories. Corrupt/truncate a file and verify rejection. Change shop data while a restore review is open and verify it cannot replace newer data.
- Printer: pair an ESC/POS Bluetooth printer in Android settings, install a development/release build with the native module, choose it under Profile → Receipt printer, choose 58/80 mm and test. Print an older sale and verify its original date/ID and final `Thank you`. Expo Go must show an unavailable message for Bluetooth; system print and PDF sharing remain available. Bluetooth receipt output is currently Android-only; iPhone uses system print/PDF. The bundled driver does not provide reliable BLE discovery/write readiness for an iPhone Bluetooth flow.

Automated tests cover financial calculations, retries, corrupt history, batch allocation, backup archive validation, native file staging/cleanup and raster output. Android JS export does not replace native compilation or physical printer/camera testing.

