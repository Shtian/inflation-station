import {
  HEADER_ALIASES,
  parseNorwegianBankCsv,
  REQUIRED_HEADERS,
} from "../csv-parser";
import type { AdapterDetectionCandidate, ProviderAdapter } from "./adapter";
import type { TokenizedCsv } from "./csv-tokenizer";
import { normalizeHeader } from "./header-normalization";

export const BUILT_IN_PROVIDER_ID = "built-in-norwegian";
export const BUILT_IN_PROVIDER_NAME = "Norwegian Bank (built-in)";

const normalizedAliasesByHeader = REQUIRED_HEADERS.map((header) => ({
  header,
  aliases: HEADER_ALIASES[header].map((alias) => normalizeHeader(alias)),
}));

/**
 * The built-in Norwegian bank parser represented behind the same canonical
 * adapter interface as compiled provider mappings. It remains a code-defined
 * adapter rather than a persisted mapping, but callers (parse route,
 * staging) select and invoke it through the same `ProviderAdapter` shape, so
 * staging never branches on parser function names.
 */
export const builtInProviderAdapter: ProviderAdapter = {
  id: BUILT_IN_PROVIDER_ID,
  providerName: BUILT_IN_PROVIDER_NAME,
  mappingVersion: 1,
  detect(csv: TokenizedCsv): AdapterDetectionCandidate {
    const headerSet = new Set(
      csv.headerCells.map((cell) => normalizeHeader(cell)),
    );
    const matchedHeaders = normalizedAliasesByHeader
      .filter(({ aliases }) => aliases.some((alias) => headerSet.has(alias)))
      .map(
        ({ aliases }) => aliases.find((alias) => headerSet.has(alias)) ?? "",
      );

    const requiredTotal = normalizedAliasesByHeader.length;
    const requiredMatches = matchedHeaders.length;
    const score = requiredTotal === 0 ? 0 : requiredMatches / requiredTotal;

    return {
      providerId: BUILT_IN_PROVIDER_ID,
      providerName: BUILT_IN_PROVIDER_NAME,
      requiredMatches,
      requiredTotal,
      patternMatches: 0,
      score: Number(score.toFixed(4)),
      matchedHeaders,
    };
  },
  parse(csvContent: string) {
    return parseNorwegianBankCsv(csvContent);
  },
};
