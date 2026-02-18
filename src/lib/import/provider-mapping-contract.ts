export const PROVIDER_CANONICAL_FIELDS = [
  "bookingDate",
  "amount",
  "sender",
  "recipient",
  "name",
  "title",
  "currency",
  "paymentType",
] as const;

export const REQUIRED_PROVIDER_CANONICAL_FIELDS = [
  "bookingDate",
  "amount",
] as const;

export const MERCHANT_SIGNAL_CANONICAL_FIELDS = ["name", "title"] as const;

export function findMissingRequiredCanonicalFields(
  canonicalFields: ReadonlyArray<string>,
): string[] {
  const provided = new Set(canonicalFields);

  return REQUIRED_PROVIDER_CANONICAL_FIELDS.filter(
    (requiredField) => !provided.has(requiredField),
  );
}

export function hasMerchantSignalCanonicalField(
  canonicalFields: ReadonlyArray<string>,
): boolean {
  const provided = new Set(canonicalFields);

  return MERCHANT_SIGNAL_CANONICAL_FIELDS.some((field) => provided.has(field));
}
