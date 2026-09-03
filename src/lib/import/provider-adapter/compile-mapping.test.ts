import { describe, expect, it } from "vitest";
import { compileProviderMapping } from "./compile-mapping";
import type { ProviderMappingRecord } from "./mapping-definition";

function buildRecord(
  overrides: Partial<ProviderMappingRecord> = {},
): ProviderMappingRecord {
  return {
    id: "provider-1",
    providerName: "Test Bank",
    mappingVersion: 1,
    normalizationRules: {},
    fieldMappings: [
      {
        sourceField: "Bokføringsdato",
        canonicalField: "bookingDate",
        transformRules: null,
      },
      { sourceField: "Beløp", canonicalField: "amount", transformRules: null },
      {
        sourceField: "Beskrivelse",
        canonicalField: "name",
        transformRules: null,
      },
    ],
    ...overrides,
  };
}

describe("compileProviderMapping", () => {
  it("compiles a valid minimal mapping with supported rules and fields", () => {
    const result = compileProviderMapping(
      buildRecord({
        normalizationRules: {
          delimiter: ";",
          decimalSeparator: ".",
          dateFormat: "YYYY-MM-DD",
          requiredHeaders: ["Bokføringsdato", "Beløp"],
          anyHeaders: ["Valuta"],
          headerPatterns: ["^bel[oø]p$"],
        },
        fieldMappings: [
          {
            sourceField: "Bokføringsdato",
            canonicalField: "bookingDate",
            transformRules: [{ type: "trim" }],
          },
          {
            sourceField: "Beløp",
            canonicalField: "amount",
            transformRules: null,
          },
          {
            sourceField: "Beskrivelse",
            canonicalField: "name",
            transformRules: null,
          },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.definition).toEqual({
      providerId: "provider-1",
      providerName: "Test Bank",
      mappingVersion: 1,
      delimiter: ";",
      decimalSeparator: ".",
      dateFormat: "YYYY-MM-DD",
      detection: {
        requiredHeaders: ["Bokføringsdato", "Beløp"],
        anyHeaders: ["Valuta"],
        headerPatterns: ["^bel[oø]p$"],
      },
      fields: [
        {
          canonicalField: "bookingDate",
          sourceField: "Bokføringsdato",
          normalizedSourceHeader: "bokforingsdato",
          transforms: [{ type: "trim" }],
        },
        {
          canonicalField: "amount",
          sourceField: "Beløp",
          normalizedSourceHeader: "belop",
          transforms: [],
        },
        {
          canonicalField: "name",
          sourceField: "Beskrivelse",
          normalizedSourceHeader: "beskrivelse",
          transforms: [],
        },
      ],
    });
  });

  it("treats a null mappingVersion as version 1", () => {
    const result = compileProviderMapping(
      buildRecord({ mappingVersion: null }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.definition.mappingVersion).toBe(1);
    }
  });

  it("rejects an unsupported mapping version", () => {
    const result = compileProviderMapping(buildRecord({ mappingVersion: 2 }));

    expect(result).toEqual({
      ok: false,
      error: {
        code: "UNSUPPORTED_MAPPING_VERSION",
        message: expect.any(String),
        providerName: "Test Bank",
        details: { mappingVersion: 2 },
      },
    });
  });

  it("defaults delimiter to null (infer), decimalSeparator to comma, dateFormat to DD.MM.YYYY, and detection arrays to empty", () => {
    const result = compileProviderMapping(
      buildRecord({ normalizationRules: {} }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.definition.delimiter).toBeNull();
      expect(result.definition.decimalSeparator).toBe(",");
      expect(result.definition.dateFormat).toBe("DD.MM.YYYY");
      expect(result.definition.detection).toEqual({
        requiredHeaders: [],
        anyHeaders: [],
        headerPatterns: [],
      });
    }
  });

  it("rejects normalization rules that are not a JSON object", () => {
    const result = compileProviderMapping(
      buildRecord({ normalizationRules: "not-an-object" }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_NORMALIZATION_RULES");
    }
  });

  it("rejects the currently-seeded encoding key as an unknown normalization rule", () => {
    const result = compileProviderMapping(
      buildRecord({ normalizationRules: { encoding: "utf-8" } }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN_NORMALIZATION_RULE");
      expect(result.error.details).toEqual({ unknownKeys: ["encoding"] });
    }
  });

  it("rejects any other unknown normalization rule key", () => {
    const result = compileProviderMapping(
      buildRecord({ normalizationRules: { unexpectedKey: true } }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN_NORMALIZATION_RULE");
    }
  });

  it("rejects an unsupported delimiter", () => {
    const result = compileProviderMapping(
      buildRecord({ normalizationRules: { delimiter: "|" } }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_DELIMITER");
      expect(result.error.details).toEqual({ delimiter: "|" });
    }
  });

  it("rejects an unsupported decimal separator", () => {
    const result = compileProviderMapping(
      buildRecord({ normalizationRules: { decimalSeparator: "x" } }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_DECIMAL_SEPARATOR");
    }
  });

  it("rejects an unsupported date format", () => {
    const result = compileProviderMapping(
      buildRecord({ normalizationRules: { dateFormat: "MM/DD/YYYY" } }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_DATE_FORMAT");
    }
  });

  it("rejects an invalid header regular expression", () => {
    const result = compileProviderMapping(
      buildRecord({ normalizationRules: { headerPatterns: ["("] } }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_HEADER_PATTERN");
      expect(result.error.details).toEqual({ pattern: "(" });
    }
  });

  it("falls back mapped source headers into detection when requiredHeaders is omitted", () => {
    const result = compileProviderMapping(
      buildRecord({ normalizationRules: { anyHeaders: ["Valuta"] } }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.definition.detection.requiredHeaders).toEqual([]);
      expect(
        result.definition.fields.map((field) => field.sourceField),
      ).toEqual(["Bokføringsdato", "Beløp", "Beskrivelse"]);
    }
  });

  it("rejects the non-canonical normalizedMerchant field used by the current seed", () => {
    const result = compileProviderMapping(
      buildRecord({
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
            sourceField: "Beskrivelse",
            canonicalField: "normalizedMerchant",
            transformRules: null,
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN_CANONICAL_FIELD");
      expect(result.error.details).toEqual({
        canonicalField: "normalizedMerchant",
      });
    }
  });

  it("rejects a duplicate canonical field mapping", () => {
    const result = compileProviderMapping(
      buildRecord({
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
            sourceField: "Beskrivelse",
            canonicalField: "name",
            transformRules: null,
          },
          {
            sourceField: "Tittel",
            canonicalField: "name",
            transformRules: null,
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DUPLICATE_CANONICAL_FIELD");
      expect(result.error.details).toEqual({ canonicalField: "name" });
    }
  });

  it("requires bookingDate and amount canonical fields", () => {
    const result = compileProviderMapping(
      buildRecord({
        fieldMappings: [
          {
            sourceField: "Beskrivelse",
            canonicalField: "name",
            transformRules: null,
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("REQUIRED_CANONICAL_FIELDS_MISSING");
      expect(result.error.details).toEqual({
        missingCanonicalFields: ["bookingDate", "amount"],
      });
    }
  });

  it("requires at least one of name or title as a merchant signal", () => {
    const result = compileProviderMapping(
      buildRecord({
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
        ],
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MERCHANT_SIGNAL_FIELD_REQUIRED");
    }
  });

  it("accepts title as a merchant signal without name", () => {
    const result = compileProviderMapping(
      buildRecord({
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
            sourceField: "Tittel",
            canonicalField: "title",
            transformRules: null,
          },
        ],
      }),
    );

    expect(result.ok).toBe(true);
  });

  it("rejects an empty or whitespace-only sourceField", () => {
    const result = compileProviderMapping(
      buildRecord({
        fieldMappings: [
          {
            sourceField: "   ",
            canonicalField: "bookingDate",
            transformRules: null,
          },
          {
            sourceField: "Beløp",
            canonicalField: "amount",
            transformRules: null,
          },
          {
            sourceField: "Beskrivelse",
            canonicalField: "name",
            transformRules: null,
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SOURCE_FIELD_REQUIRED");
      expect(result.error.details).toEqual({ canonicalField: "bookingDate" });
    }
  });

  it("accepts absent, null, and undefined transformRules as no transforms", () => {
    for (const transformRules of [undefined, null]) {
      const result = compileProviderMapping(
        buildRecord({
          fieldMappings: [
            {
              sourceField: "Bokføringsdato",
              canonicalField: "bookingDate",
              transformRules,
            },
            {
              sourceField: "Beløp",
              canonicalField: "amount",
              transformRules: null,
            },
            {
              sourceField: "Beskrivelse",
              canonicalField: "name",
              transformRules: null,
            },
          ],
        }),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.definition.fields[0].transforms).toEqual([]);
      }
    }
  });

  it("rejects transformRules that are not an array", () => {
    const result = compileProviderMapping(
      buildRecord({
        fieldMappings: [
          {
            sourceField: "Bokføringsdato",
            canonicalField: "bookingDate",
            transformRules: "trim",
          },
          {
            sourceField: "Beløp",
            canonicalField: "amount",
            transformRules: null,
          },
          {
            sourceField: "Beskrivelse",
            canonicalField: "name",
            transformRules: null,
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_FIELD_TRANSFORM");
    }
  });

  it("rejects a malformed transform entry", () => {
    const result = compileProviderMapping(
      buildRecord({
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
            sourceField: "Beskrivelse",
            canonicalField: "name",
            transformRules: ["not-an-object"],
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_FIELD_TRANSFORM");
    }
  });

  it("rejects a transform entry with an unrecognized type", () => {
    const result = compileProviderMapping(
      buildRecord({
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
            sourceField: "Beskrivelse",
            canonicalField: "name",
            transformRules: [{ type: "reverse" }],
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_FIELD_TRANSFORM");
      expect(result.error.details).toMatchObject({ transformType: "reverse" });
    }
  });

  it("rejects a well-formed object with a recognized type but the wrong shape", () => {
    const result = compileProviderMapping(
      buildRecord({
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
            sourceField: "Beskrivelse",
            canonicalField: "name",
            transformRules: [{ type: "mapValues" }],
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_FIELD_TRANSFORM");
    }
  });

  it("compiles every supported transform type in stored order", () => {
    const result = compileProviderMapping(
      buildRecord({
        fieldMappings: [
          {
            sourceField: "Bokføringsdato",
            canonicalField: "bookingDate",
            transformRules: null,
          },
          {
            sourceField: "Beløp",
            canonicalField: "amount",
            transformRules: [{ type: "applySign", sign: "negative" }],
          },
          {
            sourceField: "Beskrivelse",
            canonicalField: "name",
            transformRules: [
              { type: "trim" },
              { type: "uppercase" },
              { type: "lowercase" },
              {
                type: "mapValues",
                values: { kort: "Card" },
                fallback: "Unknown",
              },
            ],
          },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const amountField = result.definition.fields.find(
        (field) => field.canonicalField === "amount",
      );
      const nameField = result.definition.fields.find(
        (field) => field.canonicalField === "name",
      );

      expect(amountField?.transforms).toEqual([
        { type: "applySign", sign: "negative" },
      ]);
      expect(nameField?.transforms).toEqual([
        { type: "trim" },
        { type: "uppercase" },
        { type: "lowercase" },
        { type: "mapValues", values: { kort: "Card" }, fallback: "Unknown" },
      ]);
    }
  });
});
