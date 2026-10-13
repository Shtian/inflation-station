import { NextResponse } from "next/server";
import { getMonthInReviewWithReview } from "@/lib/monthly-review/month-in-review";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{
    monthStart: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { monthStart } = await params;

  try {
    const review = await getMonthInReviewWithReview(prisma, { monthStart });
    return NextResponse.json({ review });
  } catch (error) {
    if (error instanceof Error && error.message === "MONTH_START_INVALID") {
      return NextResponse.json(
        {
          error: "INVALID_MONTH_START",
          message: "monthStart må ha formatet YYYY-MM-01.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "MONTH_IN_REVIEW_FETCH_FAILED",
        message: "Kunne ikke laste inn data for måneden som gikk.",
      },
      { status: 500 },
    );
  }
}
