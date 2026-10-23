import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as format from "../src/store/backupFormat.ts";
import * as business from "../src/store/business.ts";
import * as base64 from "base64-js";
function storage() {
  const files = new Map(), folders = new Set(), prefs = new Map(); let serial = 0, failWrite = false, truncateWrite = false, unknownMetadata = false, modernReadFails = false;
  const uri = (value) => typeof value === "string" ? value : value.uri;
  class Directory {
    constructor(...parts) { this.uri = parts.map(uri).join("/"); }
    create() { folders.add(this.uri); }
    get exists() { return folders.has(this.uri); }
    delete() { for (const path of files.keys()) if (path.startsWith(this.uri + "/")) files.delete(path); folders.delete(this.uri); }
  }
  class File {
    constructor(...parts) { this.uri = parts.map(uri).join("/"); }
    get exists() { return !unknownMetadata && files.has(this.uri); }
    get size() { return files.get(this.uri)?.length ?? 0; }
    async bytes() { return files.get(this.uri); }
    async base64() { if (modernReadFails) throw new Error("Native file object unavailable"); const bytes = files.get(this.uri); if (!bytes) throw new Error("File unavailable"); return base64.fromByteArray(bytes); }
    write(bytes) { files.set(this.uri, truncateWrite ? bytes.slice(0, bytes.length - 2) : bytes); if (failWrite) throw new Error("Disk full"); }
    delete() { files.delete(this.uri); }
  }
  const modules = {
    "expo-file-system": { File, Directory, Paths: { document: { uri: "file:///documents" } } },
    "expo-crypto": { randomUUID: () => `0000-000${++serial}`, CryptoDigestAlgorithm: { SHA256: "SHA256" }, digestStringAsync: async (_algorithm, value) => createHash("sha256").update(value).digest("hex") },
    "./backupExport": {}, "base64-js": base64,
    "expo-file-system/legacy": { EncodingType: { Base64: "base64" }, getInfoAsync: async uri => ({ exists: files.has(uri), size: files.get(uri)?.length ?? 0 }), readAsStringAsync: async (uri, options) => { assert.equal(options.encoding, "base64"); assert.equal(options.length, format.BACKUP_LIMIT + 1); const bytes = files.get(uri); if (!bytes) throw new Error("File unavailable"); return base64.fromByteArray(bytes); } },
    "@react-native-async-storage/async-storage": { getItem: async (key) => prefs.get(key) ?? null, setItem: async (key, value) => prefs.set(key, value) },
    "./business": business, "./backupFormat": format,
  };
  const source = readFileSync(new URL("../src/store/backup.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  const exports = {};
  runInNewContext(outputText, { exports, Uint8Array, Map, Set, require: (key) => { assert.ok(modules[key], key); return modules[key]; } });
  return { ...exports, files, prefs, fail: () => { failWrite = true; }, truncate: () => { truncateWrite = true; }, unknownMetadata: () => { unknownMetadata = true; }, failModernReader: () => { modernReadFails = true; } };
}
function imageShop(s) {
  s.files.set("file:///photos/p.jpg", new Uint8Array([255,216,255,217]));
  s.files.set("file:///photos/qr.png", new Uint8Array([137,80,78,71,13,10,26,10]));
  return { ...business.addProduct(business.emptyBusiness, { id: "p", name: "Rice", barcode: "", category: "", price: 100, cost: 70, stock: 1, photoUri: "file:///photos/p.jpg" }), paymentSettings: { bkash: { enabled: true, phone: "01712345678", qrUri: "file:///photos/qr.png" }, nagad: { enabled: false, phone: "" } } };
}

test("a truncated native write cannot be advertised as a ready backup", async () => {
  const s = storage(); const data = imageShop(s); s.truncate();
  await assert.rejects(s.createBackup(data), /invalidBackup/);
  assert.equal(s.prefs.has('@dokanx/last-backup/v1'), false);
  assert.equal([...s.files.keys()].some(uri => uri.includes('/backups/')), false);
  assert.ok(s.files.has(data.products[0].photoUri));
});

test("restore validates a document-provider backup even when native existence metadata is unavailable", async () => {
  const s = storage(), data = imageShop(s); const saved = await s.createBackup(data);
  s.files.set('content://selected/backup.dokanx', s.files.get(saved.uri));
  s.unknownMetadata();
  const restored = await s.readBackup('content://selected/backup.dokanx');
  assert.equal(restored.manifest.data.products.length, 1);
  assert.equal(restored.manifest.assets.length, 2);
});

test("unreadable files and broken native base64 exports are rejected before restore", async () => {
  const s = storage(); await assert.rejects(s.readBackup('content://missing'), /invalidBackup/);
  s.files.set('content://invalid', new Uint8Array([1, 2, 3]));
  await assert.rejects(s.readBackup('content://invalid'), /invalidBackup/);
});

test("an unavailable native File reader falls back to the bounded legacy reader and keeps all validation", async () => {
  const s = storage(), data = imageShop(s); const saved = await s.createBackup(data);
  s.failModernReader();
  const backup = await s.readBackup(saved.uri);
  assert.equal(backup.manifest.data.products.length, 1); assert.equal(backup.manifest.assets.length, 2);
  const bytes = s.files.get(saved.uri); s.files.set(saved.uri, bytes.slice(0, bytes.length - 2));
  await assert.rejects(s.readBackup(saved.uri), /invalidBackup/);
});
test("native backup copies and verifies photos and QR bytes, then stages new local URIs", async () => {
  const s = storage(); s.prefs.set("@dokanx/language", "bn"); s.prefs.set("@dokanx/theme", "dark"); const shop = imageShop(s);
  const saved = await s.createBackup(shop); const backup = await s.readBackup(saved.uri);
  assert.equal(backup.manifest.preferences.language, "bn"); assert.equal(backup.manifest.preferences.theme, "dark"); assert.equal(backup.manifest.assets.length, 2);
  const staged = await s.stageRestore(backup); assert.ok(staged.data.products[0].photoUri.startsWith("file:///documents/restored-assets/")); assert.ok(staged.data.paymentSettings.bkash.qrUri.endsWith(".png"));
  assert.deepEqual(s.files.get(staged.data.products[0].photoUri), s.files.get(shop.products[0].photoUri));
  staged.cleanup(); assert.equal(s.files.has(staged.data.products[0].photoUri), false); assert.equal(s.files.has(shop.products[0].photoUri), true); assert.equal(s.files.has(saved.uri), true);
});
test("native restore rejects corrupted bytes before staging or touching existing files", async () => {
  const s = storage(); const shop = imageShop(s); const saved = await s.createBackup(shop); const backup = await s.readBackup(saved.uri);
  backup.assets[backup.manifest.assets[0].id][2] ^= 1;
  const bad = format.encodeBackup(backup.manifest, backup.assets); s.files.set("file:///corrupted.dokanx", bad);
  await assert.rejects(s.readBackup("file:///corrupted.dokanx"), /invalidBackup/); assert.equal(s.files.has(shop.products[0].photoUri), true);
});
test("missing source photos and staged write failures preserve current files and clean partial output", async () => {
  const missing = storage(); const shop = imageShop(missing); missing.files.delete(shop.products[0].photoUri); await assert.rejects(missing.createBackup(shop), /missingAsset/);
  const s = storage(); const current = imageShop(s); const saved = await s.createBackup(current); const backup = await s.readBackup(saved.uri); s.fail();
  await assert.rejects(s.stageRestore(backup), /Disk full/); assert.equal([...s.files.keys()].some((p) => p.includes("restored-assets")), false); assert.equal(s.files.has(current.products[0].photoUri), true); assert.equal(s.files.has(saved.uri), true);
});
