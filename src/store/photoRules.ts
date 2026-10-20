export const MAX_PRODUCT_PHOTO_BYTES = 1_000_000;
export function validPhotoBytes(bytes: number) {
  return Number.isSafeInteger(bytes) && bytes > 0 && bytes <= MAX_PRODUCT_PHOTO_BYTES;
}
export function squareCrop(width: number, height: number, zoom = 1, x = 0.5, y = 0.5) {
  if (![width, height, zoom, x, y].every(Number.isFinite) || width < 1 || height < 1 || zoom < 1) throw new Error("photoPickFailed");
  const side = Math.max(1, Math.floor(Math.min(width, height) / Math.min(zoom, 3)));
  return { originX: Math.round((width - side) * Math.max(0, Math.min(1, x))), originY: Math.round((height - side) * Math.max(0, Math.min(1, y))), width: side, height: side };
}
