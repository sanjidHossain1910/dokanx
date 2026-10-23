import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes, scryptSync, pbkdf2Sync } from "node:crypto";
import { createSecurityController, defaultSecurity, parseSecurity } from "../src/security/controller.ts";
import { comparePin, createPinRecord, PIN_ROUNDS, SCRYPT_COST, validPinRecord } from "../src/security/pin.ts";
import { createDevicePinService } from "../src/security/devicePin.ts";

const record = { digits: 4, algorithm: "device-hmac-sha256", salt: "ab".repeat(16), hash: "cd".repeat(32) };
function fixture(raw = null) {
  const box = { raw, time: 1_000_000, denied: false, readFailure: false, writeFailure: false, writes: 0, verifyCalls: 0, phoneCalls: [], sequence: 0 };
  const dependencies = {
    read: async () => { if (box.readFailure) throw new Error("read failed"); return box.raw; },
    write: async (value) => { if (box.writeFailure) throw new Error("write failed"); box.raw = value; box.writes++; },
    phone: async (purpose) => { box.phoneCalls.push(purpose); if (box.denied) throw new Error("authenticationCancelled"); },
    now: () => box.time,
    random: (size) => new Uint8Array(size).fill(++box.sequence),
    createPin: async () => ({ ...record }),
    verifyPin: async (pin) => { box.verifyCalls++; return pin === "1234"; },
  };
  const make = () => createSecurityController(dependencies);
  return { box, make, controller: make(), dependencies };
}
const storedPin = () => JSON.stringify({ ...defaultSecurity, reportLock: "pin", pin: record });

test("PIN hashing uses a fresh salt and slow KDF, accepts local digits, and never stores the entered PIN", async () => {
  const first = await createPinRecord("1234", randomBytes), second = await createPinRecord("1234", randomBytes);
  assert.equal(first.algorithm, "scrypt"); assert.equal(validPinRecord(first), true); assert.notEqual(first.salt, second.salt); assert.notEqual(first.hash, second.hash);
  assert.equal(first.hash, scryptSync("1234", Buffer.from(first.salt, "hex"), 32, { ...SCRYPT_COST, maxmem: 40 * 1024 * 1024 }).toString("hex"));
  assert.equal(await comparePin("১২৩৪", first), true); assert.equal(await comparePin("0000", first), false);
  assert.equal(Object.hasOwn(first, "pin"), false); assert.equal(await comparePin("12345", first), false);
});

test("existing PBKDF2 PINs still verify without resetting security", async () => {
  const salt = randomBytes(16);
  const old = { algorithm: "pbkdf2-sha256", rounds: PIN_ROUNDS, salt: salt.toString("hex"), hash: pbkdf2Sync("123456", salt, PIN_ROUNDS, 32, "sha256").toString("hex") };
  assert.equal(validPinRecord(old), true); assert.equal(await comparePin("123456", old), true);
});

test("four-digit PIN survives storage and cold restart; three or six digits cannot unlock it", async () => {
  const f = fixture(); let deviceKey = null;
  Object.assign(f.dependencies, createDevicePinService({ read: async () => deviceKey, write: async key => { deviceKey = key; }, random: randomBytes }));
  const c = f.make(); await c.load(); const token = await c.preparePin();
  await assert.rejects(c.savePin("123456", token), /invalidPin/);
  await c.savePin("0123", token);
  assert.equal(c.snapshot().pinNeedsUpgrade, false);
  const cold = f.make(); await cold.load();
  assert.equal(cold.snapshot().reportsUnlocked, false);
  await assert.rejects(cold.unlockReports("012"), /invalidPin/);
  await assert.rejects(cold.unlockReports("012345"), /invalidPin/);
  await assert.rejects(cold.unlockReports("0124"), /wrongPin/);
  await cold.unlockReports("০১২৩"); assert.equal(cold.snapshot().reportsUnlocked, true);
});

test("legacy six-digit records stay locked until verified migration to four digits", async () => {
  const legacy = { algorithm: "pbkdf2-sha256", rounds: PIN_ROUNDS, salt: record.salt, hash: record.hash };
  const f = fixture(JSON.stringify({ ...defaultSecurity, reportLock: "pin", pin: legacy })); await f.controller.load();
  assert.equal(f.controller.snapshot().pinNeedsUpgrade, true); assert.equal(f.controller.snapshot().reportsUnlocked, false);
  f.box.denied = true; await assert.rejects(f.controller.preparePin(true), /authenticationCancelled/);
  assert.equal(f.controller.snapshot().pinNeedsUpgrade, true);
  f.box.denied = false; const token = await f.controller.preparePin(true);
  await f.controller.savePin("4321", token);
  assert.equal(f.controller.snapshot().pinNeedsUpgrade, false);
  assert.equal(parseSecurity(f.box.raw).pin.digits, 4);
});

