import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { strToU8, zipSync, zlibSync } from "fflate";
import { emptyBusiness, addProduct } from "../src/store/business.ts";
import { decodeBackup, encodeBackup, mapBackupImages } from "../src/store/backupFormat.ts";
import { receiptRaster } from "../src/store/receiptRaster.ts";
import { addCartProduct, completeSale } from "../src/store/pos.ts";
import { receiptHTML, salePaper } from "../src/store/receipt.ts";
const stamp = "2026-10-20T10:00:00Z";
const hash = (bytes) => createHash("sha256").update(Buffer.from(bytes).toString("base64")).digest("hex");
function fixture() {
  const photo = new Uint8Array([255, 216, 255, 217]); const asset = "assets/abcd-1234";
  const source = addProduct(emptyBusiness, { id: "p", name: "চাল", barcode: "", category: "", stock: 5, price: 8000, cost: 5000, photoUri: "file:///old-phone/p.jpg" });
  const cart = addCartProduct(source, "p", "sale", 1); const data = completeSale(cart, "sale", { method: "cash", received: 8000, note: "private note", reference: "private reference", createdAt: stamp });
  const portable = mapBackupImages(data, () => `asset://${asset}`);
  const manifest = { format: "DokanX", version: 1, createdAt: stamp, data: portable, assets: [{ id: asset, bytes: photo.length, hash: hash(photo) }] };
  return { source: data, manifest, assets: { [asset]: photo }, asset };
}
test("portable backup deduplicates image references in products and immutable history", () => {
  const { source, manifest, assets, asset } = fixture(); const bytes = encodeBackup(manifest, assets); const decoded = decodeBackup(bytes);
  assert.deepEqual(decoded.manifest, JSON.parse(JSON.stringify(manifest))); assert.deepEqual(decoded.assets, assets);
  const restored = mapBackupImages(decoded.manifest.data, (uri) => `file:///new-phone/${uri.slice(8)}.jpg`);
  assert.equal(restored.products[0].photoUri, `file:///new-phone/${asset}.jpg`); assert.equal(restored.invoices[0].items[0].photoUri, restored.products[0].photoUri);
  assert.equal(source.products[0].photoUri, "file:///old-phone/p.jpg"); assert.equal(restored.products[0].id, source.products[0].id); assert.equal(restored.invoices[0].id, source.invoices[0].id); assert.equal(restored.products[0].stock, 4);
});
test("backup validates format, records, complete image references and archive entry paths", () => {
  const { manifest, assets } = fixture();
  for (const corrupt of [(m) => m.version = 2, (m) => m.format = "other", (m) => m.createdAt = "bad", (m) => m.data.products[0].stock = -1, (m) => m.data.products[0].photoUri = "file:///another-phone/p.jpg", (m) => m.assets[0].bytes = 200, (m) => m.assets[0].hash = "no", (m) => m.data.invoices[0].items[0].photoUri = "asset://assets/missing"]) { const changed = structuredClone(manifest); corrupt(changed); assert.throws(() => decodeBackup(encodeBackup(changed, assets)), /invalidBackup/); }
  assert.throws(() => decodeBackup(new Uint8Array([1, 2, 3])), /invalidBackup/);
  assert.throws(() => decodeBackup(zipSync({ "manifest.json": strToU8(JSON.stringify(manifest)), ...assets, "../attack.jpg": new Uint8Array([1]) })), /invalidBackup/);
  const dataOnly = { ...manifest, data: emptyBusiness, assets: [] }; assert.equal(decodeBackup(encodeBackup(dataOnly, {})).manifest.data.shopName, "DokanX");
});
test("printed sales receipt has the requested fields and fixed final Thank you", () => {
  const { source } = fixture(); const invoice = { ...source.invoices[0], shopPhone: "SECRET_PHONE", customerName: "SECRET_CUSTOMER", receiptFooter: "SECRET_FOOTER" };
  const html = receiptHTML(invoice, "bn", (key) => key), paper = salePaper(invoice, "bn");
  for (const text of [invoice.shopName, invoice.invoiceNumber, "চাল", "Thank you"]) assert.ok(html.includes(text));
  for (const secret of ["SECRET_PHONE", "SECRET_CUSTOMER", "SECRET_FOOTER", "private note", "private reference", "Subtotal", "Payment"]) assert.equal(html.includes(secret), false);
  assert.match(html, /<footer>Thank you<\/footer>/); assert.equal(paper.items.length, 1); assert.equal(paper.transactionId, invoice.invoiceNumber); assert.equal(paper.date, new Date(stamp).toLocaleString("bn-BD"));
});
function png(width, filter = 0) {
  const height = 2, channels = 4, stride = width * channels;
  const pixels = new Uint8Array(height * stride).fill(255); pixels.set([0, 0, 0, 255], 0); pixels.set([0, 0, 0, 0], 4); pixels.set([0, 0, 0, 255], stride + width * 4 - 4);
  const raw = new Uint8Array(height * (stride + 1));
  const paeth = (a, b, c) => { const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c); return da <= db && da <= dc ? a : db <= dc ? b : c; };
  for (let y = 0; y < height; y++) { raw[y * (stride + 1)] = filter; for (let x = 0; x < stride; x++) { const at = y * stride + x, a = x >= channels ? pixels[at - channels] : 0, b = y ? pixels[at - stride] : 0, c = y && x >= channels ? pixels[at - stride - channels] : 0; raw[y * (stride + 1) + x + 1] = pixels[at] - (filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : filter === 4 ? paeth(a, b, c) : 0); } }
  const idat = zlibSync(raw), output = new Uint8Array(33 + 12 + idat.length + 12); const dv = new DataView(output.buffer);
  output.set([137,80,78,71,13,10,26,10]); dv.setUint32(8,13); dv.setUint32(12,0x49484452); dv.setUint32(16,width); dv.setUint32(20,height); output.set([8,6,0,0,0],24); dv.setUint32(33,idat.length); dv.setUint32(37,0x49444154); output.set(idat,41); dv.setUint32(49+idat.length,0x49454e44); return output;
}
test("58mm and 80mm raster output preserves exact dot width, transparency and all PNG filters", () => {
  for (const width of [384,576]) for (let filter = 0; filter <= 4; filter++) {
    const commands = receiptRaster(png(width,filter), width); const packet = commands[1];
    assert.deepEqual(commands[0], [27,64,27,97,0]); assert.deepEqual(packet.slice(0,8), [29,118,48,0,width/8,0,2,0]);
    assert.equal(packet[8],128); assert.equal(packet.at(-1),1); assert.equal(packet.reduce((n,x)=>n+x,0),packet.slice(0,8).reduce((n,x)=>n+x,0)+129); assert.deepEqual(commands.at(-1),[10,10,10]);
  }
  assert.throws(() => receiptRaster(png(384),576),/printerFailed/); assert.throws(() => receiptRaster(new Uint8Array(40),384),/printerFailed/);
});
