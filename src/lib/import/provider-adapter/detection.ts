import type {
  ProviderAdapter,
  ProviderAdapterDetectionCandidate,
} from "./adapter";
import type { CsvStatement } from "./csv-statement";

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

const MIN_CONFIDENT_SCORE_SEPARATION = 0.2;

function toDetectionCandidate(
  candidate: ProviderAdapterDetectionCandidate,
): ProviderDetectionCandidate {
  return {
    providerId: candidate.providerId,
    providerName: candidate.providerName,
    requiredMatches: candidate.requiredMatches,
    requiredTotal: candidate.requiredTotal,
    patternMatches: candidate.patternMatches,
    score: candidate.score,
  };
}

function missingResult(
  candidates: ProviderDetectionCandidate[] = [],
): ProviderDetectionResult {
  return {
    state: "missing",
    providerId: null,
    providerName: null,
    score: 0,
    matchedHeaders: [],
    candidates,
  };
}

export function detectProviderFromAdapters(
  adapters: ReadonlyArray<ProviderAdapter>,
  statement: CsvStatement,
): ProviderDetectionResult {
  const headerRow = statement.tokenize().headerRow;

  if (!headerRow || adapters.length === 0) {
    return missingResult();
  }

  const candidates = adapters
    .map((adapter) => adapter.detect(statement))
    .sort((left, right) => right.score - left.score);

  const best = candidates[0];
  if (!best || best.score === 0) {
    return missingResult(candidates.map(toDetectionCandidate));
  }

  const second = candidates[1];
  const isConfident =
    best.requiredTotal > 0 &&
    best.requiredMatches === best.requiredTotal &&
    (!second || best.score - second.score >= MIN_CONFIDENT_SCORE_SEPARATION);

  return {
    state: isConfident ? "certain" : "uncertain",
    providerId: best.providerId,
    providerName: best.providerName,
    score: best.score,
    matchedHeaders: best.matchedHeaders,
    candidates: candidates.map(toDetectionCandidate),
  };
}
