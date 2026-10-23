# Account-scoped local data and explicit Sync

Authorized 2026-10-21: after OTP login, show Sync; clicking it downloads that account's saved shop, displays actual download progress, installs products/photos/all records into local storage and enables ten-minute changed-snapshot backup.

## Local ownership and migration

- The original `dokanx.db` and AsyncStorage migration remain the offline workspace. Nothing reassigns or erases that existing shop when an account logs in.
- Accounts have separate `dokanx-account-<server-user-id>.db` files using the same atomic `business_state` repository. Workspace names are restricted to safe identifiers. Reopening the app selects the cached session's account database; logging out reopens the offline database. Other account databases are retained but never merged or shown as this account's products.
- The workspace gate covers old content while switching, hides it from accessibility and resets navigation at workspace boundaries. Queued writes and restores check both the originating workspace and restore epoch, so stale form callbacks cannot modify another account or a newly restored shop.
- A fresh login stores `needsSync=true`; automatic uploads stay paused until the account explicitly completes Sync or starts its own new local shop backup. Refresh preserves that flag. Account credentials, scope, scheduler state and local restore generations remain outside business archives.
- Existing users whose original shared data predates account workspaces will still find it in the offline shop. A new account without a completed server backup may explicitly copy that offline shop into its own database, or set up its own shop. This never silently imports another cached account. The offline original is preserved.
- Manual backup indexes and restore generations are workspace-scoped. Existing global manual backup metadata belongs to the offline workspace. Asset files are retained as immutable references; restored assets get a fresh document directory.

## Download and local install

1. OTP success opens `/account-sync`. The app lists only the authenticated owner's shops; multiple shops require selection. Metadata lookup does not automatically download an archive.
2. Sync snapshots the current account-local payload and pauses automatic uploads. It fetches the current complete head + epoch and downloads that exact immutable version through the authenticated API. The progress bar uses received bytes and the expected archive size; early EOF, excess bytes, timeouts and invalid sizes fail without writing a usable archive.
3. The app checks raw archive SHA-256, the full existing portable format/business relationships and every image hash, then verifies the archive shop ID matches the selected server-owned binding.
4. It creates a safety archive of the current account's local shop, stages photos/QR to new document URIs and checks for intervening edits/account changes.
5. `POST /backups/:shopId/sync/activate` compares the selected head and epoch, records an idempotent activation and makes this installation the writer with a new epoch. A changed server head rejects the operation before local replacement. Other owners cannot activate this shop. Old phones/pending uploads cannot publish over the transferred head.
6. The existing queued, stale-review-protected SQLite restore atomically replaces the account payload. IDs, historical prices, quantities, history and settings are preserved; records are not appended a second time. Receiving-phone PIN/security and account secrets stay unchanged. Printer pairing is cleared and portable appearance/language preferences are applied.
7. The app writes a checkpoint from the verified cloud version and the newly localised data signature, enables ten-minute backup and marks Sync complete. Progress reaches 100% only after completion. Unchanged imported data does not create a redundant cloud version; later local changes are backed up when due.

An error after local commit retains the installed data/photos; `needsSync` keeps uploads paused until a safe retry completes. An error before commit keeps the previous account shop. Safety archives remain accessible. Logging out never deletes a workspace. A server shop with no complete backup is explicitly shown as such; it does not wipe local data with an empty response.

Starting an account with its own local shop uses an explicit empty-head claim before enabling backup. It compares the observed epoch and fences abandoned first-upload devices without replacing any completed server backup. The normal ten-minute controller then publishes the initial full snapshot and handles durable upload retries.

## Boundaries and verification

### Reviewed phone-data upload after file restore

Local Backup & Restore has separate Save to phone and Share actions. Android saves a complete `.dokanx` archive into an explicitly selected document-provider folder using the native folder picker; it does not rely on a share target offering Downloads. Only successfully written exports show a saved confirmation, cancellation creates nothing, and failed copies remove only their new partial document. iOS uses the system share sheet's Save to Files action without claiming success on dismissal. Cloud backup downloads use the same native save path.