test("slow four-digit records offer verified upgrade and never silently unlock", async () => {
  const legacy = { algorithm: "scrypt", digits: 4, ...SCRYPT_COST, salt: record.salt, hash: record.hash };
  const f = fixture(JSON.stringify({ ...defaultSecurity, reportLock: "pin", pin: legacy })); await f.controller.load();
  assert.equal(f.controller.snapshot().pinNeedsUpgrade, true); assert.equal(f.controller.snapshot().reportsUnlocked, false);
  const token = await f.controller.preparePin(true); await f.controller.savePin("4321", token);
  assert.equal(f.controller.snapshot().pinNeedsUpgrade, false);
});

test("PIN hashing reports progress, yields to timers, and cancels before persisting", async () => {
  const abort = new AbortController(), progress = []; let timerRan = false;
  const timer = setTimeout(() => { timerRan = true; }, 0);
  // Fast machines may reach 5% before the first scheduled yield. Observe both
  // progress and a real timer turn before requesting cancellation.
  await assert.rejects(createPinRecord("1234", randomBytes, { signal: abort.signal, onProgress: (percent) => { progress.push(percent); if (percent >= 5 && timerRan) abort.abort(); } }), /authenticationCancelled/);
  clearTimeout(timer);
  assert.equal(timerRan, true); assert.equal(progress[0], 0); assert.ok(progress.at(-1) >= 5);
  const f = fixture(); await f.controller.load(); const token = await f.controller.preparePin();
  await assert.rejects(f.controller.savePin("1234", token, { signal: abort.signal }), /authenticationCancelled/);
  assert.equal(f.box.raw, null); assert.equal(f.controller.snapshot().busy, false);
});
test("both protections are optional and are off for an existing unconfigured installation", async () => {
  const { controller: c, box } = fixture(); await c.load();
  assert.equal(c.snapshot().appUnlocked, true); assert.equal(c.snapshot().reportsUnlocked, true);
  await c.unlockApp(); await c.unlockReports(); assert.deepEqual(box.phoneCalls, []); assert.equal(box.writes, 0);
});
test("app and phone report locks are independently verified and unlocks last only for this controller session", async () => {
  const f = fixture(); await f.controller.load(); await f.controller.setAppLock(true); await f.controller.setReportLock("phone");
  const cold = f.make(); await cold.load(); assert.equal(cold.snapshot().appUnlocked, false); assert.equal(cold.snapshot().reportsUnlocked, false);
  await cold.unlockApp(); assert.equal(cold.snapshot().appUnlocked, true); assert.equal(cold.snapshot().reportsUnlocked, false);
  await cold.unlockReports(); const calls = f.box.phoneCalls.length;
  await cold.unlockApp(); await cold.unlockReports(); assert.equal(f.box.phoneCalls.length, calls);
  assert.equal(cold.snapshot().appUnlocked, true); assert.equal(cold.snapshot().reportsUnlocked, true);
  const restarted = f.make(); await restarted.load(); assert.equal(restarted.snapshot().appUnlocked, false); assert.equal(restarted.snapshot().reportsUnlocked, false);
});
test("cancelled device verification cannot enable, disable, or unlock protections", async () => {
  const f = fixture(JSON.stringify({ ...defaultSecurity, appLock: true, reportLock: "phone" })); await f.controller.load(); f.box.denied = true;
  const before = f.box.raw;
  for (const action of [() => f.controller.unlockApp(), () => f.controller.unlockReports(), () => f.controller.setAppLock(false), () => f.controller.setReportLock("off"), () => f.controller.preparePin(true)]) await assert.rejects(action(), /authenticationCancelled/);
  assert.equal(f.controller.snapshot().appUnlocked, false); assert.equal(f.controller.snapshot().reportsUnlocked, false); assert.equal(f.box.raw, before);
});
test("separate report PIN requires explicit verification; normal access cannot fall back to phone authentication", async () => {
  const f = fixture(storedPin()); await f.controller.load();
  await assert.rejects(f.controller.unlockReports(), /invalidPin/); await assert.rejects(f.controller.unlockReports("0000"), /wrongPin/);
  assert.equal(f.controller.snapshot().reportsUnlocked, false); assert.deepEqual(f.box.phoneCalls, []);
  await f.controller.unlockReports("1234"); assert.equal(f.controller.snapshot().reportsUnlocked, true);
  assert.equal(parseSecurity(f.box.raw).failures, 0); assert.equal(Object.hasOwn(f.controller.snapshot(), "pin"), false);
});
test("failed attempts and cooldown survive a restart and recovery uses an independent verified phone flow", async () => {
  const f = fixture(storedPin()); await f.controller.load();
  for (let i = 0; i < 5; i++) await assert.rejects(f.controller.unlockReports("0000"), i < 4 ? /wrongPin/ : /pinCooldown/);
  assert.equal(parseSecurity(f.box.raw).failures, 5);
  const cold = f.make(); await cold.load(); const calls = f.box.verifyCalls;
  await assert.rejects(cold.unlockReports("1234"), /pinCooldown/); assert.equal(f.box.verifyCalls, calls);
  f.box.time += 30_001; await cold.unlockReports("1234"); assert.equal(cold.snapshot().reportsUnlocked, true);
  const again = f.make(); await again.load(); const token = await again.preparePin(true); assert.equal(again.snapshot().reportsUnlocked, false);
  await again.savePin("4321", token); assert.equal(f.box.phoneCalls.at(-1), "recovery"); assert.equal(again.snapshot().reportsUnlocked, true);
});
test("PIN setup/recovery tokens cannot be forged, reused or used after expiry", async () => {
  const f = fixture(); await f.controller.load();
  await assert.rejects(f.controller.savePin("1234", "forged"), /verifyPhoneAgain/);
  const expired = await f.controller.preparePin(); f.box.time += 300_001;
  await assert.rejects(f.controller.savePin("1234", expired), /verifyPhoneAgain/);
  const cancelled = await f.controller.preparePin(); f.controller.cancelPin(); await assert.rejects(f.controller.savePin("1234", cancelled), /verifyPhoneAgain/);
  const token = await f.controller.preparePin(); await f.controller.savePin("1234", token);
  await assert.rejects(f.controller.savePin("4321", token), /verifyPhoneAgain/);
  assert.equal(parseSecurity(f.box.raw).reportLock, "pin");
});
test("settings still require fresh phone verification after report unlock and writes cannot publish a partial lock state", async () => {
  const f = fixture(storedPin()); await f.controller.load(); await f.controller.unlockReports("1234");
  f.box.denied = true; await assert.rejects(f.controller.setReportLock("off"), /authenticationCancelled/); assert.equal(f.controller.snapshot().reportLock, "pin");
  f.box.denied = false;
  const invalidFrames = []; const stop = f.controller.subscribe(() => { const s = f.controller.snapshot(); if (s.appLock && !s.appUnlocked) invalidFrames.push(s); });
  await f.controller.setAppLock(true); stop(); assert.equal(invalidFrames.length, 0);
  f.box.writeFailure = true; await assert.rejects(f.controller.setAppLock(false)); assert.equal(f.controller.snapshot().appLock, true);
});
test("storage failures and corrupted security configuration fail closed without silently resetting protection", async () => {
  for (const raw of ["bad", "{}", JSON.stringify({ ...defaultSecurity, reportLock: "pin" }), JSON.stringify({ ...defaultSecurity, pin: record }), JSON.stringify({ ...defaultSecurity, blockedUntil: -1 })]) {
    const f = fixture(raw); await assert.rejects(f.controller.load()); assert.equal(f.controller.snapshot().ready, false); assert.equal(f.controller.snapshot().appUnlocked, false); assert.equal(f.controller.snapshot().reportsUnlocked, false); assert.equal(f.box.raw, raw);
  }
  const f = fixture(storedPin()); f.box.readFailure = true; await assert.rejects(f.controller.load()); f.box.readFailure = false; await f.controller.load();
  f.box.writeFailure = true; await assert.rejects(f.controller.unlockReports("1234")); assert.equal(f.box.verifyCalls, 0); assert.equal(f.controller.snapshot().reportsUnlocked, false);
});
test("concurrent authentication does not run two system prompts or race security changes", async () => {
  const f = fixture(JSON.stringify({ ...defaultSecurity, appLock: true })); let finish;
  f.dependencies.phone = () => new Promise((resolve) => { finish = resolve; }); const c = f.make(); await c.load();
  const pending = c.unlockApp(); await assert.rejects(c.setAppLock(false), /securityBusy/); finish(); await pending;
  assert.equal(c.snapshot().appUnlocked, true); assert.equal(c.snapshot().appLock, true);
});
test("current sale receipt access is session-only and is never written alongside security settings", async () => {
  const f = fixture(storedPin()); await f.controller.load(); f.controller.grantReceipt("fresh-sale");
  assert.deepEqual(f.controller.snapshot().receiptIds, ["fresh-sale"]); assert.equal(f.controller.snapshot().reportsUnlocked, false); assert.equal(f.box.writes, 0);
  const cold = f.make(); await cold.load(); assert.deepEqual(cold.snapshot().receiptIds, []);
});
