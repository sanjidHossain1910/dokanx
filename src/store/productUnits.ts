export const UNIT_GROUPS = [
  { id: "count", en: "Count", bn: "সংখ্যা", fractional: false },
  { id: "weight", en: "Weight", bn: "ওজন", fractional: true },
  { id: "volume", en: "Liquid / volume", bn: "তরল / আয়তন", fractional: true },
  { id: "length", en: "Length", bn: "দৈর্ঘ্য", fractional: true },
  { id: "area", en: "Area", bn: "ক্ষেত্রফল", fractional: true },
  { id: "package", en: "Package / container", bn: "প্যাকেজ / পাত্র", fractional: false },
  { id: "time", en: "Time", bn: "সময়", fractional: true },
] as const;
export type UnitGroupId = typeof UNIT_GROUPS[number]["id"];

export const PRODUCT_UNITS = [
  { id: "piece", group: "count", en: "pc", bn: "পিস" },
  { id: "pair", group: "count", en: "pair", bn: "জোড়া" },
  { id: "hali", group: "count", en: "hali", bn: "হালি" },
  { id: "dozen", group: "count", en: "doz", bn: "ডজন" },
  { id: "set", group: "count", en: "set", bn: "সেট" },
  { id: "mg", group: "weight", en: "mg", bn: "মিলিগ্রাম" },
  { id: "g", group: "weight", en: "g", bn: "গ্রাম" },
  { id: "kg", group: "weight", en: "kg", bn: "কেজি" },
  { id: "mon", group: "weight", en: "mon", bn: "মণ" },
  { id: "quintal", group: "weight", en: "q", bn: "কুইন্টাল" },
  { id: "tonne", group: "weight", en: "t", bn: "টন" },
  { id: "ml", group: "volume", en: "mL", bn: "মিলিলিটার" },
  { id: "litre", group: "volume", en: "L", bn: "লিটার" },
  { id: "cubic-foot", group: "volume", en: "ft³", bn: "ঘনফুট" },
  { id: "cubic-metre", group: "volume", en: "m³", bn: "ঘনমিটার" },
  { id: "inch", group: "length", en: "in", bn: "ইঞ্চি" },
  { id: "foot", group: "length", en: "ft", bn: "ফুট" },
  { id: "yard", group: "length", en: "yd", bn: "গজ" },
  { id: "cm", group: "length", en: "cm", bn: "সেন্টিমিটার" },
  { id: "metre", group: "length", en: "m", bn: "মিটার" },
  { id: "square-foot", group: "area", en: "ft²", bn: "বর্গফুট" },
  { id: "square-yard", group: "area", en: "yd²", bn: "বর্গগজ" },
  { id: "square-metre", group: "area", en: "m²", bn: "বর্গমিটার" },
  { id: "packet", group: "package", en: "pkt", bn: "প্যাকেট" },
  { id: "box", group: "package", en: "box", bn: "বক্স" },
  { id: "carton", group: "package", en: "ctn", bn: "কার্টন" },
  { id: "sack", group: "package", en: "sack", bn: "বস্তা" },
  { id: "bag", group: "package", en: "bag", bn: "ব্যাগ" },
  { id: "bundle", group: "package", en: "bdl", bn: "বান্ডিল" },
  { id: "roll", group: "package", en: "roll", bn: "রোল" },
  { id: "bottle", group: "package", en: "btl", bn: "বোতল" },
  { id: "can", group: "package", en: "can", bn: "ক্যান" },
  { id: "jar", group: "package", en: "jar", bn: "জার" },
  { id: "drum", group: "package", en: "drum", bn: "ড্রাম" },
  { id: "minute", group: "time", en: "min", bn: "মিনিট" },
  { id: "hour", group: "time", en: "hr", bn: "ঘণ্টা" },
  { id: "day", group: "time", en: "day", bn: "দিন" },
  { id: "month", group: "time", en: "mo", bn: "মাস" },
] as const;
export type UnitId = typeof PRODUCT_UNITS[number]["id"];
export const getUnit = (id: unknown) => PRODUCT_UNITS.find((unit) => unit.id === id);
export const unitLabel = (id: UnitId | undefined, language: string) => (getUnit(id ?? "piece") ?? PRODUCT_UNITS[0])[language.startsWith("bn") ? "bn" : "en"];
export const allowsFraction = (id: UnitId | undefined) => UNIT_GROUPS.find((group) => group.id === getUnit(id ?? "piece")?.group)?.fractional ?? false;
export function validUnitSelection(unit: unknown, group?: unknown) {
  const definition = getUnit(unit ?? "piece");
  return !!definition && (group === undefined || group === definition.group);
}
export function quantityTicks(value: number): number | null {
  const scaled = value * 1000;
  const ticks = Math.round(scaled);
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && Number.isSafeInteger(ticks) && Math.abs(scaled - ticks) < 0.0000001 ? ticks : null;
}
export function validQuantity(value: number, unit?: UnitId, allowZero = true) {
  const ticks = quantityTicks(value);
  return !!getUnit(unit ?? "piece") && ticks !== null && (allowZero || ticks > 0) && (allowsFraction(unit) || Number.isSafeInteger(value));
}
export const normalizeNumericInput = (value: string) => value.trim().replace(/[০-৯٠-٩۰-۹]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit) >= 0 ? "০১২৩৪৫৬৭৮৯".indexOf(digit) : "٠١٢٣٤٥٦٧٨٩".indexOf(digit) >= 0 ? "٠١٢٣٤٥٦٧٨٩".indexOf(digit) : "۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/٫/g, ".");
export function parseQuantityInput(text: string, unit?: UnitId, allowZero = true) {
  const normalized = normalizeNumericInput(text);
  if (!(allowsFraction(unit) ? /^\d+(\.\d{1,3})?$/ : /^\d+$/).test(normalized)) return null;
  const value = Number(normalized);
  return validQuantity(value, unit, allowZero) ? value : null;
}
export function parseMoneyInput(text: string) {
  const normalized = normalizeNumericInput(text);
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}
/** Round a complete line once to the nearest minor currency unit. */
export function lineAmount(price: number, quantity: number) {
  const ticks = quantityTicks(quantity);
  if (!Number.isSafeInteger(price) || price < 0 || ticks === null) return null;
  const cents = (BigInt(price) * BigInt(ticks) + 500n) / 1000n;
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}
