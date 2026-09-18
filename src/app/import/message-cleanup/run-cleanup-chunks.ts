import type { CleanupPlan } from "@/lib/import/message-cleanup/plan";
import type { CleanupChunkResponse } from "@/lib/import/message-cleanup/wire";

export const CLEANUP_CHUNK_CONCURRENCY = 6;

type PlannedCleanupPlan = Extract<CleanupPlan, { status: "planned" }>;

export async function runCleanupChunks(params: {
  plan: PlannedCleanupPlan;
  concurrency?: number;
  signal?: AbortSignal;
  fetchChunk: (chunk: {
    sessionId: string;
    chunkIndex: number;
    signal?: AbortSignal;
  }) => Promise<CleanupChunkResponse>;
  onChunkResult: (rowIds: string[], result: CleanupChunkResponse) => void;
}): Promise<void> {
  const { plan, fetchChunk, onChunkResult, signal } = params;
  const concurrency = Math.max(
    1,
    params.concurrency ?? CLEANUP_CHUNK_CONCURRENCY,
  );
  const workerCount = Math.min(concurrency, plan.chunks.length);
  let nextChunkPosition = 0;

  // Each worker's while-loop body runs synchronously up to its await, so the
  // initial burst dispatches in ascending index order; nextChunkPosition is a
  // single-thread counter, so order stays ascending as workers pull more work.
  async function worker() {
    while (nextChunkPosition < plan.chunks.length) {
      if (signal?.aborted) {
        return;
      }

      const chunk = plan.chunks[nextChunkPosition];
      nextChunkPosition += 1;

      const result = await fetchChunk({
        sessionId: plan.sessionId,
        chunkIndex: chunk.index,
        signal,
      });

      if (signal?.aborted) {
        return;
      }

      onChunkResult(chunk.rowIds, result);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));
}
