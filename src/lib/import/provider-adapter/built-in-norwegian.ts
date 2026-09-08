import type { CsvParserResult } from "../csv-parser";
import {
  HEADER_ALIASES,
  parseNorwegianBankCsv,
  REQUIRED_HEADERS,
} from "../csv-parser";
import type {
  ProviderAdapter,
  ProviderAdapterDetectionCandidate,
} from "./adapter";
import type { CsvStatement } from "./csv-statement";
import { normalizeCsvHeader } from "./csv-statement";

export const BUILT_IN_NORWEGIAN_PROVIDER_ID = "built-in:norwegian";
const BUILT_IN_NORWEGIAN_PROVIDER_NAME = "Built-in Norwegian bank statement";
const BUILT_IN_NORWEGIAN_DELIMITER = ";";

/**
 * `HEADER_ALIASES` normalized once per canonical field, so detection can
 * recognize any of the Norwegian/English header spellings that
 * `parseNorwegianBankCsv` itself accepts.
 */
const NORMALIZED_HEADER_ALIASES: Record<
  (typeof REQUIRED_HEADERS)[number],
  string[]
> = Object.fromEntries(
  REQUIRED_HEADERS.map((field) => [
    field,
    HEADER_ALIASES[field].map((alias) => normalizeCsvHeader(alias)),
  ]),
) as Record<(typeof REQUIRED_HEADERS)[number], string[]>;

function detect(statement: CsvStatement): ProviderAdapterDetectionCandidate {
  const tokenized = statement.tokenize(BUILT_IN_NORWEGIAN_DELIMITER);
  const normalizedHeaderSet = new Set(tokenized.normalizedHeaders);

  const matchedHeaders: string[] = [];
  let requiredMatches = 0;

  for (const field of REQUIRED_HEADERS) {
    const matchedAlias = NORMALIZED_HEADER_ALIASES[field].find((alias) =>
      normalizedHeaderSet.has(alias),
    );
    if (matchedAlias) {
      requiredMatches += 1;
      matchedHeaders.push(matchedAlias);
    }
  }

  const requiredTotal = REQUIRED_HEADERS.length;
  const score = Number((requiredMatches / requiredTotal).toFixed(4));

  return {
    providerId: BUILT_IN_NORWEGIAN_PROVIDER_ID,
    providerName: BUILT_IN_NORWEGIAN_PROVIDER_NAME,
    requiredMatches,
    requiredTotal,
    patternMatches: 0,
    score,
    matchedHeaders,
  };
}

/**
 * Delegates to the untouched `parseNorwegianBankCsv` rather than an executable
 * `ProviderMappingDefinition`. That generic path canonicalizes booking dates to
 * ISO, validates thousands grouping strictly, and reports different diagnostic
 * text — all of which would change observable output for the built-in format.
 * This wrapper keeps existing rows, diagnostics, and message text byte-for-byte
 * identical while still exposing the shared `ProviderAdapter` interface.
 */
function parse(statement: CsvStatement): CsvParserResult {
  return parseNorwegianBankCsv(statement.content);
}

export function createBuiltInNorwegianAdapter(): ProviderAdapter {
  return {
    providerId: BUILT_IN_NORWEGIAN_PROVIDER_ID,
    providerName: BUILT_IN_NORWEGIAN_PROVIDER_NAME,
    detect,
    parse,
  };
}
