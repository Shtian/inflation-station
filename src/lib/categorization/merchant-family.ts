import { normalizeMerchantKey } from "@/lib/transactions/merchant";

const MIN_FAMILY_KEY_LENGTH = 3;

// "apple com bill" (subscriptions billed by apple.com) and "apple store oslo"
// (a shop) are different merchants, so a domain suffix stays part of the brand.
const DOMAIN_SUFFIXES = new Set(["com", "no", "net", "org", "io", "se", "dk"]);

// Payment processors and card labels prefix the real merchant, so keying on
// them would give every Vipps or PayPal purchase one shared category.
export const INTERMEDIARY_PREFIXES: ReadonlySet<string> = new Set([
  "vipps",
  "paypal",
  "klarna",
  "sumup",
  "zettle",
  "izettle",
  "visa",
  "mastercard",
  "varekjop",
  "kortkjop",
  "bankaxept",
  "iz",
  "sq",
]);

export const LEGAL_SUFFIXES: ReadonlySet<string> = new Set([
  "as",
  "asa",
  "ab",
  "ltd",
  "sa",
]);

// Imported merchants are name + title, so they carry store numbers, dates and
// city names around the brand. The family key keeps the first word without
// digits after any intermediary prefix, which is the brand for the statement
// formats we import.
export function toMerchantFamilyKey(normalizedMerchant: string): string | null {
  const tokens = normalizeMerchantKey(normalizedMerchant).split(" ");
  const brandIndex = tokens.findIndex(
    (token) =>
      token.length > 0 &&
      !/\d/.test(token) &&
      !INTERMEDIARY_PREFIXES.has(token),
  );
  const brand = tokens[brandIndex];
  if (brand === undefined || brand.length < MIN_FAMILY_KEY_LENGTH) {
    return null;
  }

  const next = tokens[brandIndex + 1];
  return next !== undefined && DOMAIN_SUFFIXES.has(next)
    ? `${brand}.${next}`
    : brand;
}
