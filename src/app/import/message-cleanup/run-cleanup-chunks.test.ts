import { describe, expect, it } from "vitest";
import type { CleanupPlan } from "@/lib/import/message-cleanup/plan";
import type { CleanupChunkResponse } from "@/lib/import/message-cleanup/wire";
import { runCleanupChunks } from "./run-cleanup-chunks";

type PlannedCleanupPlan = Extract<CleanupPlan, { status: "planned" }>;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function flushMicrotasks() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function okResult(index: number, rowId: string): CleanupChunkResponse {
  return {
    index,
    status: "ok",
    suggestions: [{ rowId, cleanedMessage: `cleaned-${rowId}` }],
  };
}

function buildPlan(): PlannedCleanupPlan {
  return {
    status: "planned",
    sessionId: "session-1",
    chunks: [
      { index: 0, rowIds: ["row-0"] },
      { index: 1, rowIds: ["row-1"] },
      { index: 2, rowIds: ["row-2"] },
      { index: 3, rowIds: ["row-3"] },
    ],
  };
}

describe("runCleanupChunks", () => {
  it("never exceeds the configured concurrency", async () => {
    const plan = buildPlan();
    const deferreds = plan.chunks.map(() =>
      createDeferred<CleanupChunkResponse>(),
    );
    let inFlight = 0;
    let peakInFlight = 0;

    const run = runCleanupChunks({
      plan,
      concurrency: 2,
      fetchChunk: async ({ chunkIndex }) => {
        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);
        const result = await deferreds[chunkIndex].promise;
        inFlight -= 1;
        return result;
      },
      onChunkResult: () => {},
    });

    for (const deferred of [...deferreds].reverse()) {
      deferred.resolve(okResult(0, "row-x"));
      await flushMicrotasks();
    }
    await run;

    expect(peakInFlight).toBeLessThanOrEqual(2);
  });

  it("invokes fetchChunk with ascending chunkIndex regardless of resolve order", async () => {
    const plan = buildPlan();
    const deferreds = plan.chunks.map(() =>
      createDeferred<CleanupChunkResponse>(),
    );
    const invokedIndexes: number[] = [];

    const run = runCleanupChunks({
      plan,
      concurrency: 4,
      fetchChunk: async ({ chunkIndex }) => {
        invokedIndexes.push(chunkIndex);
        return deferreds[chunkIndex].promise;
      },
      onChunkResult: () => {},
    });

    expect(invokedIndexes).toEqual([0, 1, 2, 3]);

    deferreds[3].resolve(okResult(3, "row-3"));
    deferreds[0].resolve(okResult(0, "row-0"));
    deferreds[1].resolve(okResult(1, "row-1"));
    deferreds[2].resolve(okResult(2, "row-2"));
    await run;
  });

  it("applies each chunk's own rowIds and result, with no cross-contamination", async () => {
    const plan = buildPlan();
    const deferreds = plan.chunks.map(() =>
      createDeferred<CleanupChunkResponse>(),
    );
    const calls: Array<{ rowIds: string[]; result: CleanupChunkResponse }> = [];

    const run = runCleanupChunks({
      plan,
      concurrency: 4,
      fetchChunk: ({ chunkIndex }) => deferreds[chunkIndex].promise,
      onChunkResult: (rowIds, result) => {
        calls.push({ rowIds, result });
      },
    });

    deferreds[1].resolve(okResult(1, "row-1"));
    await flushMicrotasks();

    expect(calls).toEqual([
      { rowIds: ["row-1"], result: okResult(1, "row-1") },
    ]);

    deferreds[0].resolve(okResult(0, "row-0"));
    deferreds[2].resolve(okResult(2, "row-2"));
    deferreds[3].resolve(okResult(3, "row-3"));
    await run;

    expect(calls[1]).toEqual({
      rowIds: ["row-0"],
      result: okResult(0, "row-0"),
    });
  });
});
