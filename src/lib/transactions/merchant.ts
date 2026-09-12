export type MerchantColumns = {
  merchant: string;
  normalizedMerchant: string;
};

export function foldLocaleCharacters(value: string): string {
  return value
    .replaceAll("æ", "ae")
    .replaceAll("Æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("Ø", "o")
    .replaceAll("å", "a")
    .replaceAll("Å", "a");
}

export function normalizeMerchantKey(value: string): string {
  return foldLocaleCharacters(value)
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export function toMerchantColumns(display: string): MerchantColumns {
  return {
    merchant: display,
    normalizedMerchant: normalizeMerchantKey(display),
  };
}
