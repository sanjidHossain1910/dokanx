import test from "node:test";
import assert from "node:assert/strict";
import { createCloudBackupController } from "../src/cloudBackup/controller.ts";
const a = "a".repeat(64),
  b = "b".repeat(64),
  hash = "c".repeat(64);
function setup(raw = null) {
  let saved = raw,
    time = 1_000_000,
    signature = a,
    generation = "initial",
    current = true,
    fail = false,
    exists = true,
    head = null,
    committed = null;
  const calls = [],
    removed = [];
  let onUpload = () => {},
    uploadError = "",
    failSaveAt = 0,
    writes = 0;
  const prepared = {
    requestKey: "request",
    signature: a,
    archiveHash: hash,
    bytes: 100,
    uri: "file:///cache/backup",
  };
  const response = {
    id: "version",
    snapshotHash: a,
    archiveHash: hash,
    bytes: 100,
    status: "created",
    createdAt: new Date(time).toISOString(),
    completedAt: null,
    products: 1,
    invoices: 0,
    assets: 1,
  };
  const controller = createCloudBackupController({
    read: async () => saved,
    write: async (value) => {
      if (++writes === failSaveAt) throw new Error("backupSettings");
      saved = value;
    },
    generation: async () => generation,
    current: () => current,
    now: () => time,
    signature: async () => signature,
    prepare: async (baseId) => ({ ...prepared, signature, baseId }),
    exists: () => exists,
    remove: (uri) => removed.push(uri),
    request: async (path, options) => {
      calls.push({ path, options });
      if (fail) throw new Error("networkUnavailable");
      if (!options)
        return {
          headId: head,
          canUpload: true,
          versions: committed ? [committed] : [],
        };
      if (options.fileUri) {
        if (uploadError) throw new Error(uploadError);
        head = "version";
        committed = {
          ...response,
          status: "complete",
          completedAt: new Date(time).toISOString(),
        };
        onUpload();
        return committed;
      }
      return committed ?? response;
    },
  });
  return {
    controller,
    calls,
    removed,
    saved: () => saved,
    advance: (ms) => (time += ms),
    change: () => (signature = b),
    restore: () => (generation = "restored"),
    switchAccount: () => (current = false),
    fail: (value) => (fail = value),
    onUpload: (fn) => (onUpload = fn),
    missing: () => (exists = false),
    expire: () => (uploadError = "backupExpired"),
    failCheckpoint: () => (failSaveAt = 2),
  };
}
test("cloud backup stays opt-in and never contacts the server on offline startup", async () => {
  const a = setup();
  await a.controller.load();
  await a.controller.check();
  assert.equal(a.calls.length, 0);
  assert.equal(a.controller.snapshot().enabled, false);
});
test("ten minute checks consolidate changes and unchanged snapshots produce no upload", async () => {
  const a = setup();
  await a.controller.setEnabled(true);
  await a.controller.check();
  assert.equal(a.calls.length, 0);
  a.advance(600000);
  await a.controller.check();
  assert.equal(a.calls.filter((c) => c.options?.fileUri).length, 1);
  assert.ok(a.controller.snapshot().lastSuccess);
  const count = a.calls.length;
  a.advance(600000);
  await a.controller.check();
  assert.equal(a.calls.length, count);
  assert.equal(a.controller.snapshot().pending, false);
});
test("manual backup confirms captured data only; changes during upload remain pending", async () => {
  const a = setup();
  a.onUpload(() => a.change());
  await a.controller.check(true);
  assert.equal(a.controller.snapshot().pending, true);
  assert.equal(JSON.parse(a.saved()).checkpoint.signature, "a".repeat(64));
  assert.equal(a.removed.length, 1);
});
test("offline failures retain retry metadata without advancing the successful checkpoint", async () => {
  const a = setup();
  await a.controller.setEnabled(true);
  a.fail(true);
  a.advance(600000);
  await a.controller.check();
  assert.equal(a.controller.snapshot().lastSuccess, undefined);
  assert.equal(a.controller.snapshot().error, "networkUnavailable");
  const count = a.calls.length;
  await a.controller.check();
  assert.equal(a.calls.length, count);
  a.fail(false);
  a.advance(30000);
  await a.controller.check();
  assert.ok(a.controller.snapshot().lastSuccess);
});
test("a committed upload with a lost acknowledgment is recovered using the same idempotency key", async () => {
  const a = setup();
  a.onUpload(() => {
    throw new Error("networkUnavailable");
  });
  await a.controller.check(true);
  const pending = JSON.parse(a.saved()).upload;
  assert.equal(pending.requestKey, "request");
  assert.equal(JSON.parse(a.saved()).checkpoint, undefined);
  a.onUpload(() => {});
  await a.controller.check(true);
  assert.equal(JSON.parse(a.saved()).checkpoint.id, "version");
  assert.equal(
    a.calls
      .filter((c) => c.options?.body)
      .every((c) => c.options.body.requestKey === "request"),
    true,
  );
  assert.equal(a.calls.filter((c) => c.options?.fileUri).length, 1);
});
test("restore pauses automatic and manual uploads; account switches do not start requests", async () => {
  const a = setup();
  await a.controller.setEnabled(true);
  a.restore();
  a.advance(600000);
  await a.controller.check();
  assert.equal(a.calls.length, 0);
  assert.equal(a.controller.snapshot().error, "backupRestored");
  assert.equal(a.controller.snapshot().enabled, false);
  const b = setup();
  b.switchAccount();
  await b.controller.check(true);
  assert.equal(b.calls.length, 0);
});
test("missing temporary files never create a false successful checkpoint", async () => {
  const a = setup();
  a.missing();
  await a.controller.check(true);
  assert.equal(a.controller.snapshot().error, "backupTempMissing");
  assert.equal(a.controller.snapshot().lastSuccess, undefined);
  assert.equal(JSON.parse(a.saved()).upload, undefined);
});
test("expired upload metadata is cleared so the next attempt can prepare a fresh request", async () => {
  const a = setup();
  a.expire();
  await a.controller.check(true);
  assert.equal(a.controller.snapshot().error, "backupExpired");
  assert.equal(a.controller.snapshot().lastSuccess, undefined);
  assert.equal(JSON.parse(a.saved()).upload, undefined);
  assert.equal(a.removed.length, 1);
});
test("failed checkpoint persistence retains the committed upload for acknowledgment recovery", async () => {
  const a = setup();
  a.failCheckpoint();
  await a.controller.check(true);
  assert.equal(a.controller.snapshot().lastSuccess, undefined);
  assert.equal(JSON.parse(a.saved()).upload.requestKey, "request");
  await a.controller.check(true);
  assert.ok(a.controller.snapshot().lastSuccess);
  assert.equal(a.calls.filter((c) => c.options?.fileUri).length, 1);
});
