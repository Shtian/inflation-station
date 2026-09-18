import { NextResponse } from "next/server";
import { z } from "zod";
import { runCleanupChunk } from "@/lib/import/message-cleanup/chunk";
import {
  planCleanupChunks,
  toCleanupCandidates,
  toCleanupMessage,
} from "@/lib/import/message-cleanup/plan";
import { getMessageCleanupSettings } from "@/lib/import/message-cleanup-settings";
import { prisma } from "@/lib/prisma";

const cleanupRequestSchema = z.object({
  sessionId: z.string().trim().min(1),
  chunkIndex: z.number().int().min(0),
});

function badRequest(error: string, message: string) {
  return NextResponse.json({ error, message }, { status: 400 });
}

export async function POST(request: Request) {
  const payload = cleanupRequestSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!payload.success) {
    return badRequest(
      "INVALID_CLEANUP_CHUNK_PAYLOAD",
      "Expected sessionId and chunkIndex in request body.",
    );
  }

  const { sessionId, chunkIndex } = payload.data;

  const rows = await prisma.importReviewRow.findMany({
    where: { sessionId },
    select: { id: true, rowNumber: true, name: true, title: true },
  });

  if (rows.length === 0) {
    return NextResponse.json(
      {
        error: "IMPORT_REVIEW_SESSION_NOT_FOUND",
        message: "Import review session was not found or already submitted.",
      },
      { status: 404 },
    );
  }

  const plan = planCleanupChunks({
    sessionId,
    disabledReason: null,
    candidates: toCleanupCandidates(rows),
  });
  const chunk = plan.status === "planned" ? plan.chunks[chunkIndex] : undefined;

  if (!chunk) {
    return badRequest(
      "INVALID_CLEANUP_CHUNK_INDEX",
      "chunkIndex does not match a chunk in this session's cleanup plan.",
    );
  }

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const chunkRows = chunk.rowIds.flatMap((rowId) => {
    const row = rowById.get(rowId);
    return row
      ? [{ rowNumber: row.rowNumber, message: toCleanupMessage(row) }]
      : [];
  });
  const rowIdByRowNumber = new Map(
    chunk.rowIds.flatMap((rowId) => {
      const row = rowById.get(rowId);
      return row ? [[row.rowNumber, rowId] as const] : [];
    }),
  );

  const settings = await getMessageCleanupSettings(prisma);
  const result = await runCleanupChunk({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: settings.modelId,
    systemPrompt: settings.prompt,
    reasoningEffort: settings.reasoningEffort,
    rows: chunkRows,
  });

  if (result.status === "failed") {
    return NextResponse.json({
      index: chunkIndex,
      status: "failed",
      reason: result.reason,
    });
  }

  const suggestions = result.suggestions.flatMap((suggestion) => {
    const rowId = rowIdByRowNumber.get(suggestion.rowNumber);
    return rowId ? [{ rowId, cleanedMessage: suggestion.cleanedMessage }] : [];
  });

  return NextResponse.json({ index: chunkIndex, status: "ok", suggestions });
}
