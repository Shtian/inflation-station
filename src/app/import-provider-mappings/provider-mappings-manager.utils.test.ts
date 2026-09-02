import { describe, expect, it } from "vitest";
import {
  buildNormalizationRulesPayload,
  parseMappingVersion,
  parseNormalizationFormState,
  validateFieldMappings,
} from "./provider-mappings-manager.utils";

describe("provider-mappings-manager normalization helpers", () => {
  it("parses known header arrays and drops unsupported normalization keys", () => {
    const parsed = parseNormalizationFormState({
      requiredHeaders: [" Bokfort ", 123, ""],
      anyHeaders: ["Melding"],
      headerPatterns: ["^amount$", true],
      stripQuotes: true,
      encoding: "UTF-8",
    });

    expect(parsed).toEqual({
      requiredHeaders: ["Bokfort"],
      anyHeaders: ["Melding"],
      headerPatterns: ["^amount$"],
      delimiter: undefined,
      decimalSeparator: undefined,
      dateFormat: undefined,
    });
  });

  it("parses the closed delimiter, decimal separator, and date format rules", () => {
    const parsed = parseNormalizationFormState({
      delimiter: ";",
      decimalSeparator: ",",
      dateFormat: "DD.MM.YYYY",
      unsupportedDelimiter: "|",
    });

    expect(parsed).toMatchObject({
      delimiter: ";",
      decimalSeparator: ",",
      dateFormat: "DD.MM.YYYY",
    });
  });

  it("builds payload with only non-empty header arrays and set rules", () => {
    const payload = buildNormalizationRulesPayload({
      requiredHeaders: ["A"],
      anyHeaders: [],
      headerPatterns: [],
      delimiter: ";",
      decimalSeparator: undefined,
      dateFormat: undefined,
    });

    expect(payload).toEqual({
      requiredHeaders: ["A"],
      delimiter: ";",
    });
  });
});

describe("provider-mappings-manager validation helpers", () => {
  it("returns null for valid field mappings", () => {
    const error = validateFieldMappings([
      { canonicalField: "bookingDate", sourceField: "Bokfort" },
      { canonicalField: "amount", sourceField: "Belop" },
      { canonicalField: "title", sourceField: "Melding" },
      { canonicalField: "sender", sourceField: "Fra" },
    ]);

    expect(error).toBeNull();
  });

  it("rejects duplicate canonical fields", () => {
    const error = validateFieldMappings([
      { canonicalField: "bookingDate", sourceField: "Bokfort" },
      { canonicalField: "amount", sourceField: "Belop" },
      { canonicalField: "title", sourceField: "Melding" },
      { canonicalField: "sender", sourceField: "Fra" },
      { canonicalField: "sender", sourceField: "Avsender" },
    ]);

    expect(error).toBe("Each canonical field can only be mapped once.");
  });

  it("requires at least one merchant signal mapping", () => {
    const error = validateFieldMappings([
      { canonicalField: "bookingDate", sourceField: "Bokfort" },
      { canonicalField: "amount", sourceField: "Belop" },
      { canonicalField: "sender", sourceField: "Fra" },
    ]);

    expect(error).toBe(
      "Required merchant signal mapping is missing (name or title).",
    );
  });
});

describe("parseMappingVersion", () => {
  it("accepts empty values and positive integers", () => {
    expect(parseMappingVersion("")).toEqual({ value: undefined });
    expect(parseMappingVersion(" 2 ")).toEqual({ value: 2 });
  });

  it("rejects non-positive or invalid values", () => {
    expect(parseMappingVersion("0")).toEqual({
      error: "Mapping version must be a positive integer.",
    });
    expect(parseMappingVersion("abc")).toEqual({
      error: "Mapping version must be a positive integer.",
    });
  });
});
