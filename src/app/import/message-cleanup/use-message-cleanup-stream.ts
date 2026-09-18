"use client";

import { useEffect } from "react";
import type { CleanupPlan } from "@/lib/import/message-cleanup/plan";
import {
  type CleanupChunkResponse,
  parseCleanupChunkResponse,
} from "@/lib/import/message-cleanup/wire";
import type { CleanupRunController } from "./cleanup-run-controller";
import { runCleanupChunks } from "./run-cleanup-chunks";

export function fetchCleanupChunk(chunk: {
  sessionId: string;
  chunkIndex: number;
  signal?: AbortSignal;
}): Promise<CleanupChunkResponse> {
  return parseCleanupChunkResponse(
    chunk.chunkIndex,
    fetch("/api/imports/cleanup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: chunk.sessionId,
        chunkIndex: chunk.chunkIndex,
      }),
      signal: chunk.signal,
    }),
  );
}

export function useMessageCleanupStream(
  plan: CleanupPlan | null,
  onChunkResult: (rowIds: string[], result: CleanupChunkResponse) => void,
  runController: CleanupRunController,
) {
  useEffect(() => {
    if (!plan || plan.status !== "planned" || plan.chunks.length === 0) {
      return;
    }

    const signal = runController.start();
    void runCleanupChunks({
      plan,
      fetchChunk: fetchCleanupChunk,
      onChunkResult,
      signal,
    });
  }, [plan, onChunkResult, runController]);
}
