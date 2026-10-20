import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { parseBusiness, type BusinessData } from "./business.ts";
export const BACKUP_LIMIT = 60_000_000;
export type BackupAsset = { id: string; bytes: number; hash: string };
export type BackupManifest = { format: "DokanX"; version: 1; createdAt: string; data: BusinessData; assets: BackupAsset[]; preferences?: { language?: "en" | "bn"; theme?: "light" | "dark" | "system" } };
const imageKeys = new Set(["photoUri", "shopPhotoUri", "qrUri"]);
/** Traverse drafts and immutable history too: every retained image must be portable. */
export function mapBackupImages(data: BusinessData, map: (uri: string) => string): BusinessData {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, imageKeys.has(k) && typeof v === "string" ? map(v) : visit(v)]));
    return value;
  };
  return visit(data) as BusinessData;
}
export function encodeBackup(manifest: BackupManifest, assets: Record<string, Uint8Array>) {
  const json = strToU8(JSON.stringify(manifest));
  if (json.length > 15_000_000 || Object.keys(assets).length > 2000) throw new Error("invalidBackup");
  const bytes = zipSync({ "manifest.json": json, ...assets }, { level: 0 });
  if (bytes.length > BACKUP_LIMIT) throw new Error("invalidBackup");
  return bytes;
}
export function decodeBackup(bytes: Uint8Array): { manifest: BackupManifest; assets: Record<string, Uint8Array> } {
  try {
    if (!bytes.length || bytes.length > BACKUP_LIMIT) throw new Error();
    let total = 0, count = 0;
    const files = unzipSync(bytes, { filter: (f) => {
      count++; total += f.originalSize;
      if (count > 2001 || total > BACKUP_LIMIT || !Number.isSafeInteger(f.originalSize) || f.originalSize < 1 || (f.name === "manifest.json" ? f.originalSize > 15_000_000 : !/^assets\/[a-f0-9-]+$/.test(f.name) || f.originalSize > 3_000_000)) throw new Error();
      return true;
    } });
    if (!files["manifest.json"]) throw new Error();
    const manifest: BackupManifest = JSON.parse(strFromU8(files["manifest.json"]));
    if (manifest.format !== "DokanX" || manifest.version !== 1 || typeof manifest.createdAt !== "string" || !Number.isFinite(Date.parse(manifest.createdAt)) || !Array.isArray(manifest.assets) || manifest.assets.length > 2000 || Object.keys(files).length !== manifest.assets.length + 1 || new Set(manifest.assets.map((a) => a.id)).size !== manifest.assets.length) throw new Error();
    const used = new Set<string>();
    if (manifest.preferences !== undefined && (!manifest.preferences || typeof manifest.preferences !== "object" || manifest.preferences.language !== undefined && !["en", "bn"].includes(manifest.preferences.language) || manifest.preferences.theme !== undefined && !["light", "dark", "system"].includes(manifest.preferences.theme))) throw new Error();
    for (const asset of manifest.assets) if (!/^assets\/[a-f0-9-]+$/.test(asset.id) || !Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || !/^[a-f0-9]{64}$/.test(asset.hash) || files[asset.id]?.length !== asset.bytes) throw new Error();
    parseBusiness(JSON.stringify(mapBackupImages(manifest.data, (uri) => { if (!uri.startsWith("asset://") || !manifest.assets.some((a) => a.id === uri.slice(8))) throw new Error(); used.add(uri.slice(8)); return `file:///backup-validation/${uri.slice(8)}`; })));
    if (used.size !== manifest.assets.length || count !== manifest.assets.length + 1) throw new Error();
    delete files["manifest.json"];
    return { manifest, assets: files };
  } catch { throw new Error("invalidBackup"); }
}
