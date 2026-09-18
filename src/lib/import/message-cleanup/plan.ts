import type { CleanupDisabledReason } from "./reasons";

export const DEFAULT_CLEANUP_CHUNK_SIZE = 25;

export type CleanupCandidateRow = {
  id: string;
  rowNumber: number;
  name: string;
  title: string;
};

export type CleanupCandidate = {
  rowId: string;
  rowNumber: number;
  message: string;
};

export type CleanupChunk = {
  index: number;
  rowIds: string[];
};

export type CleanupPlan =
  | { status: "planned"; sessionId: string; chunks: CleanupChunk[] }
  | { status: "unavailable"; reason: CleanupDisabledReason; rowIds: string[] };

export function toCleanupMessage(row: { name: string; title: string }): string {
  return `${row.name} ${row.title}`.trim();
}

export function toCleanupCandidates(
  rows: CleanupCandidateRow[],
): CleanupCandidate[] {
  return rows
    .map((row) => ({
      rowId: row.id,
      rowNumber: row.rowNumber,
      message: toCleanupMessage(row),
    }))
    .filter((candidate) => candidate.message.length > 0);
}

export function planCleanupChunks(params: {
  sessionId: string;
  disabledReason: CleanupDisabledReason | null;
  candidates: CleanupCandidate[];
  chunkSize?: number;
}): CleanupPlan {
  if (params.disabledReason) {
    return {
      status: "unavailable",
      reason: params.disabledReason,
      rowIds: params.candidates.map((candidate) => candidate.rowId),
    };
  }

  const chunkSize = Math.max(1, params.chunkSize ?? DEFAULT_CLEANUP_CHUNK_SIZE);
  const sorted = [...params.candidates].sort(
    (a, b) => a.rowNumber - b.rowNumber,
  );
  const chunks: CleanupChunk[] = [];

  for (let start = 0; start < sorted.length; start += chunkSize) {
    chunks.push({
      index: chunks.length,
      rowIds: sorted.slice(start, start + chunkSize).map((c) => c.rowId),
    });
  }

  return { status: "planned", sessionId: params.sessionId, chunks };
}
