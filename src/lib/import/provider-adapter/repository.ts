import { createProviderAdapter, type ProviderAdapter } from "./adapter";
import { compileProviderMapping } from "./compile-mapping";
import type {
  ProviderMappingConfigurationError,
  ProviderMappingRecord,
} from "./mapping-definition";

const PROVIDER_MAPPING_SELECT = {
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
} as const;

export type ProviderAdapterDbClient = {
  importProviderMapping: {
    findMany(args: {
      select: typeof PROVIDER_MAPPING_SELECT;
    }): Promise<ProviderMappingRecord[]>;
  };
};

export type LoadedProviderAdapters = {
  adapters: ProviderAdapter[];
  /**
   * Diagnostics for persisted mappings that failed compilation. Each error's
   * `details.providerMappingId` identifies the offending record, so callers
   * can distinguish "unknown provider id" from "provider id maps to an
   * invalid mapping" without a second query.
   */
  configurationErrors: ProviderMappingConfigurationError[];
};

/**
 * Loads every persisted provider mapping in one query and compiles each into
 * an executable adapter. Records that fail compilation are collected as
 * configuration diagnostics rather than thrown, so one invalid mapping never
 * crashes detection or parsing for the rest.
 */
export async function loadProviderAdapters(
  db: ProviderAdapterDbClient,
): Promise<LoadedProviderAdapters> {
  const records = await db.importProviderMapping.findMany({
    select: PROVIDER_MAPPING_SELECT,
  });

  const adapters: ProviderAdapter[] = [];
  const configurationErrors: ProviderMappingConfigurationError[] = [];

  for (const record of records) {
    const compiled = compileProviderMapping(record);

    if (compiled.ok) {
      adapters.push(createProviderAdapter(compiled.definition));
      continue;
    }

    configurationErrors.push({
      ...compiled.error,
      details: {
        ...compiled.error.details,
        providerMappingId: record.id,
      },
    });
  }

  return { adapters, configurationErrors };
}
