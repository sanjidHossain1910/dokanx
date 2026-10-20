import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { removeDraftPhoto } from "./productPhotos";
import { rotatedQrSize, validQrCrop, type QrAdjustment } from "./paymentQrRules";

/** Save the explicitly approved QR crop/rotation as PNG; preserve the full image by default. */
export async function savePaymentQr(source: { uri: string; width: number; height: number }, id: string, adjustment: QrAdjustment = { rotation: 0 }) {
  if (!/^[a-zA-Z0-9-]+$/.test(id) || source.width <= 0 || source.height <= 0) throw new Error("qrFailed");
  const rotated = rotatedQrSize(source.width, source.height, adjustment.rotation);
  if (adjustment.crop && !validQrCrop(adjustment.crop, rotated.width, rotated.height)) throw new Error("qrFailed");
  const context = ImageManipulator.manipulate(source.uri);
  try {
    if (adjustment.rotation) context.rotate(adjustment.rotation);
    if (adjustment.crop) context.crop(adjustment.crop);
    const output = adjustment.crop ?? rotated;
    if (Math.max(output.width, output.height) > 1600) context.resize(output.width >= output.height ? { width: 1600 } : { height: 1600 });
    const image = await context.renderAsync();
    try {
      const png = await image.saveAsync({ format: SaveFormat.PNG });
      try {
        const original = new File(png.uri);
        if (!original.exists) throw new Error("qrFailed");
        if (original.size > 3_000_000) throw new Error("qrFailed");
        const directory = new Directory(Paths.document, "payment-qr");
        directory.create({ intermediates: true, idempotent: true });
        const destination = new File(directory, `${id}.png`);
        try { await original.copy(destination); }
        catch (cause) { if (destination.exists) destination.delete(); throw cause; }
        return destination.uri;
      } finally { removeDraftPhoto(png.uri); }
    } finally { image.release(); }
  } finally { context.release(); }
}
export function removePaymentQr(uri?: string) {
  if (!uri) return;
  const folder = new Directory(Paths.document, "payment-qr").uri.replace(/\/$/, "") + "/";
  if (!uri.startsWith(folder)) return;
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* Retain the saved configuration if cleanup fails. */ }
}
