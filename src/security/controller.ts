import { comparePin, createPinRecord, validPin, validStoredPin, validPinRecord, type PinRecord, type PinWork } from "./pin.ts";
export type ReportLock = "off" | "phone" | "pin";
export type SecurityPrefs = { version: 1; appLock: boolean; reportLock: ReportLock; pin?: PinRecord; failures: number; blockedUntil: number };
export type SecurityState = { ready: boolean; error: boolean; busy: boolean; appLock: boolean; reportLock: ReportLock; pinConfigured: boolean; pinNeedsUpgrade: boolean; appUnlocked: boolean; reportsUnlocked: boolean; blockedUntil: number; receiptIds: readonly string[] };
export const defaultSecurity: SecurityPrefs = { version: 1, appLock: false, reportLock: "off", failures: 0, blockedUntil: 0 };
export function parseSecurity(raw: string | null): SecurityPrefs {
  if (raw === null) return { ...defaultSecurity };
  const value: SecurityPrefs = JSON.parse(raw);
  if (!value || value.version !== 1 || typeof value.appLock !== "boolean" || !["off", "phone", "pin"].includes(value.reportLock) || !Number.isSafeInteger(value.failures) || value.failures < 0 || !Number.isSafeInteger(value.blockedUntil) || value.blockedUntil < 0 || (value.reportLock === "pin" ? !validPinRecord(value.pin!) : value.pin !== undefined)) throw new Error("securityStorage");
  return value;
}
type Dependencies = { read: () => Promise<string | null>; write: (raw: string) => Promise<void>; phone: (purpose: "app" | "reports" | "settings" | "recovery") => Promise<void>; random: (size: number) => Uint8Array; now?: () => number; createPin?: typeof createPinRecord; verifyPin?: typeof comparePin };
export function createSecurityController(deps: Dependencies) {
  const listeners = new Set<() => void>(), receipts = new Set<string>();
  const now = deps.now ?? Date.now;
  let prefs = { ...defaultSecurity }, appSession = false, reportSession = false, ready = false, error = false, busy = false;
  let proof: { token: string; expiresAt: number } | undefined;
  let state: SecurityState;
  const emit = () => {
    state = { ready, error, busy, appLock: prefs.appLock, reportLock: prefs.reportLock, pinConfigured: !!prefs.pin, pinNeedsUpgrade: !!prefs.pin && (prefs.pin.digits !== 4 || prefs.pin.algorithm !== "device-hmac-sha256"), appUnlocked: ready && (!prefs.appLock || appSession), reportsUnlocked: ready && (prefs.reportLock === "off" || reportSession), blockedUntil: prefs.blockedUntil, receiptIds: [...receipts] };
    listeners.forEach((fn) => fn());
  };
  emit();
  const save = async (next: SecurityPrefs, committed?: () => void) => { parseSecurity(JSON.stringify(next)); await deps.write(JSON.stringify(next)); prefs = next; committed?.(); emit(); };
  const run = async <T>(action: () => Promise<T>, loading = false): Promise<T> => {
    if (busy) throw new Error("securityBusy");
    if (!loading && (!ready || error)) throw new Error("securityStorage");
    busy = true; emit();
    try { return await action(); } finally { busy = false; emit(); }
  };
  const controller = {
    snapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    load: () => run(async () => {
      ready = false; error = false; appSession = false; reportSession = false; proof = undefined; receipts.clear(); emit();
      try { prefs = parseSecurity(await deps.read()); ready = true; }
      catch { error = true; throw new Error("securityStorage"); }
      finally { emit(); }
    }, true),
    unlockApp: () => run(async () => { if (!prefs.appLock || appSession) return; await deps.phone("app"); appSession = true; emit(); }),
    unlockReports: (pin?: string, work?: PinWork) => run(async () => {
      if (prefs.reportLock === "off" || reportSession) return;
      if (prefs.reportLock === "phone") { await deps.phone("reports"); reportSession = true; emit(); return; }
      if (now() < prefs.blockedUntil) throw new Error("pinCooldown");
      if (!pin || !prefs.pin || !validStoredPin(pin, prefs.pin)) throw new Error("invalidPin");
      // Persist the attempt before expensive verification so restarting the app cannot erase it.
      const failures = Math.min(prefs.failures + 1, 1000);
      await save({ ...prefs, failures, blockedUntil: failures >= 5 ? now() + Math.min(30 * 2 ** Math.min(failures - 5, 4), 300) * 1000 : 0 });
      if (!await (deps.verifyPin ?? comparePin)(pin, prefs.pin!, work)) throw new Error(failures >= 5 ? "pinCooldown" : "wrongPin");
      await save({ ...prefs, failures: 0, blockedUntil: 0 }, () => { reportSession = true; });
    }),
    setAppLock: (enabled: boolean) => run(async () => {
      if (prefs.appLock === enabled) return;
      await deps.phone("settings"); proof = undefined;
      await save({ ...prefs, appLock: enabled }, () => { appSession = true; });
    }),
    setReportLock: (mode: "off" | "phone") => run(async () => {
      if (prefs.reportLock === mode) return;
      await deps.phone("settings"); proof = undefined;
      await save({ version: 1, appLock: prefs.appLock, reportLock: mode, failures: 0, blockedUntil: 0 }, () => { reportSession = true; });
    }),
    preparePin: (recovery = false) => run(async () => {
      proof = undefined;
      await deps.phone(recovery ? "recovery" : "settings");
      const token = Array.from(deps.random(24), (n) => n.toString(16).padStart(2, "0")).join("");
      proof = { token, expiresAt: now() + 5 * 60_000 }; return token;
    }),
    cancelPin: () => { proof = undefined; },
    savePin: (pin: string, token: string, work?: PinWork) => run(async () => {
      if (!proof || proof.token !== token || now() > proof.expiresAt) throw new Error("verifyPhoneAgain");
      if (!validPin(pin)) throw new Error("invalidPin");
      const record = await (deps.createPin ?? createPinRecord)(pin, deps.random, work);
      if (work?.signal?.aborted) throw new Error("authenticationCancelled");
      if (!proof || proof.token !== token || now() > proof.expiresAt) throw new Error("verifyPhoneAgain");
      await save({ ...prefs, reportLock: "pin", pin: record, failures: 0, blockedUntil: 0 }, () => { proof = undefined; reportSession = true; });
    }),
    grantReceipt: (id: string) => { if (id) { receipts.add(id); emit(); } },
  };
  return controller;
}
export type SecurityController = ReturnType<typeof createSecurityController>;
