import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat, type ImageRef } from "expo-image-manipulator";
import { decodeBarcodeJpeg } from "./decodeBarcode";

export function removeCapturedImage(uri?: string) {
  if (!uri?.startsWith("file://")) return;
  try { new File(uri).delete(); } catch { /* A temporary file may already be gone. */ }
}

export async function decodeLocalImage(source: { uri: string; width: number; height: number }) {
  const context = ImageManipulator.manipulate(source.uri);
  let image: ImageRef | undefined;
  let temporaryUri: string | undefined;
  try {
    const scale = Math.min(1, 1280 / Math.max(source.width, source.height));
    context.resize({ width: Math.max(1, Math.round(source.width * scale)) });
    image = await context.renderAsync();
    const jpeg = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.95, base64: true });
    temporaryUri = jpeg.uri;
    if (!jpeg.base64) throw new Error("Barcode image data is missing");
    // Give the loading state a chance to render before decoding on the JS thread.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return decodeBarcodeJpeg(jpeg.base64);
  } finally {
    context.release();
    image?.release();
    // Only our generated image is removed, never the user's selected original.
    if (temporaryUri !== source.uri) removeCapturedImage(temporaryUri);
  }
}
