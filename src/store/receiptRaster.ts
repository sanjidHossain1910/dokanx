import { unzlibSync } from "fflate";
/** Decode our own ViewShot PNG and send standard ESC/POS raster rows, at the chosen paper width. */
export function receiptRaster(png: Uint8Array, width: 384 | 576): number[][] {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const u32 = (n: number) => dv.getUint32(n);
  if (png.length < 33 || u32(0) !== 0x89504e47 || u32(4) !== 0x0d0a1a0a || u32(16) !== width || png[24] !== 8 || png[28] !== 0) throw new Error("printerFailed");
  const height = u32(20), channels = ({ 0: 1, 2: 3, 4: 2, 6: 4 } as Record<number, number>)[png[25]];
  if (!channels || height < 1 || height > 50000) throw new Error("printerFailed");
  const chunks: Uint8Array[] = []; let size = 0;
  for (let offset = 8; offset + 12 <= png.length;) {
    const length = u32(offset); if (offset + 12 + length > png.length) throw new Error("printerFailed");
    if (u32(offset + 4) === 0x49444154) { const chunk = png.subarray(offset + 8, offset + 8 + length); chunks.push(chunk); size += length; }
    offset += 12 + length;
  }
  const compressed = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { compressed.set(chunk, offset); offset += chunk.length; }
  const stride = width * channels, raw = unzlibSync(compressed, { out: new Uint8Array((stride + 1) * height) });
  const pixels = new Uint8Array(stride * height);
  const paeth = (a: number, b: number, c: number) => { const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c); return da <= db && da <= dc ? a : db <= dc ? b : c; };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; if (filter > 4) throw new Error("printerFailed");
    for (let x = 0; x < stride; x++) { const at = y * stride + x, a = x >= channels ? pixels[at - channels] : 0, b = y ? pixels[at - stride] : 0, c = y && x >= channels ? pixels[at - stride - channels] : 0; pixels[at] = raw[y * (stride + 1) + x + 1] + (filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : filter === 4 ? paeth(a, b, c) : 0); }
  }
  const commands: number[][] = [[27, 64, 27, 97, 0]];
  const bytesWide = width / 8;
  for (let y = 0; y < height; y += 24) {
    const rows = Math.min(24, height - y), packet = new Uint8Array(8 + rows * bytesWide); packet.set([29, 118, 48, 0, bytesWide & 255, bytesWide >> 8, rows, 0]);
    for (let row = 0; row < rows; row++) for (let x = 0; x < width; x++) {
      const at = ((y + row) * width + x) * channels, gray = channels <= 2 ? pixels[at] : 0.299 * pixels[at] + 0.587 * pixels[at + 1] + 0.114 * pixels[at + 2], alpha = channels === 2 || channels === 4 ? pixels[at + channels - 1] / 255 : 1;
      if (gray * alpha + 255 * (1 - alpha) < 176) packet[8 + row * bytesWide + (x >> 3)] |= 128 >> (x % 8);
    }
    commands.push(Array.from(packet));
  }
  commands.push([10, 10, 10]); return commands;
}
