import { describe, expect, it } from "vitest";
import {
  compileProviderMappingDefinition,
  ProviderMappingCompilationError,
  type ProviderMappingRecord,
} from "./mapping-definition";

function baseRecord(
  overrides: Partial<ProviderMappingRecord> = {},
): ProviderMappingRecord {
  return {
    id: "provider-1",
    providerName: "Bank A",
    mappingVersion: 1,
    normalizationRules: {},
    fieldMappings: [
      { sourceField: "Dato", canonicalField: "bookingDate" },
      { sourceField: "Beløp", canonicalField: "amount" },
      { sourceField: "Tittel", canonicalField: "title" },
    ],
    ...overrides,
  };
}

describe("compileProviderMappingDefinition", () => {
  it("compiles a valid mapping", () => {
    const definition = compileProviderMappingDefinition(baseRecord());

    expect(definition.fieldMappings).toHaveLength(3);
    expect(definition.normalizationRules).toEqual({});
  });

  it("rejects an unsupported mapping version", () => {
    expect(() =>
      compileProviderMappingDefinition(baseRecord({ mappingVersion: 2 })),
    ).toThrow(ProviderMappingCompilationError);

    try {
      compileProviderMappingDefinition(baseRecord({ mappingVersion: 2 }));
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderMappingCompilationError);
      expect((error as ProviderMappingCompilationError).code).toBe(
        "UNSUPPORTED_MAPPING_VERSION",
      );
    }
  });

  it("rejects unknown normalization rule keys", () => {
    let caught: unknown;
    try {
      compileProviderMappingDefinition(
        baseRecord({ normalizationRules: { encoding: "UTF-8" } }),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ProviderMappingCompilationError);
    expect((caught as ProviderMappingCompilationError).code).toBe(
      "INVALID_NORMALIZATION_RULES",
    );
  });

  it("rejects an invalid header regular expression", () => {
    let caught: unknown;
    try {
      compileProviderMappingDefinition(
        baseRecord({ normalizationRules: { headerPatterns: ["("] } }),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ProviderMappingCompilationError);
    expect((caught as ProviderMappingCompilationError).code).toBe(
      "INVALID_NORMALIZATION_RULES",
    );
  });

  it("rejects an unknown canonical field", () => {
    let caught: unknown;
    try {
      compileProviderMappingDefinition(
        baseRecord({
          fieldMappings: [
            { sourceField: "Dato", canonicalField: "bookingDate" },
            { sourceField: "Beløp", canonicalField: "amountNok" },
            { sourceField: "Tittel", canonicalField: "title" },
          ],
        }),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ProviderMappingCompilationError);
    expect((caught as ProviderMappingCompilationError).code).toBe(
      "INVALID_FIELD_MAPPING",
    );
  });

  it("rejects an unsupported field transform", () => {
    let caught: unknown;
    try {
      compileProviderMappingDefinition(
        baseRecord({
          fieldMappings: [
            { sourceField: "Dato", canonicalField: "bookingDate" },
            { sourceField: "Beløp", canonicalField: "amount" },
            {
              sourceField: "Tittel",
              canonicalField: "title",
              transformRules: [{ type: "regexReplace", pattern: "x" }],
            },
          ],
        }),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ProviderMappingCompilationError);
    expect((caught as ProviderMappingCompilationError).code).toBe(
      "INVALID_FIELD_MAPPING",
    );
  });

  it("rejects duplicate canonical field mappings", () => {
    let caught: unknown;
    try {
      compileProviderMappingDefinition(
        baseRecord({
          fieldMappings: [
            { sourceField: "Dato", canonicalField: "bookingDate" },
            { sourceField: "Beløp", canonicalField: "amount" },
            { sourceField: "Tittel", canonicalField: "title" },
            { sourceField: "Annen tittel", canonicalField: "title" },
          ],
        }),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ProviderMappingCompilationError);
    expect((caught as ProviderMappingCompilationError).code).toBe(
      "DUPLICATE_CANONICAL_FIELD",
    );
  });

  it("rejects a mapping missing required canonical fields", () => {
    let caught: unknown;
    try {
      compileProviderMappingDefinition(
        baseRecord({
          fieldMappings: [{ sourceField: "Tittel", canonicalField: "title" }],
        }),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ProviderMappingCompilationError);
    expect((caught as ProviderMappingCompilationError).code).toBe(
      "MISSING_REQUIRED_CANONICAL_FIELDS",
    );
  });

  it("rejects a mapping missing a merchant signal field", () => {
    let caught: unknown;
    try {
      compileProviderMappingDefinition(
        baseRecord({
          fieldMappings: [
            { sourceField: "Dato", canonicalField: "bookingDate" },
            { sourceField: "Beløp", canonicalField: "amount" },
          ],
        }),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ProviderMappingCompilationError);
    expect((caught as ProviderMappingCompilationError).code).toBe(
      "MISSING_MERCHANT_SIGNAL_FIELD",
    );
  });
});
