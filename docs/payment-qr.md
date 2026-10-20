# Wallet logos, editable QR and payment amount input

- Bundled the supplied bKash and Nagad SVG artwork in `assets/payments/`. Only the original outer canvas margins were trimmed; the artwork and colors are retained. A shared `WalletLogo` displays them in sales payment methods, Profile wallet setup and purchase payment choices, on a white background for dark-mode legibility.
- Gallery QR selection now opens an editor before applying the image. Users can keep the full image, choose a square crop, zoom up to 8×, drag/reposition with arrow controls, rotate in 90-degree steps, or reset. The editor previews the same geometry applied when saving the PNG. QR white borders should remain inside the crop.
- Existing QR images can also be edited. Cancelling leaves the previous QR unchanged. Applying an edit prepares a new image; Profile's Save commits the account configuration before an old saved file is removed. Native files remain in the existing document `payment-qr/` directory, with web images persisted as data URIs. No persistence schema or backend was added.
- Profile and sales payment now show a large square QR frame with aspect-preserving image display. Tapping it opens a fullscreen square viewer with the account number, an X and a Back to normal view button. Closing returns to the same screen without navigation or payment changes.
- Removed the sales payment button linking to Profile setup. Quick amount buttons and a custom amount input are now visible together. Both update the same received amount, change/due calculation and existing payment validation; no duplicate amount field remains.

## Files

New: `components/payments/WalletLogo.tsx`, `QrEditor.tsx`, `QrPreview.tsx`, `src/store/paymentQrRules.ts`, `tests/paymentQr.test.mjs`, and the two SVG assets.

Updated: `components/business/PaymentSettings.tsx`, `components/pos/Payment.tsx`, `components/purchase/Shared.tsx`, `Summary.tsx`, `src/store/paymentQr.ts`, and `src/i18n/resources/pos.ts` with English/Bangla text.

## Verification

TypeScript, lint, all 62 tests and Web/Android production exports passed. Tests cover rotated image dimensions, crop bounds at zoom/pan extremes and invalid transformations.

Browser verification in isolated preview storage used a generated QR containing only `DOKANX-LOCAL-QR-PREVIEW`, not a real merchant payment payload. Rotating 90 degrees and cropping produced a 600×600 PNG; decoding that displayed output returned the original payload. Cancelling an existing-image edit preserved the old preview. The edited QR saved successfully, reappeared on payment after navigation and opened/closed fullscreen from both Profile and Payment.

Both supplied logos rendered in the payment method buttons. A 440 BDT bill with custom Bangla input ৫০০ showed 60 BDT change; 100 disabled completion; tapping the 500 quick button updated the same input. The removed Profile setup button was absent. No sale or real payment was completed during this check. Native gallery/editor interactions still require a real-device check.

- [Payment logos and custom amount](previews/payment-logos-custom-amount.png)
- [QR editor](previews/payment-qr-editor.png)
- [Fullscreen QR](previews/payment-qr-fullscreen.png)
