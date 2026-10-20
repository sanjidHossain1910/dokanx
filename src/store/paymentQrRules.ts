export type QrCrop = { originX: number; originY: number; width: number; height: number };
export type QrAdjustment = { rotation: number; crop?: QrCrop };
export function rotatedQrSize(width: number, height: number, rotation: number) {
  if (![width, height].every((n) => Number.isSafeInteger(n) && n > 0) || ![0, 90, 180, 270].includes(rotation)) throw new Error("qrFailed");
  return rotation % 180 ? { width: height, height: width } : { width, height };
}
export function qrSquareCrop(width: number, height: number, zoom = 1, x = 0.5, y = 0.5): QrCrop {
  rotatedQrSize(width, height, 0);
  if (![zoom, x, y].every(Number.isFinite) || zoom < 1 || zoom > 8) throw new Error("qrFailed");
  const side = Math.max(1, Math.floor(Math.min(width, height) / zoom));
  return { originX: Math.round((width - side) * Math.max(0, Math.min(1, x))), originY: Math.round((height - side) * Math.max(0, Math.min(1, y))), width: side, height: side };
}
export function validQrCrop(crop: QrCrop, width: number, height: number) {
  return !!crop && [crop.originX, crop.originY, crop.width, crop.height].every(Number.isSafeInteger) && crop.originX >= 0 && crop.originY >= 0 && crop.width > 0 && crop.height > 0 && crop.originX + crop.width <= width && crop.originY + crop.height <= height;
}
