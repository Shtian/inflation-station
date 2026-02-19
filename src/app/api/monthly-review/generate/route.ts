import { NextResponse } from "next/server";
import {
  generateMonthlyReview,
  MonthlyReviewMonthStartValidationError,
} from "@/lib/monthly-review/generation";
import { prisma } from "@/lib/prisma";

type GenerateMonthlyReviewPayload = {
  monthStart: string;
};

function parsePayload(payload: unknown): GenerateMonthlyReviewPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (!("monthStart" in payload) || typeof payload.monthStart !== "string") {
    return null;
  }

  const monthStart = payload.monthStart.trim();
  if (!monthStart) {
    return null;
  }

  return { monthStart };
}

export async function POST(request: Request) {
  const payload = parsePayload(await request.json().catch(() => null));

  if (!payload) {
    return NextResponse.json(
      {
        error: "INVALID_MONTHLY_REVIEW_GENERATE_PAYLOAD",
        message: "Expected monthStart (YYYY-MM-01) in request body.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await generateMonthlyReview(prisma, payload);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MonthlyReviewMonthStartValidationError) {
      return NextResponse.json(
        {
          error: "INVALID_MONTH_START",
          message: "Expected monthStart to match YYYY-MM-01.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "MONTHLY_REVIEW_GENERATION_FAILED",
        message: "Could not generate monthly review.",
      },
      { status: 500 },
    );
  }
}
