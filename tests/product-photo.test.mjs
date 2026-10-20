import assert from "node:assert/strict";
import test from "node:test";
import { squareCrop, validPhotoBytes } from "../src/store/photoRules.ts";

test("landscape and portrait crops stay square and within the original photo", () => {
  assert.deepEqual(squareCrop(4000, 3000), { originX: 500, originY: 0, width: 3000, height: 3000 });
  assert.deepEqual(squareCrop(3000, 4000), { originX: 0, originY: 500, width: 3000, height: 3000 });
  for (const [width, height] of [[4000, 3000], [3000, 4000], [301, 301]]) {
    for (const zoom of [1, 1.25, 2, 3]) {
      for (const position of [-2, 0, 0.5, 1, 4]) {
        const crop = squareCrop(width, height, zoom, position, position);
        assert.equal(crop.width, crop.height);
        assert.ok(crop.originX >= 0 && crop.originY >= 0);
        assert.ok(crop.originX + crop.width <= width && crop.originY + crop.height <= height);
      }
    }
  }
});

test("photo size cap accepts exactly 1 MB and rejects oversized or unknown sizes", () => {
  assert.equal(validPhotoBytes(1_000_000), true);
  for (const size of [1_000_001, 0, -1, NaN, Infinity, undefined]) assert.equal(validPhotoBytes(size), false);
  for (const dimensions of [[0, 10], [10, 0], [NaN, 10]]) assert.throws(() => squareCrop(...dimensions));
});
