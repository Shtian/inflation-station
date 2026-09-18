"use client";

import { useEffect } from "react";
import type { CleanupPlan } from "@/lib/import/message-cleanup/plan";
import {
  type CleanupChunkResponse,
  parseCleanupChunkResponse,
} from "@/lib/import/message-cleanup/wire";

export function useMessageCleanupStream(
  plan: CleanupPlan | null,
  onChunkResult: (rowIds: string[], result: CleanupChunkResponse) => void,
) {
  useEffect(() => {
    if (!plan || plan.status !== "planned" || plan.chunks.length === 0) {
      return;
    }

    async function run() {
      if (!plan || plan.status !== "planned") {
        return;
      }

      for (const chunk of plan.chunks) {
        const response = await fetch("/api/imports/cleanup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId: plan.sessionId,
            chunkIndex: chunk.index,
          }),
        });
        const body = await response.json().catch(() => null);
        const parsed = parseCleanupChunkResponse(body);

        onChunkResult(
          chunk.rowIds,
          parsed ?? {
            index: chunk.index,
            status: "unavailable",
            reason: "provider_error",
          },
        );
      }
    }

    void run();
  }, [plan, onChunkResult]);
}
