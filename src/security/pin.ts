import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { normalizeNumericInput } from "../store/productUnits.ts";

export const PIN_ROUNDS = 600_000;
export const PIN_DIGITS = 4;
export type PinRecord = { salt: string; hash: string; digits?: 4 } & (
  { algorithm: "pbkdf2-sha256"; rounds: number } |
  { algorithm: "scrypt"; N: number; r: number; p: number } |
  { algorithm: "device-hmac-sha256"; digits: 4 }
);
export type PinWork = { signal?: AbortSignal; onProgress?: (percent: number) => void };
export const SCRYPT_COST = { N: 32768, r: 8, p: 3 };
export const normalizePin = (value: string) => normalizeNumericInput(value);
export const validPin = (value: string) => /^\d{4}$/.test(normalizePin(value));
export const validStoredPin = (value: string, record: PinRecord) => (record.digits === PIN_DIGITS ? /^\d{4}$/ : /^\d{6}$/).test(normalizePin(value));
export function validPinRecord(value: PinRecord) {
  return !!value && (value.digits === undefined || value.digits === PIN_DIGITS) && (value.algorithm === "device-hmac-sha256" ? value.digits === PIN_DIGITS : value.algorithm === "pbkdf2-sha256" ? value.rounds === PIN_ROUNDS : value.algorithm === "scrypt" && value.N === SCRYPT_COST.N && value.r === SCRYPT_COST.r && value.p === SCRYPT_COST.p) && /^[a-f0-9]{32}$/.test(value.salt) && /^[a-f0-9]{64}$/.test(value.hash);
}
export async function derivePin(pin: string, salt: Uint8Array, work: PinWork = {}, legacy = false) {
  if (!/^\d{4}(\d{2})?$/.test(normalizePin(pin)) || salt.length !== 16) throw new Error("invalidPin");
  const password = Uint8Array.from(Array.from(normalizePin(pin), (digit) => digit.charCodeAt(0)));
  const started = Date.now(); let lastPercent = -1;
  const progress = (fraction: number) => {
    if (work.signal?.aborted) throw new Error("authenticationCancelled");
    if (Date.now() - started > 90_000) throw new Error("pinWorkTimeout");
    const percent = Math.min(99, Math.floor(fraction * 100));
    if (percent !== lastPercent) { lastPercent = percent; work.onProgress?.(percent); }
  };
  try {
    progress(0);
    // Keep existing verifiers compatible. New records use the OWASP 32 MiB scrypt profile;
    // its memory-hard core avoids 600,000 HMAC calls in the phone's JS runtime.
    const derived = legacy
      ? await pbkdf2Async(sha256, password, salt, { c: PIN_ROUNDS, dkLen: 32, asyncTick: 16 })
      : await scryptAsync(password, salt, { ...SCRYPT_COST, dkLen: 32, maxmem: 40 * 1024 * 1024, asyncTick: 16, onProgress: progress });
    try { progress(1); return derived; } catch (cause) { derived.fill(0); throw cause; }
  }
  finally { password.fill(0); }
}
export async function createPinRecord(pin: string, random: (size: number) => Uint8Array, work?: PinWork): Promise<PinRecord> {
  if (!validPin(pin)) throw new Error("invalidPin");
  const salt = random(16), derived = await derivePin(pin, salt, work);
  try { return { algorithm: "scrypt", digits: PIN_DIGITS, ...SCRYPT_COST, salt: bytesToHex(salt), hash: bytesToHex(derived) }; }
  finally { derived.fill(0); }
}
export async function comparePin(pin: string, record: PinRecord, work?: PinWork) {
  if (record.algorithm === "device-hmac-sha256") throw new Error("securityStorage");
  if (!validPinRecord(record) || !validStoredPin(pin, record)) return false;
  const actual = await derivePin(pin, hexToBytes(record.salt), work, record.algorithm === "pbkdf2-sha256"), expected = hexToBytes(record.hash);
  try { let difference = 0; for (let i = 0; i < expected.length; i++) difference |= actual[i] ^ expected[i]; return difference === 0; }
  finally { actual.fill(0); expected.fill(0); }
}
