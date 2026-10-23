import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { squareCrop, validPhotoBytes } from "./photoRules";

export type ProductPhotoDraft = { uri: string; width: number; height: number };
export type PreparedProductPhoto = ProductPhotoDraft & { bytes: number; format?: "png" };

/** Preview and storage use the same square PNG, preserving transparent pixels. */
export async function prepareProductPhoto(source: ProductPhotoDraft, zoom: number, x: number, y: number): Promise<PreparedProductPhoto> {
  const context = ImageManipulator.manipulate(source.uri);
  try {
    const crop = squareCrop(source.width, source.height, zoom, x, y);
    // PNG quality does not reduce its dimensions. Retry smaller square renders
    // from the original crop instead of flattening alpha into JPEG black pixels.
    const sizes = [...new Set([960, 768, 640, 512, 448].map(size => Math.min(crop.width, size)))];
    for (const size of sizes) {
      context.reset(); context.crop(crop).resize({ width: size });
      const image = await context.renderAsync();
      try {
        const png = await image.saveAsync({ format: SaveFormat.PNG, compress: 1 });
        const bytes = new File(png.uri).size;
        if (validPhotoBytes(bytes)) return { uri: png.uri, width: png.width, height: png.height, bytes, format: "png" };
        removeDraftPhoto(png.uri);
      } finally { image.release(); }
    }
    throw new Error("photoTooLarge");
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
  const destination = new File(directory, `${productId}.${source.format === "png" ? "png" : "jpg"}`);
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
