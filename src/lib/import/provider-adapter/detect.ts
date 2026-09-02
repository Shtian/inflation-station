import type { ProviderAdapter } from "./adapter";
import { tokenizeCsv } from "./csv-tokenizer";

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

const MISSING_RESULT: ProviderDetectionResult = {
  state: "missing",
  providerId: null,
  providerName: null,
  score: 0,
  matchedHeaders: [],
  candidates: [],
};

/**
 * Evaluates every compiled provider adapter against one shared tokenized
 * view of the CSV. This is the single detection seam: it runs synchronously
 * over already-compiled adapters (no database access), so tests exercise the
 * same executable rules that parsing will use, rather than a separate
 * reinterpretation of raw persisted JSON.
 */
export function detectProvider(
  csvContent: string,
  adapters: ReadonlyArray<ProviderAdapter>,
): ProviderDetectionResult {
  const csv = tokenizeCsv(csvContent);

  if (!csv || adapters.length === 0) {
    return MISSING_RESULT;
  }

  const candidates = adapters
    .map((adapter) => adapter.detect(csv))
    .sort((left, right) => right.score - left.score);

  const best = candidates[0];
  const strippedCandidates: ProviderDetectionCandidate[] = candidates.map(
    ({ matchedHeaders: _matchedHeaders, ...rest }) => rest,
  );

  if (!best || best.score === 0) {
    return {
      state: "missing",
      providerId: null,
      providerName: null,
      score: 0,
      matchedHeaders: [],
      candidates: strippedCandidates,
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
    candidates: strippedCandidates,
  };
}
