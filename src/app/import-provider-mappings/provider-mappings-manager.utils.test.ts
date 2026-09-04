import { describe, expect, it } from "vitest";
import {
  buildNormalizationRulesPayload,
  describeFieldTransform,
  INFER_DELIMITER_OPTION,
  parseFieldTransforms,
  parseMappingVersion,
  parseMapValuesLines,
  parseNormalizationFormState,
  validateFieldMappings,
} from "./provider-mappings-manager.utils";

describe("provider-mappings-manager normalization helpers", () => {
  it("parses known header arrays and lexical rules, dropping unknown keys", () => {
    const parsed = parseNormalizationFormState({
      delimiter: ";",
      decimalSeparator: ".",
      dateFormat: "YYYY-MM-DD",
      requiredHeaders: [" Bokfort ", 123, ""],
      anyHeaders: ["Melding"],
      headerPatterns: ["^amount$", true],
      stripQuotes: true,
      encoding: "utf-8",
    });

    expect(parsed).toEqual({
      delimiter: ";",
      decimalSeparator: ".",
      dateFormat: "YYYY-MM-DD",
      requiredHeaders: ["Bokfort"],
      anyHeaders: ["Melding"],
      headerPatterns: ["^amount$"],
    });
  });

  it("falls back to inferred delimiter and default lexical rules for unsupported or missing values", () => {
    const parsed = parseNormalizationFormState({
      delimiter: "|",
      decimalSeparator: "unsupported",
      dateFormat: "MM/DD/YYYY",
    });

    expect(parsed).toEqual({
      delimiter: INFER_DELIMITER_OPTION,
      decimalSeparator: ",",
      dateFormat: "DD.MM.YYYY",
      requiredHeaders: [],
      anyHeaders: [],
      headerPatterns: [],
    });
  });

  it("returns the empty default state for non-object values", () => {
    expect(parseNormalizationFormState(null)).toEqual({
      delimiter: INFER_DELIMITER_OPTION,
      decimalSeparator: ",",
      dateFormat: "DD.MM.YYYY",
      requiredHeaders: [],
      anyHeaders: [],
      headerPatterns: [],
    });
  });

  it("builds a payload with the closed rule set and omits inferred delimiter", () => {
    const payload = buildNormalizationRulesPayload({
      delimiter: INFER_DELIMITER_OPTION,
      decimalSeparator: ",",
      dateFormat: "DD.MM.YYYY",
      requiredHeaders: ["A"],
      anyHeaders: [],
      headerPatterns: [],
    });

    expect(payload).toEqual({
      decimalSeparator: ",",
      dateFormat: "DD.MM.YYYY",
      requiredHeaders: ["A"],
    });
  });

  it("includes an explicit delimiter when one is selected", () => {
    const payload = buildNormalizationRulesPayload({
      delimiter: ";",
      decimalSeparator: ".",
      dateFormat: "YYYY-MM-DD",
      requiredHeaders: [],
      anyHeaders: [],
      headerPatterns: [],
    });

    expect(payload).toEqual({
      delimiter: ";",
      decimalSeparator: ".",
      dateFormat: "YYYY-MM-DD",
    });
  });
});

describe("parseFieldTransforms", () => {
  it("passes through every supported transform shape", () => {
    const transforms = parseFieldTransforms([
      { type: "trim" },
      { type: "uppercase" },
      { type: "lowercase" },
      { type: "applySign", sign: "negative" },
      { type: "mapValues", values: { KORT: "card" }, fallback: "other" },
    ]);

    expect(transforms).toEqual([
      { type: "trim" },
      { type: "uppercase" },
      { type: "lowercase" },
      { type: "applySign", sign: "negative" },
      { type: "mapValues", values: { KORT: "card" }, fallback: "other" },
    ]);
  });

  it("drops unknown transform types instead of round-tripping them", () => {
    const transforms = parseFieldTransforms([
      { type: "trim" },
      { type: "regexReplace", pattern: "a", replacement: "b" },
    ]);

    expect(transforms).toEqual([{ type: "trim" }]);
  });

  it("drops malformed transform parameters", () => {
    const transforms = parseFieldTransforms([
      { type: "applySign", sign: "up" },
      { type: "mapValues", values: "not-a-record" },
      { type: "mapValues" },
    ]);

    expect(transforms).toEqual([]);
  });

  it("returns an empty list for non-array values", () => {
    expect(parseFieldTransforms(null)).toEqual([]);
    expect(parseFieldTransforms({ type: "trim" })).toEqual([]);
  });
});

