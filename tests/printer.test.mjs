import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
function printer({ module = true, granted = true, platform = "android", failConnect = false } = {}) {
  const records = new Map(), commands = []; let connected = false, initCount = 0, release;
  const native = { init: async () => { initCount++; }, getDeviceList: async () => [{ address: "AA:BB", name: "POS" }], connectPrinter: async () => { if (failConnect) throw new Error("Offline"); connected = true; }, disconnectPrinter: async () => { connected = false; }, isConnected: async () => connected, sendRawCommand: async (bytes) => { commands.push(bytes); if (release === true) await new Promise((resolve) => { release = resolve; }); } };
  const modules = {
    "@react-native-async-storage/async-storage": { getItem: async (key) => records.get(key) ?? null, setItem: async (key, value) => records.set(key, value), removeItem: async (key) => records.delete(key) },
    "react-native": { NativeModules: module ? { PosPrinter: native } : {}, Platform: { OS: platform, Version: 35 }, PermissionsAndroid: { PERMISSIONS: { BLUETOOTH_CONNECT: "connect", BLUETOOTH_SCAN: "scan" }, RESULTS: { GRANTED: "granted" }, requestMultiple: async (permissions) => Object.fromEntries(permissions.map((p) => [p, granted ? "granted" : "denied"])) } },
    "base64-js": { toByteArray: () => new Uint8Array([1]) }, "./receiptRaster": { receiptRaster: (_png, width) => [[width], [10,10,10]] },
  };
  const source = readFileSync(new URL("../src/store/printer.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  const exports = {}; runInNewContext(outputText, { exports, Error, setTimeout, clearTimeout, require: (key) => { assert.ok(modules[key], key); return modules[key]; } });
  return { ...exports, records, commands, initCount: () => initCount, defer: () => { release = true; }, finish: () => release() };
}
test("Expo Go, denied Bluetooth permission and unsupported platforms fail without persisting a printer", async () => {
  for (const [options, error] of [[{ module: false }, /printerBuildRequired/], [{ granted: false }, /printerPermission/], [{ platform: "ios" }, /printerPlatform/]]) { const s = printer(options); await assert.rejects(s.findPrinters(), error); assert.equal(s.initCount(), 0); assert.equal(s.records.size, 0); }
});
test("only verified connections persist and runtime connection can be reused", async () => {
  const s = printer(), settings = { address: "AA:BB", name: "POS", paperWidth: 58 };
  assert.equal((await s.findPrinters())[0].address, settings.address); await s.connectPrinter(settings); assert.equal((await s.readPrinter()).address, settings.address); assert.equal(s.initCount(), 1);
  await s.printBitmap({ ...settings, paperWidth: 80 }, "png"); assert.equal(s.commands[0][0], 576); assert.equal(s.initCount(), 1); await s.clearPrinter(); assert.equal(await s.readPrinter(), undefined);
  const failed = printer({ failConnect: true }); await assert.rejects(failed.connectPrinter(settings), /Offline/); assert.equal(failed.records.size, 0);
});
test("overlapping receipt jobs are rejected to prevent mixed printer output", async () => {
  const s = printer(), settings = { address: "AA:BB", name: "POS", paperWidth: 58 }; s.defer();
  const first = s.printBitmap(settings, "png"); await new Promise(setImmediate); await assert.rejects(s.printBitmap(settings, "other"), /printerBusy/); s.finish(); await first; assert.equal(s.commands[0][0], 384); assert.equal(s.commands.length, 2);
});
