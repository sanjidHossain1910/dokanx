# Offline shop registration

Login and signup URLs now return to the app entry. A new or inactive shop enters `/setup`; completed registration persists `shopActive: true` and subsequent launches open Home. Setup is a local registration flow; it does not create a remote account or perform server activation.

The five reference views are represented by the welcome screen, basic information screen, payment chooser, wallet editor and saved payment list. Shop and owner names are required. Contact number, address and square-cropped shop photo are optional. Cash and due remain available when mobile payment setup is skipped. bKash/Nagad support an optional account name, a required valid number when enabled, and an optional QR with the existing crop/fullscreen workflow.

Basic information saves an inactive draft. Only Done/Skip for Now commits activation. Root navigation waits for storage hydration, gates the operational route groups behind the active flag, and prevents an active shop from reopening registration. Existing inventory, sales, purchases and wallet settings are preserved. Invalid saved data displays storage recovery instead of silently resetting the shop.

Shop identity (`shopId`), owner, contact, address, photo URI, registration timestamp and activation flag use the existing business repository. Native storage remains SQLite; web uses the existing local adapter. Shop photos reuse retained files under `product-photos/` with a `SHOP-` filename prefix. No backend or synchronization was added. Profile opens the same details/photo editor and can update all shop fields after registration.

Validation: 69 automated tests (including registration validation, stable identity, legacy inventory preservation and SQLite reload), TypeScript, lint and web production export. Browser checks covered empty required fields, saving a shop, adding wallet account details, the saved payment list, completing setup, reload into Home, active setup-route gating, skipping wallet configuration, Bangla/dark mode and editing shop details after activation. Browser records are isolated demo data. Native camera/gallery permissions and image picking still require a device check.

Previews: [welcome](previews/shop-welcome.png), [saved methods](previews/shop-payment-methods.png), [Bangla dark payments](previews/shop-empty-payments-dark-bn.png), [Bangla shop details](previews/shop-details-dark-bn.png).

Android Hermes production export also passed, using one build worker.
