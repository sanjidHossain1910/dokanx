export const localeFor = (language: string) => language.startsWith("bn") ? "bn-BD" : "en-BD";
export const formatNumber = (value: number, language: string) => new Intl.NumberFormat(localeFor(language)).format(value);
export function formatMoney(cents: number, language: string, compact = false) {
  return `৳${new Intl.NumberFormat(localeFor(language), { minimumFractionDigits: compact ? 0 : 2, maximumFractionDigits: compact ? 1 : 2, notation: compact ? "compact" : "standard" }).format(cents / 100)}`;
}
