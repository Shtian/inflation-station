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
          invalidCount: 0,
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
        "Expected sessionId, invalidCount, and rows [{ rowId, categoryId, selectedMessage, note? }] in request body. Note must be 500 characters or fewer.",
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
          invalidCount: 0,
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
      invalidCount: 0,
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
});
