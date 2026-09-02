import { compileProviderAdapter, type ProviderAdapter } from "./adapter";
import {
  compileProviderMappingDefinition,
  ProviderMappingCompilationError,
  type ProviderMappingRecord,
} from "./mapping-definition";

export type ProviderAdapterCompilationFailure = {
  providerId: string;
  providerName: string;
  code: ProviderMappingCompilationError["code"];
  message: string;
};

export type LoadedProviderAdapters = {
  /** Successfully compiled adapters for every valid persisted mapping. */
  adapters: ProviderAdapter[];
  /** Persisted mappings that failed compilation, with a stable diagnostic each. */
  compilationFailures: ProviderAdapterCompilationFailure[];
};

type ProviderMappingRepositoryDbClient = {
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

/**
 * Persistence loading is an adapter at the repository seam: it loads
 * complete provider records once, in one shape, and compiles them before
 * detection or parsing run. Callers (the parse route, admin tooling) never
 * receive raw Prisma JSON values, and an invalid persisted mapping produces
 * a stable diagnostic instead of crashing import processing.
 */
export async function loadProviderAdapters(
  db: ProviderMappingRepositoryDbClient,
): Promise<LoadedProviderAdapters> {
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

  const adapters: ProviderAdapter[] = [];
  const compilationFailures: ProviderAdapterCompilationFailure[] = [];

  for (const record of records) {
    try {
      const definition = compileProviderMappingDefinition(record);
      adapters.push(compileProviderAdapter(definition));
    } catch (error) {
      if (error instanceof ProviderMappingCompilationError) {
        compilationFailures.push({
          providerId: record.id,
          providerName: record.providerName,
          code: error.code,
          message: error.message,
        });
        continue;
      }

      throw error;
    }
  }

  return { adapters, compilationFailures };
}
