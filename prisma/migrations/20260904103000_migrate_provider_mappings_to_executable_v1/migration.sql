-- Data migration: bring persisted provider mappings onto executable mapping version 1.
--
-- Runtime compilation now rejects the `encoding` normalization rule and the
-- `amountNok` / `normalizedMerchant` canonical-field aliases. Without this
-- migration, mappings persisted before the executable contract would stop
-- loading entirely after deploy, disappearing from provider detection.

-- Promote the `amountNok` alias to `amount` when the mapping has no `amount` yet.
UPDATE "ImportProviderFieldMapping"
SET "canonicalField" = 'amount'
WHERE "canonicalField" = 'amountNok'
  AND NOT EXISTS (
    SELECT 1
    FROM "ImportProviderFieldMapping" AS existing
    WHERE existing."providerMappingId" = "ImportProviderFieldMapping"."providerMappingId"
      AND existing."canonicalField" = 'amount'
  );

-- Promote `normalizedMerchant` to `title` when the mapping carries no other merchant
-- signal, so migrated mappings keep satisfying the required name/title rule.
UPDATE "ImportProviderFieldMapping"
SET "canonicalField" = 'title'
WHERE "canonicalField" = 'normalizedMerchant'
  AND NOT EXISTS (
    SELECT 1
    FROM "ImportProviderFieldMapping" AS existing
    WHERE existing."providerMappingId" = "ImportProviderFieldMapping"."providerMappingId"
      AND existing."canonicalField" IN ('name', 'title')
  );

-- Drop the remaining alias rows, which now duplicate an existing canonical mapping.
DELETE FROM "ImportProviderFieldMapping"
WHERE "canonicalField" IN ('amountNok', 'normalizedMerchant');

-- Drop the unsupported `encoding` rule. Encoding conversion is not runtime behavior:
-- uploaded file content has already been decoded into a JavaScript string.
UPDATE "ImportProviderMapping"
SET "normalizationRules" = json_remove("normalizationRules", '$.encoding')
WHERE json_valid("normalizationRules")
  AND json_type("normalizationRules", '$.encoding') IS NOT NULL;

-- Deliberately NOT handled here: a persisted DNB-style mapping whose debits and
-- credits live in two columns. Only one of them can be mapped to `amount` (see the
-- @@unique on ImportProviderFieldMapping), so such a mapping has always been
-- silently debit-only. After the cleanup above it compiles and keeps behaving
-- exactly as it did before this deploy. Deleting it would destroy administrator
-- configuration, so it is left in place until a supported debit/credit
-- composition transform exists. See prisma/seed.mjs and issues #59 / #40.
