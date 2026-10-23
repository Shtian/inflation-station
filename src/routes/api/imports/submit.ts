import { createFileRoute } from "@tanstack/react-router";
import {
  ImportReviewSessionNotFoundError,
  InvalidImportReviewCategoryError,
  InvalidImportReviewDecisionsError,
  submitImportReview,
} from "@/lib/import/review-submit";
import { prisma } from "@/lib/prisma";
import {
  MAX_TRANSACTION_NOTE_LENGTH,
  MAX_TRANSACTION_NOTE_LENGTH_MESSAGE,
} from "@/lib/transactions/note";

type SubmitImportPayload = {
  sessionId: string;
  rows: Array<{
    rowId: string;
    categoryId: string | null;
    selectedMessage: string;
    note: string | null;
  }>;
};

function badRequest(error: string, message: string) {
  return Response.json({ error, message }, { status: 400 });
}

function parsePayload(payload: unknown): SubmitImportPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (
    !("sessionId" in payload) ||
    typeof payload.sessionId !== "string" ||
    payload.sessionId.trim().length === 0
  ) {
    return null;
  }

  if (!("rows" in payload) || !Array.isArray(payload.rows)) {
    return null;
  }

  const rows = payload.rows
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }

      if (!("rowId" in row) || typeof row.rowId !== "string") {
        return null;
      }

      if (!("categoryId" in row)) {
        return null;
      }

      if (typeof row.categoryId !== "string" && row.categoryId !== null) {
        return null;
      }

      if (
        !("selectedMessage" in row) ||
        typeof row.selectedMessage !== "string"
      ) {
        return null;
      }

      if ("note" in row && typeof row.note !== "string" && row.note !== null) {
        return null;
      }

      if (
        typeof row.note === "string" &&
        row.note.length > MAX_TRANSACTION_NOTE_LENGTH
      ) {
        return null;
      }

      return {
        rowId: row.rowId,
        categoryId: row.categoryId,
        selectedMessage: row.selectedMessage,
        note: row.note ?? null,
      };
    })
    .filter(
      (
        row,
      ): row is {
        rowId: string;
        categoryId: string | null;
        selectedMessage: string;
        note: string | null;
      } => row !== null,
    );

  if (rows.length !== payload.rows.length) {
    return null;
  }

  return {
    sessionId: payload.sessionId.trim(),
    rows,
  };
}

export const Route = createFileRoute("/api/imports/submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = parsePayload(await request.json().catch(() => null));

        if (!payload) {
          return badRequest(
            "INVALID_IMPORT_REVIEW_SUBMIT_PAYLOAD",
            `Forventet sessionId og en liste med radvalg [{ rowId, categoryId, selectedMessage, note? }] i forespørselen. ${MAX_TRANSACTION_NOTE_LENGTH_MESSAGE}`,
          );
        }

        try {
          const result = await submitImportReview(prisma, payload);
          return Response.json(result);
        } catch (error) {
          if (error instanceof ImportReviewSessionNotFoundError) {
            return Response.json(
              {
                error: "IMPORT_REVIEW_SESSION_NOT_FOUND",
                message:
                  "Fant ikke importgjennomgangen, eller den er allerede sendt inn.",
              },
              { status: 404 },
            );
          }

          if (error instanceof InvalidImportReviewCategoryError) {
            return Response.json(
              {
                error: "INVALID_IMPORT_REVIEW_CATEGORY",
                message: "Én eller flere av de valgte kategoriene finnes ikke.",
                categoryIds: error.categoryIds,
              },
              { status: 400 },
            );
          }

          if (error instanceof InvalidImportReviewDecisionsError) {
            return Response.json(
              {
                error: "INVALID_IMPORT_REVIEW_DECISIONS",
                message:
                  "Ett eller flere av de innsendte radvalgene er ugyldige: dupliserte eller ukjente rad-ID-er.",
                duplicateRowIds: error.duplicateRowIds,
                unknownRowIds: error.unknownRowIds,
              },
              { status: 400 },
            );
          }

          throw error;
        }
      },
      ANY: async () => new Response(null, { status: 405 }),
    },
  },
});
