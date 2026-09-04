import { createProviderAdapter } from "./provider-adapter/adapter";
import { compileProviderMapping } from "./provider-adapter/compile-mapping";
import { createCsvStatement } from "./provider-adapter/csv-statement";
import {
  detectProviderFromAdapters,
  type ProviderDetectionCandidate,
  type ProviderDetectionResult,
  type ProviderDetectionState,
} from "./provider-adapter/detection";
import type { ProviderMappingRecord } from "./provider-adapter/mapping-definition";

export type {
  ProviderDetectionCandidate,
  ProviderDetectionResult,
  ProviderDetectionState,
};

type DetectionDbClient = {
  importProviderMapping: {
    findMany(args: {
      select: {
        id: true;
        providerName: true;
        mappingVersion: true;
        normalizationRules: true;
        fieldMappings: {
          select: {
            sourceField: true;
            canonicalField: true;
            transformRules: true;
          };
        };
      };
    }): Promise<ProviderMappingRecord[]>;
  };
};

export async function detectProviderFromCsv(
  db: DetectionDbClient,
  csvContent: string,
): Promise<ProviderDetectionResult> {
  const records = await db.importProviderMapping.findMany({
    select: {
      id: true,
      providerName: true,
      mappingVersion: true,
      normalizationRules: true,
      fieldMappings: {
        select: {
          sourceField: true,
          canonicalField: true,
          transformRules: true,
        },
      },
    },
  });

  // A record that fails compilation is skipped as a detection candidate
  // rather than crashing detection; #56 owns the persistence-loading seam.
  const adapters = records
    .map((record) => compileProviderMapping(record))
    .filter(
      (result): result is Extract<typeof result, { ok: true }> => result.ok,
    )
    .map((result) => createProviderAdapter(result.definition));

  const statement = createCsvStatement(csvContent);

  return detectProviderFromAdapters(adapters, statement);
}
