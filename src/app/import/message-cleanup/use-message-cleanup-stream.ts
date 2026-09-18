"use client";

import { useEffect } from "react";
import type { CleanupPlan } from "@/lib/import/message-cleanup/plan";
import {
  type CleanupChunkResponse,
  parseCleanupChunkResponse,
} from "@/lib/import/message-cleanup/wire";
import { runCleanupChunks } from "./run-cleanup-chunks";

async function fetchCleanupChunk(chunk: {
  sessionId: string;
  chunkIndex: number;
}): Promise<CleanupChunkResponse> {
  const response = await fetch("/api/imports/cleanup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId: chunk.sessionId,
      chunkIndex: chunk.chunkIndex,
    }),
  });
  const body = await response.json().catch(() => null);
  const parsed = parseCleanupChunkResponse(body);

  return (
    parsed ?? {
      index: chunk.chunkIndex,
      status: "unavailable",
      reason: "provider_error",
    }
  );
}

export function useMessageCleanupStream(
  plan: CleanupPlan | null,
  onChunkResult: (rowIds: string[], result: CleanupChunkResponse) => void,
) {
  useEffect(() => {
    if (!plan || plan.status !== "planned" || plan.chunks.length === 0) {
      return;
    }

    void runCleanupChunks({
      plan,
      fetchChunk: fetchCleanupChunk,
      onChunkResult,
    });
  }, [plan, onChunkResult]);
}
