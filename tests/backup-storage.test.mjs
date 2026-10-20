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
  const files = new Map(), folders = new Set(), prefs = new Map(); let serial = 0, failWrite = false;
  const uri = (value) => typeof value === "string" ? value : value.uri;
  class Directory {
    constructor(...parts) { this.uri = parts.map(uri).join("/"); }
    create() { folders.add(this.uri); }
    get exists() { return folders.has(this.uri); }
    delete() { for (const path of files.keys()) if (path.startsWith(this.uri + "/")) files.delete(path); folders.delete(this.uri); }
  }
  class File {
    constructor(...parts) { this.uri = parts.map(uri).join("/"); }
    get exists() { return files.has(this.uri); }
    get size() { return files.get(this.uri)?.length ?? 0; }
    async bytes() { return files.get(this.uri); }
    write(bytes) { files.set(this.uri, bytes); if (failWrite) throw new Error("Disk full"); }
    delete() { files.delete(this.uri); }
  }
  const modules = {
    "expo-file-system": { File, Directory, Paths: { document: { uri: "file:///documents" } } },
    "expo-crypto": { randomUUID: () => `0000-000${++serial}`, CryptoDigestAlgorithm: { SHA256: "SHA256" }, digestStringAsync: async (_algorithm, value) => createHash("sha256").update(value).digest("hex") },
    "expo-sharing": {}, "base64-js": base64,
    "@react-native-async-storage/async-storage": { getItem: async (key) => prefs.get(key) ?? null, setItem: async (key, value) => prefs.set(key, value) },
    "./business": business, "./backupFormat": format,
  };
  const source = readFileSync(new URL("../src/store/backup.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  const exports = {};
  runInNewContext(outputText, { exports, Uint8Array, Map, Set, require: (key) => { assert.ok(modules[key], key); return modules[key]; } });
  return { ...exports, files, prefs, fail: () => { failWrite = true; } };
}
function imageShop(s) {
  s.files.set("file:///photos/p.jpg", new Uint8Array([255,216,255,217]));
  s.files.set("file:///photos/qr.png", new Uint8Array([137,80,78,71,13,10,26,10]));
  return { ...business.addProduct(business.emptyBusiness, { id: "p", name: "Rice", barcode: "", category: "", price: 100, cost: 70, stock: 1, photoUri: "file:///photos/p.jpg" }), paymentSettings: { bkash: { enabled: true, phone: "01712345678", qrUri: "file:///photos/qr.png" }, nagad: { enabled: false, phone: "" } } };
}
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
