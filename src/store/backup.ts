import { Directory, File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fromByteArray, toByteArray } from "base64-js";
import { decodeBackup, encodeBackup, mapBackupImages, BACKUP_LIMIT, type BackupAsset, type BackupManifest } from "./backupFormat";
import { parseBusiness, type BusinessData } from "./business";
const hash = (bytes: Uint8Array) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, fromByteArray(bytes));
export async function createBackup(data: BusinessData, options: { temporary?: boolean; metadataKey?:string } = {}) {
  parseBusiness(JSON.stringify(data));
  const uris = new Map<string, string>();
  const portable = mapBackupImages(data, (uri) => { let id = uris.get(uri); if (!id) { id = `assets/${Crypto.randomUUID()}`; uris.set(uri, id); } return `asset://${id}`; });
  const assets: Record<string, Uint8Array> = {}; const metadata: BackupAsset[] = []; let total = 0;
  for (const [uri, id] of uris) {
    let bytes: Uint8Array;
    try {
      if (/^data:image\/(png|jpeg);base64,/.test(uri)) bytes = toByteArray(uri.split(",")[1]);
      else { if (!uri.startsWith("file://")) throw new Error(); const file = new File(uri); if (!file.exists || file.size > 3_000_000) throw new Error(); bytes = await file.bytes(); }
    } catch { throw new Error("missingAsset"); }
    total += bytes.length; if (!bytes.length || bytes.length > 3_000_000 || total > BACKUP_LIMIT - 15_000_000) throw new Error("invalidBackup");
    assets[id] = bytes; metadata.push({ id, bytes: bytes.length, hash: await hash(bytes) });
  }
  const [language, theme] = await Promise.all([AsyncStorage.getItem("@dokanx/language"), AsyncStorage.getItem("@dokanx/theme")]);
  const preferences: NonNullable<BackupManifest["preferences"]> = { ...(language === "bn" || language === "en" ? { language } : {}), ...(theme === "light" || theme === "dark" || theme === "system" ? { theme } : {}) };
  const createdAt = new Date().toISOString(); const manifest: BackupManifest = { format: "DokanX", version: 1, createdAt, data: portable, assets: metadata, preferences };
  const bytes = encodeBackup(manifest, assets);
  const folder = new Directory(options.temporary ? Paths.cache : Paths.document, options.temporary ? "cloud-backups" : "backups"); folder.create({ intermediates: true, idempotent: true });
  const file = new File(folder, `DokanX-${createdAt.replace(/[:.]/g, "-")}-${Crypto.randomUUID().slice(0, 8)}.dokanx`);
  try {
    file.write(bytes);
    // Never advertise an archive as ready until the receiving-phone restore path accepts it.
    await readBackup(file.uri);
  } catch (e) { if (file.exists) file.delete(); throw e; }
  if (!options.temporary) await AsyncStorage.setItem(options.metadataKey ?? "@dokanx/last-backup/v1", JSON.stringify({ uri: file.uri, createdAt })).catch(() => {});
  return { uri: file.uri, createdAt };
}
export async function readBackup(uri: string) {
  let backupStage = "file", length = 0;
  try {
    // Materialise our own byte array across Expo Go/native module versions and
    // document providers. Metadata such as `exists` can be unavailable for a
    // readable content URI; the actual read and archive validation are authoritative.
    let encoded: string;
    try {
      const file = new File(uri); if (file.size > BACKUP_LIMIT) throw new Error("invalidBackup");
      encoded = await file.base64();
    } catch (error) {
      if (error instanceof Error && error.message === "invalidBackup") throw error;
      if (typeof __DEV__ !== "undefined" && __DEV__) console.info("[backup] native reader fallback", {
        message: String(error instanceof Error ? error.message : "nativeReadFailed")
          .replace(/(?:file|content):\/\/[^\s'"\)]+|\/data\/[^\s'"\)]+/g, "<local-file>").slice(0, 300),
      });
      const legacy = await import("expo-file-system/legacy");
      const info = await legacy.getInfoAsync(uri).catch(() => undefined);
      if (info?.exists && "size" in info && info.size > BACKUP_LIMIT) throw new Error("invalidBackup");
      encoded = await legacy.readAsStringAsync(uri, { encoding: legacy.EncodingType.Base64, position: 0, length: BACKUP_LIMIT + 1 });
    }
    if (typeof encoded !== "string" || !encoded.length || encoded.length > Math.ceil(BACKUP_LIMIT / 3) * 4)
      throw new Error("invalidBackup");
    const bytes = toByteArray(encoded); length = bytes.length; backupStage = "archive";
    const result = decodeBackup(bytes);
    backupStage = "images";
    for (const asset of result.manifest.assets) if (await hash(result.assets[asset.id]) !== asset.hash) throw new Error("invalidBackup");
    return result;
  } catch (error) {
    const stage = (error as { backupStage?: string })?.backupStage ?? backupStage;
    if (typeof __DEV__ !== "undefined" && __DEV__) console.info("[backup] validation failed", {
      stage, bytes: length,
      message: String(error instanceof Error ? error.message : "validationFailed")
        .replace(/(?:file|content):\/\/[^\s'"\)]+|\/data\/[^\s'"\)]+/g, "<local-file>").slice(0, 300),
    });
    throw Object.assign(new Error("invalidBackup"), { backupStage: stage });
  }
}
export async function stageRestore(backup: Awaited<ReturnType<typeof readBackup>>) {
  const folder = new Directory(Paths.document, "restored-assets", Crypto.randomUUID()); folder.create({ intermediates: true });
  try {
    const uris = new Map<string, string>();
    for (const asset of backup.manifest.assets) {
      const bytes = backup.assets[asset.id]; const ext = bytes[0] === 137 && bytes[1] === 80 ? "png" : bytes[0] === 255 && bytes[1] === 216 ? "jpg" : undefined;
      if (!ext) throw new Error("invalidBackup");
      const file = new File(folder, `${asset.id.slice(7)}.${ext}`); file.write(bytes); uris.set(asset.id, file.uri);
    }
    const data = parseBusiness(JSON.stringify(mapBackupImages(backup.manifest.data, (uri) => { const target = uris.get(uri.slice(8)); if (!target) throw new Error("invalidBackup"); return target; })));
    return { data, cleanup: () => { if (folder.exists) folder.delete(); } };
  } catch (e) { if (folder.exists) folder.delete(); throw e; }
}
export { shareBackup, saveBackup } from "./backupExport";
