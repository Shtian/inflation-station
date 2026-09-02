/**
 * Single shared header-normalization implementation used by both provider
 * detection and provider parsing so header matching cannot drift across
 * modules. Folds Nordic characters and strips everything but lowercase
 * alphanumerics.
 */
export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll("ø", "o")
    .replaceAll("æ", "ae")
    .replaceAll("å", "a")
    .replaceAll(/[^a-z0-9]/g, "");
}
