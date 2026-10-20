# Profile and settings

Profile now follows the supplied showcase: shop avatar and identity, live product/customer counts, today's sales with the existing temporary reveal control, and separate edit-profile, payments, business settings, appearance/language and help destinations. Edit Profile reuses the existing retained square-photo editor. Both themes and both languages are supported.

Payment Methods reuses the saved offline bKash/Nagad accounts and QR crop/fullscreen tools. Accounts can be edited, disabled or removed; only one enabled account can be default. New checkout screens select that default wallet, otherwise cash. Bank/Other are explicitly shown as future options; they do not create unusable payment records. Cancelling an editor does not save an account.

Business preferences are optional `businessSettings` metadata in the existing repository. Legacy records continue to load with defaults. Invoice prefix and receipt message affect new sales, and the message is frozen in the saved invoice. Default percentage discount applies only when creating a new cart. The default low-stock quantity is used in new product forms; existing product limits stay intact. BDT remains the currency. Date order and clock format apply to sale/purchase history, receipt views and printed/shared receipt dates. Quantity units remain the predefined unit catalogue; Categories opens the existing category manager.

Help contains local usage instructions, FAQ and descriptions of current offline storage and app use. There is no configured external support address or published service policy URL. Support/feedback can open a user-controlled share sheet; the app does not submit messages automatically. App version is read from Expo configuration.

Validation: 73 passing automated tests, including settings validation/legacy compatibility, invoice prefix/message snapshots, new-cart discount behavior, date formatting and single-default-wallet rules. TypeScript and lint passed. Browser checks covered Profile navigation, sales show/manual hide, invoice validation and persistence after reload, default wallet selection in checkout, offline FAQ content, saved payment/default badges and persisted Bangla/dark-mode preferences. Preview data is isolated demo data; no actual sale or outgoing support message was submitted. Camera/gallery and native sharing remain device checks.

Previews: [Profile light](previews/profile-home-light.png), [Profile dark Bangla](previews/profile-home-dark-bn.png), [Business Settings](previews/profile-business-settings.png), [Appearance](previews/profile-appearance-dark-bn.png), [Payments](previews/profile-payments-dark-bn.png), [Help](previews/profile-help.png).

Web production export and Android Hermes production export both passed.
