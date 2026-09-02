import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { prismaMock, submitImportReviewMock } = vi.hoisted(() => ({
  prismaMock: { _tag: "prisma-mock" },
  submitImportReviewMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/transactions/note", () => ({
  MAX_TRANSACTION_NOTE_LENGTH: 500,
  MAX_TRANSACTION_NOTE_LENGTH_MESSAGE: "Note must be 500 characters or fewer.",
}));

vi.mock("@/lib/import/review-submit", () => ({
  submitImportReview: submitImportReviewMock,
  ImportReviewSessionNotFoundError: class ImportReviewSessionNotFoundError extends Error {
    constructor(sessionId: string) {
      super(sessionId);
      this.name = "ImportReviewSessionNotFoundError";
    }
  },
  InvalidImportReviewCategoryError: class InvalidImportReviewCategoryError extends Error {
    readonly categoryIds: string[];

    constructor(categoryIds: string[]) {
      super(categoryIds.join(","));
      this.name = "InvalidImportReviewCategoryError";
      this.categoryIds = categoryIds;
    }
  },
  DuplicateImportReviewRowDecisionError: class DuplicateImportReviewRowDecisionError extends Error {
    readonly rowIds: string[];

    constructor(rowIds: string[]) {
      super(rowIds.join(","));
      this.name = "DuplicateImportReviewRowDecisionError";
      this.rowIds = rowIds;
    }
  },
  UnknownImportReviewRowDecisionError: class UnknownImportReviewRowDecisionError extends Error {
    readonly rowIds: string[];

    constructor(rowIds: string[]) {
      super(rowIds.join(","));
      this.name = "UnknownImportReviewRowDecisionError";
      this.rowIds = rowIds;
    }
  },
}));

describe("POST /api/imports/submit", () => {
  beforeEach(() => {
    submitImportReviewMock.mockReset();
  });

  it("returns 400 when a row note is longer than 500 characters", async () => {
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "session-1",
          rows: [
            {
              rowId: "row-1",
              categoryId: null,
              selectedMessage: "message",
              note: "x".repeat(501),
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(submitImportReviewMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_IMPORT_REVIEW_SUBMIT_PAYLOAD",
      message:
        "Expected sessionId and rows [{ rowId, categoryId, selectedMessage, note? }] in request body. Note must be 500 characters or fewer.",
    });
  });

  it("accepts note values with exactly 500 characters", async () => {
    submitImportReviewMock.mockResolvedValue({
      summary: {
        imported: 1,
        invalid: 0,
      },
    });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "session-1",
          rows: [
            {
              rowId: "row-1",
              categoryId: null,
              selectedMessage: "message",
              note: "x".repeat(500),
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(submitImportReviewMock).toHaveBeenCalledWith(prismaMock, {
      sessionId: "session-1",
      rows: [
        {
          rowId: "row-1",
          categoryId: null,
          selectedMessage: "message",
          note: "x".repeat(500),
        },
      ],
    });
  });

  it("ignores a legacy invalidCount field in the request body instead of rejecting it", async () => {
    submitImportReviewMock.mockResolvedValue({
      summary: {
        imported: 1,
        invalid: 3,
      },
    });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "session-1",
          invalidCount: 0,
          rows: [
            {
              rowId: "row-1",
              categoryId: null,
              selectedMessage: "message",
              note: null,
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(submitImportReviewMock).toHaveBeenCalledWith(prismaMock, {
      sessionId: "session-1",
      rows: [
        {
          rowId: "row-1",
          categoryId: null,
          selectedMessage: "message",
          note: null,
        },
      ],
    });
    await expect(response.json()).resolves.toEqual({
      summary: { imported: 1, invalid: 3 },
    });
  });

  it("maps a not-found session to a 404 response", async () => {
    const { ImportReviewSessionNotFoundError } = await import(
      "@/lib/import/review-submit"
    );
    submitImportReviewMock.mockRejectedValue(
      new ImportReviewSessionNotFoundError("session-1"),
    );

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "session-1",
          rows: [],
        }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "IMPORT_REVIEW_SESSION_NOT_FOUND",
      message: "Import review session was not found or already submitted.",
    });
  });

  it("maps a duplicate row decision to a 400 response", async () => {
    const { DuplicateImportReviewRowDecisionError } = await import(
      "@/lib/import/review-submit"
    );
    submitImportReviewMock.mockRejectedValue(
      new DuplicateImportReviewRowDecisionError(["row-1"]),
    );

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "session-1",
          rows: [
            { rowId: "row-1", categoryId: null, selectedMessage: "a" },
            { rowId: "row-1", categoryId: null, selectedMessage: "a" },
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "DUPLICATE_IMPORT_REVIEW_ROW_DECISION",
      message: "Duplicate decisions were submitted for the same staged row.",
      rowIds: ["row-1"],
    });
  });

  it("maps an unknown row decision to a 400 response", async () => {
    const { UnknownImportReviewRowDecisionError } = await import(
      "@/lib/import/review-submit"
    );
    submitImportReviewMock.mockRejectedValue(
      new UnknownImportReviewRowDecisionError(["row-x"]),
    );

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "session-1",
          rows: [{ rowId: "row-x", categoryId: null, selectedMessage: "a" }],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "UNKNOWN_IMPORT_REVIEW_ROW_DECISION",
      message:
        "One or more submitted row IDs do not belong to this review session.",
      rowIds: ["row-x"],
    });
  });
});
