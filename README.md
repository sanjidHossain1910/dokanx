# DokanX

An offline shop-management app for Android phones and iPhone, built with Expo SDK 57. The app supports English/Bangla and Light/Dark/System appearance. It runs in portrait orientation; tablet and web layouts are not targets.

## Run on a phone

Use Node.js 22.13 or newer:

```sh
npm install
npm start
```

Open the project in Expo Go on your phone. Use `npm run android` for an Android emulator, or `npm run ios` for the iOS simulator on macOS. After dependencies change, restart Metro with `npx expo start --clear`.

## Features

- Offline shop registration and a saved activation flag, replacing login for now.
- Products with unit-aware quantities, retained square photos, categories and stock alerts.
- Multi-item POS, customer selection, cash/due/bKash/Nagad payment records and receipts.
- Supplier purchases, pending/received stock, expenses and transaction histories.
- Dashboard/report amounts with temporary show/hide controls.
- Profile, payment settings, business preferences, language, appearance and local help.
- Customer due collections and supplier payments with invoice allocations and ledgers.
- Partial returns/refunds, optional restocking and return-adjusted sales/profit reports.
- Daily opening cash, reconciliation, discrepancy notes and immutable cash close.
- Product batches, expiry alerts and FEFO stock allocation with expired-sale blocking.
- Portable local backup/restore with photos, QR images, history and safety backups.
- Android Bluetooth receipt-printer selection, 58/80 mm output, test receipts and system print/PDF sharing.

Amounts are recorded in BDT. Phone business records use SQLite, including migration from the original AsyncStorage record. Language and appearance preferences use AsyncStorage. Photos and QR images are retained in app document storage. Manual `.dokanx` backups transfer local shop data to another phone; backend authentication, cloud backup and synchronization remain future work. Keep a backup outside the app: uninstalling or clearing storage can remove the local database and local backup files.

Bluetooth receipt printing requires an Android development/release build containing `react-native-thermal-pos-printer`, Bluetooth permissions and a paired ESC/POS printer. It does not run inside Expo Go. iPhone uses system print/PDF. Printed receipts contain shop name, Transaction ID, original transaction date/time, products and prices, total and a final `Thank you`.

Wallet payments are recorded manually; the shopkeeper confirms receipt. Camera/barcode behavior and native sharing should be checked on a real phone.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npx expo install --check
npx expo export --platform android --max-workers 1
```

Implementation notes and recorded future requirements are in `docs/`. Older visual QA reports describe browser previews used before the project became phone-only.

Manual checks for the new operations flows are in [operations-testing.md](docs/operations-testing.md). Hardware printing and native compilation require the corresponding device/build environment; Android JS export is a bundle check.
