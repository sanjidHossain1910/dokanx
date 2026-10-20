import assert from "node:assert/strict";
import test from "node:test";
import { qrSquareCrop, rotatedQrSize, validQrCrop } from "../src/store/paymentQrRules.ts";

test("QR crops remain square and within rotated portrait/landscape image boundaries", () => {
  for (const rotation of [0, 90, 180, 270]) {
    const size = rotatedQrSize(900, 1100, rotation);
    for (const zoom of [1, 1.5, 3, 8]) for (const x of [0, 0.5, 1]) for (const y of [0, 0.5, 1]) {
      const crop = qrSquareCrop(size.width, size.height, zoom, x, y);
      assert.equal(crop.width, crop.height);
      assert.equal(validQrCrop(crop, size.width, size.height), true);
    }
  }
  assert.deepEqual(rotatedQrSize(900, 1100, 90), { width: 1100, height: 900 });
  assert.deepEqual(qrSquareCrop(900, 1100, 1.5), { originX: 150, originY: 250, width: 600, height: 600 });
});
test("QR adjustment rejects invalid dimensions, angles and out-of-bounds rectangles", () => {
  for (const dims of [[0, 100, 0], [100, NaN, 0], [100, 100, 45], [0.5, 100, 90]]) assert.throws(() => rotatedQrSize(...dims), /qrFailed/);
  for (const zoom of [0, -1, 8.1, NaN]) assert.throws(() => qrSquareCrop(900, 1100, zoom), /qrFailed/);
  assert.equal(validQrCrop({ originX: -1, originY: 0, width: 600, height: 600 }, 900, 1100), false);
  assert.equal(validQrCrop({ originX: 800, originY: 0, width: 600, height: 600 }, 900, 1100), false);
  assert.equal(validQrCrop({ originX: 0, originY: 0, width: 0, height: 0 }, 900, 1100), false);
});
