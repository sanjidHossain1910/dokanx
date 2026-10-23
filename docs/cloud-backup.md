# Cloud backup — first local-server implementation

Update: `docs/account-sync.md` now documents the authorized account-specific database/download/Sync flow and latest-head writer transfer. After fresh login, automatic backup pauses until Sync finishes. Latest owned backup recovery can activate this phone with a new epoch; historical/local-file rollback remains paused for separate review. Earlier transfer-deferred text below describes the initial backup-only phase.

Authorized on 2026-10-21. Open Profile → Backup & Restore → Cloud backup, or Account & Cloud → Cloud backup after explicitly linking this shop. Account signup alone never starts an upload. Back up now is explicit; automatic backup is off until enabled.

## Behavior

- Immediate local SQLite saves remain independent of network/account/cloud limits.
- While active, a 30-second scheduler checks whether the 10-minute interval is overdue. It hashes the captured business data and language/theme preferences only when due. Notification read status is excluded. Unchanged snapshots skip upload. Foreground catches up once; no promise of background execution. A failed attempt uses bounded 30-second to 10-minute backoff. One controller operation runs at a time.
- A portable `.dokanx` archive includes all referenced product/shop/history/held-cart photos and wallet QR files. The existing native backup encoder and full relationship validator remain the format boundary. Temporary cloud archives use cache storage and never replace the last manual backup entry.
- Upload metadata, idempotency key and exact captured signature/file persist separately from business data, scoped to account + cloud shop + local shop. A lost acknowledgment retries the same request and can recover an already completed version. Only a verified completed response advances the checkpoint. Changes made during upload remain pending.
- File/archive limits stay 60 MB total, 15 MB manifest, 2,000 assets, 3 MB each. Asset format v1 keeps `SHA256(base64(bytes))`; the transport archive digest is raw-byte SHA-256 and explicitly separate.
- The first uploading installation claims the backup writer. Other devices belonging to the owner may list/download but cannot replace the head. Version creation checks the previous head; stale writers and conflicting idempotency keys fail. Device transfer/promotion and simultaneous multi-device sync are not implemented.
- Saved verified versions display date, size and record/photo counts. Download validates the transport checksum and existing archive validator, then opens the system share/save sheet. Restore continues through the existing local import/review/safety-copy/atomic-replace flow. No automatic local replacement or automatic merge.
- Any local restore updates a device-local generation marker and invalidates in-flight controllers. Existing automatic/manual cloud uploads pause rather than silently publishing restored old history over the current head. A reviewed new lineage/device transfer flow is still required to resume that existing cloud history.
- PINs, biometric grants, account tokens, installation ID, backup scheduler/checkpoints and notification queue IDs never enter the business archive. Logout preserves local business data and stops the account-scoped scheduler.

## Server and rollout boundary

Desktop/dokanxServer implements migration `002_cloud_backups.sql`, owner-authorized metadata/list/upload/download endpoints, immutable private filesystem storage and exact app-format validation. Only complete versions are listed/downloadable. Archive bytes are flushed before publishing the head; failures preserve the prior head and a retry can recover an immutable object written before a database rollback.

The format bundle is generated from the phone's actual pure TypeScript backup/business validators by `npm run backup:format:sync` in the server project. The checked-in generated bundle and source digest travel with server builds; it does not depend on the phone source tree at runtime. Refresh it intentionally when changing the business schema and add format migration/compatibility handling when necessary.

Current storage defaults to `.local/cloud-backups` on this PC, not an externally hosted provider. `BACKUP_STORAGE_DIR` can point at another private directory for development. Keep the database and this directory together for operator recovery; never expose it through a static file server. Development caps are 100 recent/persisted versions and 1 GB per shop; the service stops at capacity and does not silently delete any recovery point or produce partial backups. These are technical test limits, not subscription tiers.

Production backup endpoints deliberately remain unavailable. Hosted private object storage, durable async validator/cleanup workers, verified subscription entitlement/retention policies, reviewed transfer/restore epochs, operator disaster recovery and production OTP must be completed before production enablement. This first implementation validates inline with bounded archive sizes; it is not a production multi-tenant upload worker or live synchronization service.

## Verification

Phone transport correction: uploads pass a bounded `Uint8Array` to `expo/fetch`, not a File/Blob. On Android the custom `.dokanx` extension has no MIME type; Expo's Blob normalizer overrides even an explicit Content-Type with the file's empty/null type. Byte bodies preserve `application/octet-stream`. Transport tests cover exact bytes/header, missing/oversized files and actionable 415 errors. Development diagnostics report the failing backup stage and a safe error code without phone numbers, paths, tokens or archive contents.

Pure scheduler/controller tests cover opt-in, unchanged skips, 10-minute checks, offline backoff, concurrent edits, lost acknowledgments, missing temporary files, context switch and restore pause. API integration tests run the SQL migrations with PGlite and cover photo hashes, invisible incomplete versions, byte-identical download, ownership, idempotency, stale head and primary device. A separate live PostgreSQL/private-filesystem smoke test uploaded and downloaded an archive larger than 1 MB and removed its temporary account/archive afterwards. Android Metro bundle, type checks and lint pass; physical-phone upload/share/foreground testing is still required.

## Current routine sync

The automatic full-archive/writer-only behavior described above is retained only for the legacy reviewed publication and recovery path. Routine synchronization now uses incremental records and a durable local change queue. See [the current queued sync flow](queued-sync.md) for acceptance, retry, conflict and download behavior. Automatic phone-to-cloud transfer defaults to 10 minutes while active; Cloud backup now allows 2–1440 minutes. Held Sales and unfinished carts stay on the device during routine exchange. Production endpoints remain disabled.
