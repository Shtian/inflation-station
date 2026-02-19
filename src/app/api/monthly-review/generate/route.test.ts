import { MonthlyReviewStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const {
  generateMonthlyReviewMock,
  prismaMock,
  MonthlyReviewMonthStartValidationErrorMock,
} = vi.hoisted(() => {
  class MonthlyReviewMonthStartValidationError extends Error {
    constructor() {
      super("MONTH_START_INVALID");
      this.name = "MonthlyReviewMonthStartValidationError";
    }
  }

  return {
    generateMonthlyReviewMock: vi.fn(),
    prismaMock: { _tag: "prisma-mock" },
    MonthlyReviewMonthStartValidationErrorMock:
      MonthlyReviewMonthStartValidationError,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/monthly-review/generation", () => ({
  generateMonthlyReview: generateMonthlyReviewMock,
  MonthlyReviewMonthStartValidationError:
    MonthlyReviewMonthStartValidationErrorMock,
}));

describe("POST /api/monthly-review/generate", () => {
  beforeEach(() => {
    generateMonthlyReviewMock.mockReset();
    generateMonthlyReviewMock.mockResolvedValue({
      monthStart: "2026-02-01",
      status: MonthlyReviewStatus.GENERATED,
      generatedAt: "2026-02-20T10:00:00.000Z",
      errorMessage: null,
      reviewText: "Spend remained stable.",
      unavailableReason: null,
    });
  });

  it("returns 400 for invalid payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/monthly-review/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          month: "2026-02-01",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(generateMonthlyReviewMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_MONTHLY_REVIEW_GENERATE_PAYLOAD",
      message: "Expected monthStart (YYYY-MM-01) in request body.",
    });
  });

  it("returns generated result from service", async () => {
    const response = await POST(
      new Request("http://localhost/api/monthly-review/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          monthStart: "2026-02-01",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(generateMonthlyReviewMock).toHaveBeenCalledWith(prismaMock, {
      monthStart: "2026-02-01",
    });
    await expect(response.json()).resolves.toEqual({
      monthStart: "2026-02-01",
      status: MonthlyReviewStatus.GENERATED,
      generatedAt: "2026-02-20T10:00:00.000Z",
      errorMessage: null,
      reviewText: "Spend remained stable.",
      unavailableReason: null,
    });
  });

  it("maps month validation errors to stable 400 response", async () => {
    generateMonthlyReviewMock.mockRejectedValue(
      new MonthlyReviewMonthStartValidationErrorMock(),
    );

    const response = await POST(
      new Request("http://localhost/api/monthly-review/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          monthStart: "2026-02-15",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_MONTH_START",
      message: "Expected monthStart to match YYYY-MM-01.",
    });
  });

  it("maps unknown failures to stable 500 response", async () => {
    generateMonthlyReviewMock.mockRejectedValue(new Error("boom"));

    const response = await POST(
      new Request("http://localhost/api/monthly-review/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          monthStart: "2026-02-01",
        }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "MONTHLY_REVIEW_GENERATION_FAILED",
      message: "Could not generate monthly review.",
    });
  });
});
