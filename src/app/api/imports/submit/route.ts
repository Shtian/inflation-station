import { NextResponse } from "next/server";
import {
  ImportReviewSessionNotFoundError,
  InvalidImportReviewCategoryError,
  submitImportReview,
} from "@/lib/import/review-submit";
import { prisma } from "@/lib/prisma";

type SubmitImportPayload = {
  sessionId: string;
  invalidCount: number;
  rows: Array<{
    rowId: string;
    categoryId: string | null;
    selectedMessage: string;
  }>;
};

function badRequest(error: string, message: string) {
  return NextResponse.json({ error, message }, { status: 400 });
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

  if (
    !("invalidCount" in payload) ||
    typeof payload.invalidCount !== "number"
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

      return {
        rowId: row.rowId,
        categoryId: row.categoryId,
        selectedMessage: row.selectedMessage,
      };
    })
    .filter(
      (
        row,
      ): row is {
        rowId: string;
        categoryId: string | null;
        selectedMessage: string;
      } => row !== null,
    );

  if (rows.length !== payload.rows.length) {
    return null;
  }

  return {
    sessionId: payload.sessionId.trim(),
    invalidCount: payload.invalidCount,
    rows,
  };
}

export async function POST(request: Request) {
  const payload = parsePayload(await request.json().catch(() => null));

  if (!payload) {
    return badRequest(
      "INVALID_IMPORT_REVIEW_SUBMIT_PAYLOAD",
      "Expected sessionId, invalidCount, and rows [{ rowId, categoryId, selectedMessage }] in request body.",
    );
  }

  try {
    const result = await submitImportReview(prisma, payload);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ImportReviewSessionNotFoundError) {
      return NextResponse.json(
        {
          error: "IMPORT_REVIEW_SESSION_NOT_FOUND",
          message: "Import review session was not found or already submitted.",
        },
        { status: 404 },
      );
    }

    if (error instanceof InvalidImportReviewCategoryError) {
      return NextResponse.json(
        {
          error: "INVALID_IMPORT_REVIEW_CATEGORY",
          message:
            "One or more selected categories are invalid for the selected account.",
          categoryIds: error.categoryIds,
        },
        { status: 400 },
      );
    }

    throw error;
  }
}
