export const REQUIRED_PROVIDER_CANONICAL_FIELDS = [
  "bookingDate",
  "amount",
  "sender",
  "recipient",
  "name",
  "title",
  "currency",
  "paymentType",
] as const;

export function findMissingRequiredCanonicalFields(
  canonicalFields: ReadonlyArray<string>,
): string[] {
  const provided = new Set(canonicalFields);

  return REQUIRED_PROVIDER_CANONICAL_FIELDS.filter(
    (requiredField) => !provided.has(requiredField),
  );
}
