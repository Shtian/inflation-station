import type { CsvParserResult } from "./csv-parser";
import { createProviderAdapter } from "./provider-adapter/adapter";
import { compileProviderMapping } from "./provider-adapter/compile-mapping";
import { createCsvStatement } from "./provider-adapter/csv-statement";
import type { ProviderMappingRecord } from "./provider-adapter/mapping-definition";

export type ProviderFieldMapping = {
  sourceField: string;
  canonicalField: string;
  transformRules: unknown;
};

export type ProviderCsvMapping = {
  id: string;
  providerName: string;
  fieldMappings: ReadonlyArray<ProviderFieldMapping>;
  normalizationRules: unknown;
  mappingVersion?: number | null;
};

function configurationErrorResult(message: string): CsvParserResult {
  return {
    rows: [],
    errors: [
      {
        rowNumber: 1,
        code: "PROVIDER_MAPPING_CONFIGURATION_ERROR",
        message,
      },
    ],
    summary: {
      imported: 0,
      duplicates: 0,
      ignoredReserved: 0,
      invalid: 1,
    },
  };
}

export function parseProviderMappedCsv(
  csvContent: string,
  mapping: ProviderCsvMapping,
): CsvParserResult {
  const record: ProviderMappingRecord = {
    id: mapping.id,
    providerName: mapping.providerName,
    mappingVersion: mapping.mappingVersion ?? null,
    normalizationRules: mapping.normalizationRules,
    fieldMappings: mapping.fieldMappings,
  };

  const compiled = compileProviderMapping(record);
  if (!compiled.ok) {
    return configurationErrorResult(compiled.error.message);
  }

  const adapter = createProviderAdapter(compiled.definition);
  const statement = createCsvStatement(csvContent);

  return adapter.parse(statement);
}
