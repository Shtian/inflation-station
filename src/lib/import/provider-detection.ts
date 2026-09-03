import {
  normalizeCsvHeader,
  tokenizeCsv,
} from "./provider-adapter/csv-statement";

type ProviderMappingRecord = {
  id: string;
  providerName: string;
  normalizationRules: unknown;
  fieldMappings: Array<{
    sourceField: string;
  }>;
};

type DetectionDbClient = {
  importProviderMapping: {
    findMany(args: {
      select: {
        id: true;
        providerName: true;
        normalizationRules: true;
        fieldMappings: {
          select: {
            sourceField: true;
          };
        };
      };
    }): Promise<ProviderMappingRecord[]>;
  };
};

export type ProviderDetectionState = "certain" | "uncertain" | "missing";

export type ProviderDetectionCandidate = {
  providerId: string;
  providerName: string;
  requiredMatches: number;
  requiredTotal: number;
  patternMatches: number;
  score: number;
};

export type ProviderDetectionResult = {
  state: ProviderDetectionState;
  providerId: string | null;
  providerName: string | null;
  score: number;
  matchedHeaders: string[];
  candidates: ProviderDetectionCandidate[];
};

type DetectionRules = {
  requiredHeaders?: string[];
  anyHeaders?: string[];
  headerPatterns?: string[];
};

// NOTE: the comma fallback below intentionally differs from
// provider-adapter/csv-statement.ts's quote-aware `inferCsvDelimiter`
// (it splits on raw commas and drops empty cells). #52 unifies detection
// onto the shared CsvStatement contract; until then this preserves today's
// detection behavior exactly.
function parseHeaderCells(line: string): string[] {
  const semicolonCells = tokenizeCsv(line, ";").headerRow?.cells ?? [];
  if (semicolonCells.length > 1) {
    return semicolonCells;
  }

  return line
    .split(",")
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
}

function parseDetectionRules(rules: unknown): DetectionRules {
  if (!rules || typeof rules !== "object") {
    return {};
  }

  const requiredHeaders = Array.isArray(
    (rules as DetectionRules).requiredHeaders,
  )
    ? ((rules as DetectionRules).requiredHeaders?.filter(
        (value): value is string => typeof value === "string",
      ) ?? [])
    : [];
  const anyHeaders = Array.isArray((rules as DetectionRules).anyHeaders)
    ? ((rules as DetectionRules).anyHeaders?.filter(
        (value): value is string => typeof value === "string",
      ) ?? [])
    : [];
  const headerPatterns = Array.isArray((rules as DetectionRules).headerPatterns)
    ? ((rules as DetectionRules).headerPatterns?.filter(
        (value): value is string => typeof value === "string",
      ) ?? [])
    : [];

  return {
    requiredHeaders,
    anyHeaders,
    headerPatterns,
  };
}

function isLikelyHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  return /[a-zA-ZæøåÆØÅ]/.test(trimmed);
}

function readHeaderLine(csvContent: string): string | null {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    if (isLikelyHeaderLine(line)) {
      return line;
    }
  }

  return null;
}

export async function detectProviderFromCsv(
  db: DetectionDbClient,
  csvContent: string,
): Promise<ProviderDetectionResult> {
  const headerLine = readHeaderLine(csvContent);
  const headerCells = headerLine ? parseHeaderCells(headerLine) : [];
  const normalizedHeaderCells = headerCells.map((cell) =>
    normalizeCsvHeader(cell),
  );
  const headerSet = new Set(normalizedHeaderCells);
  const mappings = await db.importProviderMapping.findMany({
    select: {
      id: true,
      providerName: true,
      normalizationRules: true,
      fieldMappings: {
        select: {
          sourceField: true,
        },
      },
    },
  });

  if (!headerLine || mappings.length === 0) {
    return {
      state: "missing",
      providerId: null,
      providerName: null,
      score: 0,
      matchedHeaders: [],
      candidates: [],
    };
  }

  const candidates = mappings
    .map(
      (mapping): ProviderDetectionCandidate & { matchedHeaders: string[] } => {
        const rules = parseDetectionRules(mapping.normalizationRules);
        const requiredHeaders =
          rules.requiredHeaders && rules.requiredHeaders.length > 0
            ? rules.requiredHeaders.map((header) => normalizeCsvHeader(header))
            : mapping.fieldMappings
                .map((fieldMapping) =>
                  normalizeCsvHeader(fieldMapping.sourceField),
                )
                .filter((header) => header.length > 0);
        const anyHeaders =
          rules.anyHeaders?.map((header) => normalizeCsvHeader(header)) ?? [];

        const requiredMatches = requiredHeaders.filter((header) =>
          headerSet.has(header),
        );
        const optionalMatches = anyHeaders.filter((header) =>
          headerSet.has(header),
        );
        const requiredCoverage =
          requiredHeaders.length === 0
            ? 0
            : requiredMatches.length / requiredHeaders.length;
        const optionalCoverage =
          anyHeaders.length === 0
            ? 0
            : optionalMatches.length / anyHeaders.length;
        const patternMatches = (rules.headerPatterns ?? []).reduce(
          (count, pattern) => {
            try {
              const regex = new RegExp(pattern, "i");
              return regex.test(headerLine) ? count + 1 : count;
            } catch {
              return count;
            }
          },
          0,
        );

        const score = Number(
          (
            requiredCoverage +
            optionalCoverage * 0.5 +
            patternMatches * 0.25
          ).toFixed(4),
        );
        const matchedHeaders = [...requiredMatches, ...optionalMatches];

        return {
          providerId: mapping.id,
          providerName: mapping.providerName,
          requiredMatches: requiredMatches.length,
          requiredTotal: requiredHeaders.length,
          patternMatches,
          score,
          matchedHeaders,
        };
      },
    )
    .sort((left, right) => right.score - left.score);

  const best = candidates[0];
  if (!best || best.score === 0) {
    return {
      state: "missing",
      providerId: null,
      providerName: null,
      score: 0,
      matchedHeaders: [],
      candidates: candidates.map(
        ({ matchedHeaders: _matchedHeaders, ...rest }) => rest,
      ),
    };
  }

  const second = candidates[1];
  const isConfident =
    best.requiredTotal > 0 &&
    best.requiredMatches === best.requiredTotal &&
    (!second || best.score - second.score >= 0.2);

  return {
    state: isConfident ? "certain" : "uncertain",
    providerId: best.providerId,
    providerName: best.providerName,
    score: best.score,
    matchedHeaders: best.matchedHeaders,
    candidates: candidates.map(
      ({ matchedHeaders: _matchedHeaders, ...rest }) => rest,
    ),
  };
}