describe("describeFieldTransform", () => {
  it("summarizes each transform type", () => {
    expect(describeFieldTransform({ type: "trim" })).toBe("Trim");
    expect(describeFieldTransform({ type: "uppercase" })).toBe("Uppercase");
    expect(describeFieldTransform({ type: "lowercase" })).toBe("Lowercase");
    expect(
      describeFieldTransform({ type: "applySign", sign: "positive" }),
    ).toBe("Apply sign: positive");
    expect(
      describeFieldTransform({
        type: "mapValues",
        values: { KORT: "card", OVERFORING: "transfer" },
      }),
    ).toBe("Map 2 values");
    expect(
      describeFieldTransform({
        type: "mapValues",
        values: { KORT: "card" },
        fallback: "other",
      }),
    ).toBe('Map 1 value, fallback "other"');
  });
});

describe("parseMapValuesLines", () => {
  it("parses from=to lines into a record", () => {
    expect(parseMapValuesLines("KORT=card\nOVERFORING=transfer")).toEqual({
      values: { KORT: "card", OVERFORING: "transfer" },
    });
  });

  it("trims whitespace around keys and values", () => {
    expect(parseMapValuesLines("  KORT = card  ")).toEqual({
      values: { KORT: "card" },
    });
  });

  it("rejects empty input", () => {
    expect(parseMapValuesLines("")).toEqual({
      error: 'Add at least one "from=to" value mapping.',
    });
  });

  it("rejects lines missing a from or to segment", () => {
    expect(parseMapValuesLines("KORT")).toEqual({
      error: 'Each line must be "from=to". Invalid line: "KORT".',
    });
    expect(parseMapValuesLines("=card")).toEqual({
      error: 'Each line must be "from=to". Invalid line: "=card".',
    });
    expect(parseMapValuesLines("KORT=")).toEqual({
      error: 'Each line must be "from=to". Invalid line: "KORT=".',
    });
  });
});

describe("provider-mappings-manager validation helpers", () => {
  it("returns null for valid field mappings", () => {
    const error = validateFieldMappings([
      { canonicalField: "bookingDate", sourceField: "Bokfort", transforms: [] },
      { canonicalField: "amount", sourceField: "Belop", transforms: [] },
      {
        canonicalField: "title",
        sourceField: "Melding",
        transforms: [{ type: "trim" }],
      },
      { canonicalField: "sender", sourceField: "Fra", transforms: [] },
    ]);

    expect(error).toBeNull();
  });

  it("rejects duplicate canonical fields", () => {
    const error = validateFieldMappings([
      { canonicalField: "bookingDate", sourceField: "Bokfort", transforms: [] },
      { canonicalField: "amount", sourceField: "Belop", transforms: [] },
      { canonicalField: "title", sourceField: "Melding", transforms: [] },
      { canonicalField: "sender", sourceField: "Fra", transforms: [] },
      { canonicalField: "sender", sourceField: "Avsender", transforms: [] },
    ]);

    expect(error).toBe("Each canonical field can only be mapped once.");
  });

  it("requires at least one merchant signal mapping", () => {
    const error = validateFieldMappings([
      { canonicalField: "bookingDate", sourceField: "Bokfort", transforms: [] },
      { canonicalField: "amount", sourceField: "Belop", transforms: [] },
      { canonicalField: "sender", sourceField: "Fra", transforms: [] },
    ]);

    expect(error).toBe(
      "Required merchant signal mapping is missing (name or title).",
    );
  });

  it("rejects a mapValues transform with no value mappings", () => {
    const error = validateFieldMappings([
      { canonicalField: "bookingDate", sourceField: "Bokfort", transforms: [] },
      { canonicalField: "amount", sourceField: "Belop", transforms: [] },
      {
        canonicalField: "title",
        sourceField: "Melding",
        transforms: [{ type: "mapValues", values: {} }],
      },
    ]);

    expect(error).toBe(
      'Map values transform for "title" needs at least one value mapping.',
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
