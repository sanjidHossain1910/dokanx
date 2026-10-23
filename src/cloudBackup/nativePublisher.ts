import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";
import * as Crypto from "expo-crypto";
import type { BusinessData } from "../store/business";
import type { AccountRequest } from "../account/controller";
import { createBackup } from "../store/backup";
import { cloudSnapshotSignature } from "./signature";
import { createCloudBackupController } from "./controller";

export function createNativePublisher(deps: {
  storageKey: string;
  generation: () => Promise<string>;
  current: () => boolean;
  capture: () => BusinessData;
  request: (path: string, options?: AccountRequest) => Promise<unknown>;
}) {
  return createCloudBackupController({
    diagnostic: (stage, error) => { if (__DEV__) console.info("[cloud-backup] operation failed", { stage, error }); },
    current: deps.current,
    read: () => AsyncStorage.getItem(deps.storageKey),
    write: value => AsyncStorage.setItem(deps.storageKey, value),
    generation: deps.generation,
    signature: () => cloudSnapshotSignature(deps.capture()),
    async prepare(baseId) {
      const data = deps.capture();
      const fingerprint = await cloudSnapshotSignature(data);
      const archive = await createBackup(data, { temporary: true });
      try {
        const bytes = await new File(archive.uri).bytes();
        const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes).buffer);
        return {
          requestKey: Crypto.randomUUID(), baseId, signature: fingerprint,
          archiveHash: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join(""),
          bytes: bytes.length, uri: archive.uri,
        };
      } catch (error) {
        try { const file = new File(archive.uri); if (file.exists) file.delete(); } catch {}
        throw error;
      }
    },
    exists: uri => new File(uri).exists,
    remove: uri => { try { const file = new File(uri); if (file.exists) file.delete(); } catch {} },
    request: deps.request,
  });
}
