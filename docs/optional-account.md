# Optional account flow

Account Sync update: verified login now opens an explicit Sync screen and selects a separate account-local SQLite workspace. Only Sync downloads and installs the owned shop backup; it displays actual byte progress, validates all data/photos, saves a safety copy, activates the receiving phone and enables ten-minute backup. The original offline shop and other accounts remain separate. See `account-sync.md` for migration, no-backup setup and failure behavior.

Account is never required for shop setup, local data, offline POS, reports, unlimited products or local backup/restore. Setup offers Continue offline, Sign up and a separate Log in link. Existing shops can open Profile → Account & Cloud and switch between Login and Sign up. The root navigation still uses local shopActive; it never waits for cloud login or a network request.

Verification sends the selected login/signup intent. After verifying the OTP, login requires an existing account and signup requires a new phone number. Phone existence is not disclosed before OTP verification. Older clients that omit intent retain the original combined flow.

The account screen supports phone → OTP → saved session; account checks, explicit shop metadata linking and logout. Account creation/login does not upload photos, products, transactions, payment details or PINs. Linking sends only local shop ID and shop name and stores the server's owner-scoped binding separately from BusinessData. The separately authorized Cloud backup feature is now reachable after linking; it uploads only when explicitly requested or automatic backup is enabled. Subscriptions remain deferred. See `cloud-backup.md` for the development storage and rollout boundaries.

Server: `C:\Users\mdsan\Desktop\dokanxServer`. Set DATABASE_URL there and run `npm run db:migrate`, then restart. Development OTP is clearly labeled and shown on screen; no SMS is sent. A real SMS delivery adapter is not configured. Test OTP mode is rejected in production.

The app accepts EXPO_PUBLIC_API_URL including `/api/v1`; release requires HTTPS. For Expo Go development without that override it uses Metro's host on port 3000. The server must bind on the LAN (HOST=0.0.0.0) and the phone must be able to reach it. Requests time out after ten seconds; offline use remains available.

Session tokens and installation ID use separate SecureStore keys. They never enter the business payload, `.dokanx` backups or restored shop data. A restored phone sets up its own login; a restored business archive cannot grant server ownership or subscription rights. Biometric/report PIN remains a separate device-local control.

Startup reads cached credentials only; it makes no network call. Account actions serialize token refresh. Expired/revoked authorization clears cloud credentials without changing local data. With network unavailable, logout attempts server revocation, removes local credentials and explains if server revocation could not be confirmed. Storage failures do not show successful login.

Manual QA: both setup choices, existing shop with no server, incorrect/expired/replayed OTP, rate limits, login/restart, account check, expired access refresh, explicit link, logout online/offline, local stock/sales unchanged, restore without account credentials, light/dark and English/Bangla. Real SMS delivery and physical-phone network interaction still need separate testing.
