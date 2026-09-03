import type { ProviderMappingRecord } from "./mapping-definition";

/**
 * A retained seeded provider definition, shaped exactly like the persisted
 * record `compileProviderMapping` expects, minus the database-assigned `id`.
 */
export type SeedProviderMappingDefinition = Omit<ProviderMappingRecord, "id">;

/**
 * Provider mappings seeded by `prisma/seed.mjs`, exported here so the seed
 * script and this module's own compile/parse fixture test consume the exact
 * same definitions and can never drift apart.
 *
 * DNB Bank is deliberately excluded: its statement export reports debits and
 * credits in two separate columns ("Ut fra konto" / "Inn på konto") that must
 * be composed into one signed `amount`. Executable mapping version 1 has no
 * supported composition transform, and `ImportProviderFieldMapping`'s
 * `@@unique([providerMappingId, canonicalField])` forbids mapping two source
 * columns to the same canonical field. Restore it once a supported
 * debit/credit composition transform exists.
 */
export const SEEDED_PROVIDER_MAPPINGS: readonly SeedProviderMappingDefinition[] =
  [
    {
      providerName: "Nordea",
      mappingVersion: 1,
      normalizationRules: {
        dateFormat: "DD.MM.YYYY",
        decimalSeparator: ",",
        delimiter: ";",
      },
      fieldMappings: [
        {
          sourceField: "Bokføringsdato",
          canonicalField: "bookingDate",
          transformRules: null,
        },
        {
          sourceField: "Beløp",
          canonicalField: "amount",
          transformRules: null,
        },
        {
          sourceField: "Avsender",
          canonicalField: "sender",
          transformRules: null,
        },
        {
          sourceField: "Mottaker",
          canonicalField: "recipient",
          transformRules: null,
        },
        { sourceField: "Navn", canonicalField: "name", transformRules: null },
        {
          sourceField: "Tittel",
          canonicalField: "title",
          transformRules: null,
        },
      ],
    },
    {
      providerName: "SpareBank 1",
      mappingVersion: 1,
      normalizationRules: {
        dateFormat: "DD.MM.YYYY",
        decimalSeparator: ",",
        delimiter: ";",
      },
      fieldMappings: [
        {
          sourceField: "Dato",
          canonicalField: "bookingDate",
          transformRules: null,
        },
        {
          sourceField: "Beløp",
          canonicalField: "amount",
          transformRules: null,
        },
        {
          sourceField: "Avsender",
          canonicalField: "sender",
          transformRules: null,
        },
        {
          sourceField: "Mottaker",
          canonicalField: "recipient",
          transformRules: null,
        },
        {
          sourceField: "Beskrivelse",
          canonicalField: "title",
          transformRules: null,
        },
      ],
    },
  ];
