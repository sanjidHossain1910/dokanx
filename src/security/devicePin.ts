import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { normalizePin, validPin, validPinRecord, type PinRecord, type PinWork } from "./pin.ts";

type DeviceKeyStore = { read: () => Promise<string | null>; write: (key: string) => Promise<void>; random: (size: number) => Uint8Array };
// This is an OS-keystore-backed UI lock, not a portable password hash. The random
// 256-bit key is a separate SecureStore item and must never enter shop backups.
export function createDevicePinService(store: DeviceKeyStore) {
  const check = (work?: PinWork) => { if (work?.signal?.aborted) throw new Error("authenticationCancelled"); };
  const secret = async (create: boolean) => {
    let value = await store.read();
    if (value === null && create) { value = bytesToHex(store.random(32)); await store.write(value); }
    if (!value || !/^[a-f0-9]{64}$/.test(value)) throw new Error("securityStorage");
    return hexToBytes(value);
  };
  const digest = (pin: string, salt: string, key: Uint8Array) => {
    const message = Uint8Array.from(Array.from(`dokanx/report-pin/v1\0${salt}\0${normalizePin(pin)}`, char => char.charCodeAt(0)));
    try { return hmac(sha256, key, message); } finally { message.fill(0); }
  };
  return {
    createPin: async (pin: string, random: (size: number) => Uint8Array, work?: PinWork): Promise<PinRecord> => {
      if (!validPin(pin)) throw new Error("invalidPin");
      check(work); work?.onProgress?.(0);
      const key = await secret(true);
      try {
        check(work); const salt = bytesToHex(random(16)), hash = digest(pin, salt, key);
        try { check(work); work?.onProgress?.(99); return { algorithm: "device-hmac-sha256", digits: 4, salt, hash: bytesToHex(hash) }; }
        finally { hash.fill(0); }
      } finally { key.fill(0); }
    },
    verifyPin: async (pin: string, record: PinRecord, work?: PinWork) => {
      if (!validPinRecord(record) || record.algorithm !== "device-hmac-sha256") throw new Error("pinUpgradeRequired");
      if (!validPin(pin)) return false;
      check(work); const key = await secret(false);
      try {
        check(work); const actual = digest(pin, record.salt, key), expected = hexToBytes(record.hash);
        try { let difference = 0; for (let i = 0; i < expected.length; i++) difference |= actual[i] ^ expected[i]; return difference === 0; }
        finally { actual.fill(0); expected.fill(0); }
      } finally { key.fill(0); }
    },
  };
}
