import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as photoRules from "../src/store/photoRules.ts";
import * as qrRules from "../src/store/paymentQrRules.ts";

// Exercise the actual storage functions with deferred native copies.
function storage(preparedSizes) {
  const files = new Set(["cache/source.png"]);
  const events = [];
  let finishCopy;
  const formats = [], widths = [], sizes = new Map(); let width = 200, renderIndex = 0, released = 0;
  class Directory {
    constructor(parent, name) { this.uri = `${parent.uri}/${name}`; }
    create() {}
  }
  class File {
    constructor(parent, name) { this.uri = name ? `${parent.uri}/${name}` : parent; }
    get exists() { return files.has(this.uri); }
    get size() { return this.exists ? sizes.get(this.uri) ?? 100 : 0; }
    delete() { files.delete(this.uri); events.push(`delete:${this.uri}`); }
    copy(destination) {
      events.push("copy:start");
      return new Promise((resolve, reject) => {
        finishCopy = (fail = false) => {
          files.add(destination.uri);
          if (fail || !this.exists) { reject(new Error("copy failed")); return; }
          events.push("copy:done"); resolve();
        };
      });
    }
  }
  const context = {
    reset() { return this; }, crop() { return this; }, resize(value) { width = value.width; widths.push(width); return this; },
    renderAsync: async () => ({ saveAsync: async options => {
      formats.push(options.format);
      const uri = preparedSizes ? `cache/render-${renderIndex}.png` : "cache/source.png";
      files.add(uri); sizes.set(uri, preparedSizes?.[renderIndex++] ?? 100);
      return { uri, width, height: width };
    }, release() { released++; } }), release() {},
  };
  const modules = {
    "expo-file-system": { File, Directory, Paths: { cache: { uri: "cache/" }, document: { uri: "documents" } } },
    "expo-image-manipulator": { ImageManipulator: { manipulate: () => context }, SaveFormat: { PNG: "png" } },
    "react-native": { Platform: { OS: "android" } },
    "./photoRules": photoRules,
    "./paymentQrRules": qrRules,
  };
  function load(name) {
    const source = readFileSync(new URL(`../src/store/${name}.ts`, import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    const exports = {};
    runInNewContext(outputText, { exports, require: (id) => {
      assert.ok(modules[id], `Unexpected dependency: ${id}`); return modules[id];
    } });
    return exports;
  }
  modules["./productPhotos"] = load("productPhotos");
  return { photos: modules["./productPhotos"], qr: load("paymentQr"), files, events, formats, widths, released: () => released, finish: (fail) => finishCopy(fail) };
}

test("QR cache stays available until copy finishes, then is removed", async () => {
  const s = storage();
  const saved = s.qr.savePaymentQr({ uri: "input.png", width: 200, height: 200 }, "qr-test");
  await new Promise(setImmediate);
  assert.deepEqual(s.events, ["copy:start"]);
  assert.ok(s.files.has("cache/source.png"));
  s.finish();
  assert.equal(await saved, "documents/payment-qr/qr-test.png");
  assert.deepEqual(s.events, ["copy:start", "copy:done", "delete:cache/source.png"]);
});

test("product crop preserves transparency with PNG and downsizes oversized output below 1 MB", async () => {
  const s = storage([1_500_000, 900_000]);
  const prepared = await s.photos.prepareProductPhoto({ uri: "cache/source.png", width: 1200, height: 1000 }, 1, 0.5, 0.5);
  assert.deepEqual(s.formats, ["png", "png"]); assert.deepEqual(s.widths, [960, 768]);
  assert.equal(prepared.format, "png"); assert.equal(prepared.bytes, 900000); assert.equal(prepared.width, prepared.height);
  assert.equal(s.files.has("cache/render-0.png"), false); assert.equal(s.files.has(prepared.uri), true); assert.equal(s.released(), 2);
  const saved = s.photos.saveProductPhoto(prepared, "transparent-product");
  await new Promise(setImmediate); s.finish();
  assert.equal(await saved, "documents/product-photos/transparent-product.png");
});

test("oversized PNG attempts are cleaned up without a saved product photo", async () => {
  const s = storage([2_000_000, 2_000_000, 2_000_000, 2_000_000, 2_000_000]);
  await assert.rejects(s.photos.prepareProductPhoto({ uri: "cache/source.png", width: 1200, height: 1200 }, 1, 0.5, 0.5), /photoTooLarge/);
  assert.deepEqual(s.widths, [960, 768, 640, 512, 448]);
  assert.equal([...s.files].some(uri => uri.startsWith("cache/render-")), false); assert.equal(s.released(), 5);
});

test("QR copy rejection reaches caller and removes partial output", async () => {
  const s = storage();
  const saved = s.qr.savePaymentQr({ uri: "input.png", width: 200, height: 200 }, "qr-test");
  const rejected = assert.rejects(saved, /copy failed/);
  await new Promise(setImmediate);
  s.finish(true);
  await rejected;
  assert.equal(s.files.size, 0);
});

test("product photo save waits for copy and propagates rejection", async () => {
  for (const fail of [false, true]) {
    const s = storage(); let settled = false;
    const saved = s.photos.saveProductPhoto({ uri: "cache/source.png", width: 200, height: 200, bytes: 100 }, "product-test");
    const checked = fail ? assert.rejects(saved, /copy failed/) : saved.then((uri) => assert.equal(uri, "documents/product-photos/product-test.jpg"));
    void checked.then(() => { settled = true; });
    await new Promise(setImmediate);
    assert.equal(settled, false);
    s.finish(fail);
    await checked;
    assert.equal(s.files.has("documents/product-photos/product-test.jpg"), !fail);
  }
});