Restore reads the archive through native base64 into an owned Uint8Array rather than depending on native binary-view conversion or an `exists` flag for a selected document provider. Archive limits, record/reference validation and every image checksum remain mandatory. New archives are read back through this restore path before being marked ready; external exports are read back and byte-compared before showing success. Invalid files expose a safe validation-stage message without printing business data. The user-supplied 790,908-byte archive was verified unchanged through read/record/hash/staging processing (4 products, 10 invoices, 5 images); this is a local test with filesystem shims, not a completed phone restore.

An observed Expo Go failure occurred before decoding (`stage=file`, zero bytes). Native File read exceptions now fall back to `expo-file-system/legacy` with an explicitly bounded base64 read, then run the same full archive and image validation. Development diagnostics include a short native error with local file paths redacted. No restore validation is skipped, and the actual phone result still needs confirmation.

The Sync screen also links to Restore a .dokanx file. A signed-in successful local restore routes to Cloud backup. Review phone data for cloud backup reads owned shops and the matching shop's current head without writing. Confirmation rejects local edits, account/workspace/restore changes and a changed remote head/epoch. It links a new owned shop only if the restored stable local shop ID has no matching owned shop; other cloud shops are not replaced.

The existing activate/claim-empty endpoints claim this installation and fence earlier writers. A deliberately unmatched checkpoint signature ensures restored local records actually upload over the reviewed base instead of being mistaken for the existing cloud snapshot. The reusable native publisher prepares the full portable archive and runs the normal metadata/binary upload/verification/checkpoint flow. Automatic backup remains off and the account remains needsSync until a verified upload, settings save and owned binding confirmation succeed. Success enables foreground ten-minute checks. Previous versions are retained, local records are never merged or edited by publication, and the offline original remains separate. In-screen retry reuses the same publisher/pending request, including lost completion acknowledgment; after reopening the screen, review again before another publication. Phone testing is still needed.

This is latest-backup recovery and one-writer transfer, not simultaneous multi-device merging. The old phone must stop using that shop after transfer; offline sales on it cannot be physically prevented and are not automatically merged. Automatic backup checks run while active and catch up on reopening, not on an exact background OS schedule. Historical/local-file rollback remains separately fenced and does not silently resume cloud publishing.

Migration `003_account_sync.sql` stores activation receipts. Development PC private storage and production-disabled backup endpoints remain unchanged; hosted storage, subscription and production OTP are separate rollout work.

Tests cover account database isolation/persistence, workspace filename safety, actual chunk progress, incomplete downloads, complete download → safety → activation → atomic replacement order, wrong shop, account switches, local edits, changed heads, staged asset cleanup and post-commit retries. API integration tests cover transfer idempotency, owner isolation, epochs and old-writer rejection. A live PostgreSQL/private-filesystem smoke test downloads to a second authenticated installation, activates it and verifies that the old writer is rejected. Physical-phone end-to-end testing is still required.


## One-action existing local shop transfer (2026-10-23)

Signup/login still opens Account Sync. If an offline shop exists and has not already been published to this account (or a transfer is pending), a prominent card shows its photo, name, owner, address and counts. “Move this shop to my account” copies the entire validated business payload, including supported future metadata, instead of manually selecting individual profile fields or asking for an export file.

`localTransfer.ts` checks account occupancy, pauses sync, resolves the stable owned shop ID, rejects an unreviewed existing cloud head, saves an internal safety copy before local replacement, restores the complete payload atomically and persists its generation/fingerprint and planned claim epoch. Empty-head ownership claims are retried without incrementing a claim already completed after a lost reply. `nativeLocalTransfer.ts` uses the existing durable native publisher, reuses upload IDs/files on retry and verifies the published head before completing account setup. Only then does the existing scheduler start. The offline database and its original photos remain retained; security credentials are not copied.

The recovery marker and cloud publisher settings are scoped by account ID, server shop ID and local shop ID. Changed source/target data, stale generations and account/session changes stop the flow. A different occupied account workspace is never silently replaced; this is first publication, not an account merge or conflict-resolution tool. Subscription purchase remains a separate future feature.
