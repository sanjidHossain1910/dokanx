import assert from "node:assert/strict";
import test from "node:test";
import { createHmac, randomBytes } from "node:crypto";
import { createDevicePinService } from "../src/security/devicePin.ts";

function fixture() {
  const storage = { key: null, reads: 0, writes: 0, failRead: false, failWrite: false };
  const deps = {
    read: async () => { storage.reads++; if (storage.failRead) throw new Error("securityStorage"); return storage.key; },
    write: async key => { if (storage.failWrite) throw new Error("securityStorage"); storage.key = key; storage.writes++; },
    random: randomBytes,
  };
  return { storage, create: () => createDevicePinService(deps) };
}

test("device verifier matches native HMAC, preserves leading zero, salt, and local digits", async () => {
  const f = fixture(), service = f.create();
  const first = await service.createPin("0123", randomBytes), second = await service.createPin("0123", randomBytes);
  assert.equal(first.hash, createHmac("sha256", Buffer.from(f.storage.key, "hex")).update("dokanx/report-pin/v1\0" + first.salt + "\0" + "0123").digest("hex"));
  assert.notEqual(first.salt, second.salt); assert.notEqual(first.hash, second.hash);
  assert.equal(f.storage.writes, 1);
  assert.equal(await f.create().verifyPin("০১২৩", JSON.parse(JSON.stringify(first))), true);
  assert.equal(await service.verifyPin("0124", first), false);
  assert.equal(await service.verifyPin("012", first), false);
  assert.equal(await service.verifyPin("012345", first), false);
  assert.equal(Object.hasOwn(first, "key"), false); assert.equal(Object.hasOwn(first, "pin"), false);
});

test("verifier cannot be used without its device secret or on another device", async () => {
  const a = fixture(), b = fixture(), record = await a.create().createPin("1234", randomBytes);
  await assert.rejects(b.create().verifyPin("1234", record), /securityStorage/); assert.equal(b.storage.writes, 0);
  await b.create().createPin("1234", randomBytes);
  assert.equal(await b.create().verifyPin("1234", record), false);
});

test("key read/write failures, corruption, and cancellation do not create a usable verifier", async () => {
  const f = fixture(); f.storage.failRead = true;
  await assert.rejects(f.create().createPin("1234", randomBytes)); assert.equal(f.storage.writes, 0);
  f.storage.failRead = false; f.storage.failWrite = true;
  await assert.rejects(f.create().createPin("1234", randomBytes)); assert.equal(f.storage.key, null);
  f.storage.failWrite = false; f.storage.key = "broken";
  await assert.rejects(f.create().createPin("1234", randomBytes)); assert.equal(f.storage.key, "broken");
  const abort = new AbortController(); abort.abort(); const reads = f.storage.reads;
  await assert.rejects(f.create().createPin("1234", randomBytes, { signal: abort.signal }), /authenticationCancelled/);
  assert.equal(f.storage.reads, reads);
});
