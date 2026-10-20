import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { squareCrop, validPhotoBytes } from "./photoRules";

export type ProductPhotoDraft = { uri: string; width: number; height: number };
export type PreparedProductPhoto = ProductPhotoDraft & { bytes: number };

/** Preview and storage use the same square JPEG, never a second compression. */
export async function prepareProductPhoto(source: ProductPhotoDraft, zoom: number, x: number, y: number): Promise<PreparedProductPhoto> {
  const context = ImageManipulator.manipulate(source.uri);
  try {
    const crop = squareCrop(source.width, source.height, zoom, x, y);
    context.crop(crop).resize({ width: Math.min(crop.width, 960) });
    const image = await context.renderAsync();
    try {
      for (const quality of [0.85, 0.65, 0.45]) {
        const jpeg = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality });
        const bytes = new File(jpeg.uri).size;
        if (validPhotoBytes(bytes)) return { uri: jpeg.uri, width: jpeg.width, height: jpeg.height, bytes };
        removeDraftPhoto(jpeg.uri);
      }
      throw new Error("photoTooLarge");
    } finally { image.release(); }
  } finally { context.release(); }
}

export function removeDraftPhoto(uri?: string) {
  if (!uri || !uri.startsWith(Paths.cache.uri)) return;
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* Cache cleanup can retry at OS level. */ }
}

export async function saveProductPhoto(source: PreparedProductPhoto, productId: string) {
  if (!/^[A-Za-z0-9-]+$/.test(productId) || source.width !== source.height || !validPhotoBytes(source.bytes)) throw new Error("photoSaveFailed");
  const original = new File(source.uri);
  if (!original.exists) throw new Error("photoSaveFailed");
  if (!validPhotoBytes(original.size)) throw new Error("photoTooLarge");
  const directory = new Directory(Paths.document, "product-photos");
  directory.create({ intermediates: true, idempotent: true });
  const destination = new File(directory, `${productId}.jpg`);
  if (destination.exists) throw new Error("photoSaveFailed");
  try { await original.copy(destination); }
  catch (error) { if (destination.exists) destination.delete(); throw error; }
  return destination.uri;
}

export function removeUnsavedProductPhoto(uri: string) {
  const directory = new Directory(Paths.document, "product-photos");
  if (!uri.startsWith(`${directory.uri.replace(/\/$/, "")}/`)) return;
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* Failed saves can retry. */ }
}
