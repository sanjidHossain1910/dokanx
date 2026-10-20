import { BinaryBitmap, HybridBinarizer, RGBLuminanceSource, MultiFormatOneDReader, DecodeHintType, BarcodeFormat } from "@zxing/library";
import { decode } from "jpeg-js";
import { toByteArray } from "base64-js";

export function decodeBarcodePixels(pixels: Uint8Array, width: number, height: number) {
  if (width <= 0 || height <= 0 || pixels.length !== width * height * 4) throw new Error("Invalid barcode image dimensions");
  let luminance = new Uint8ClampedArray(width * height);
  for (let i = 0; i < luminance.length; i++) luminance[i] = (pixels[i * 4] + 2 * pixels[i * 4 + 1] + pixels[i * 4 + 2]) >> 2;
  const hints = new Map();
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new MultiFormatOneDReader(hints);
  for (let turn = 0; turn < 4; turn++) {
    try {
      const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, width, height)));
      const result = reader.decode(bitmap, hints);
      return { data: result.getText(), type: BarcodeFormat[result.getBarcodeFormat()].toLowerCase().replaceAll("_", "") };
    } catch (error) {
      const kind = error && typeof error === "object" && "getKind" in error && typeof error.getKind === "function" ? error.getKind() : "";
      if (!["NotFoundException", "ChecksumException", "FormatException"].includes(kind)) throw error;
    } finally { reader.reset(); }
    // Camera/image orientation can differ from preview orientation on emulators.
    const rotated = new Uint8ClampedArray(luminance.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rotated[x * height + height - y - 1] = luminance[y * width + x];
    luminance = rotated;
    [width, height] = [height, width];
  }
  return null;
}

/** Pure JavaScript: no Google Play Services or native barcode scanner required. */
export function decodeBarcodeJpeg(base64: string) {
  const image = decode(toByteArray(base64), { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 4, maxMemoryUsageInMB: 80 });
  return decodeBarcodePixels(image.data, image.width, image.height);
}
