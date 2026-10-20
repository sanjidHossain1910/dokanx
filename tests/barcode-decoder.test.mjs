import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decode } from 'jpeg-js';
import { decodeBarcodeJpeg, decodeBarcodePixels } from '../src/scanner/decodeBarcode.ts';

// Barcode-only crop of the failing emulator frame supplied during debugging.
const fixture = readFileSync(new URL('./fixtures/ean13-mirrored.jpg', import.meta.url));

test('software decoder reads the actual mirrored EAN-13 image from the emulator', () => {
  assert.deepEqual(decodeBarcodeJpeg(fixture.toString('base64')), { data: '6943320882250', type: 'ean13' });
});

test('software decoder reads the same real barcode at every camera orientation', () => {
  let { data, width, height } = decode(fixture, { useTArray: true });
  for (let turn = 0; turn < 4; turn++) {
    assert.equal(decodeBarcodePixels(data, width, height)?.data, '6943320882250');
    const rotated = new Uint8Array(data.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4;
      rotated.set(data.subarray(from, from + 4), (x * height + height - y - 1) * 4);
    }
    data = rotated;
    [width, height] = [height, width];
  }
});

test('software decoder reports no result for a blank frame and rejects invalid input', () => {
  assert.equal(decodeBarcodePixels(new Uint8Array(80 * 40 * 4).fill(255), 80, 40), null);
  assert.throws(() => decodeBarcodePixels(new Uint8Array(3), 80, 40), /dimensions/);
  assert.throws(() => decodeBarcodeJpeg('invalid'));
});
