import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CategoryNotFoundError,
  listPendingCategorizationReviews,
  submitCategorizationReview,
} from "@/lib/categorization/review-queue";
import { prisma } from "@/lib/prisma";

const submitReviewSchema = z.object({
  decisions: z.array(
    z.object({
      transactionId: z.string().trim().min(1),
      categoryId: z.string().trim().min(1),
    }),
  ),
});

export async function GET() {
  const pending = await listPendingCategorizationReviews(prisma);
  return NextResponse.json({
    items: pending,
    count: pending.length,
  });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = submitReviewSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_REVIEW_SUBMIT_PAYLOAD",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await submitCategorizationReview(
      prisma,
      parsed.data.decisions,
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      return NextResponse.json(
        {
          error: "CATEGORY_NOT_FOUND",
          missingCategoryIds: error.missingCategoryIds,
        },
        { status: 400 },
      );
    }

    throw error;
  }
}
