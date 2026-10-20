import { Directory, File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fromByteArray, toByteArray } from "base64-js";
import { decodeBackup, encodeBackup, mapBackupImages, BACKUP_LIMIT, type BackupAsset, type BackupManifest } from "./backupFormat";
import { parseBusiness, type BusinessData } from "./business";
const hash = (bytes: Uint8Array) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, fromByteArray(bytes));
export async function createBackup(data: BusinessData) {
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
  const folder = new Directory(Paths.document, "backups"); folder.create({ intermediates: true, idempotent: true });
  const file = new File(folder, `DokanX-${createdAt.replace(/[:.]/g, "-")}-${Crypto.randomUUID().slice(0, 8)}.dokanx`);
  try { file.write(bytes); } catch (e) { if (file.exists) file.delete(); throw e; }
  await AsyncStorage.setItem("@dokanx/last-backup/v1", JSON.stringify({ uri: file.uri, createdAt })).catch(() => {});
  return { uri: file.uri, createdAt };
}
export async function readBackup(uri: string) {
  const file = new File(uri); if (!file.exists || file.size > BACKUP_LIMIT) throw new Error("invalidBackup");
  const result = decodeBackup(await file.bytes());
  for (const asset of result.manifest.assets) if (await hash(result.assets[asset.id]) !== asset.hash) throw new Error("invalidBackup");
  return result;
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
export async function shareBackup(uri: string) { if (!await Sharing.isAvailableAsync()) throw new Error("backupFailed"); await Sharing.shareAsync(uri, { mimeType: "application/octet-stream", UTI: "public.data", dialogTitle: "DokanX backup" }); }
