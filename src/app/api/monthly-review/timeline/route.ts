import { NextResponse } from "next/server";
import { getMonthlyTimeline } from "@/lib/monthly-review/timeline";
import { prisma } from "@/lib/prisma";

const MAX_LIMIT = 120;

function parsePositiveInteger(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return parsed > 0 ? parsed : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const parsedLimit =
    limitParam === null ? null : parsePositiveInteger(limitParam);

  if (limitParam !== null && parsedLimit === null) {
    return NextResponse.json(
      {
        error: "INVALID_TIMELINE_LIMIT",
        message: "Expected limit to be a positive integer.",
      },
      { status: 400 },
    );
  }

  if (parsedLimit !== null && parsedLimit > MAX_LIMIT) {
    return NextResponse.json(
      {
        error: "INVALID_TIMELINE_LIMIT",
        message: `Expected limit to be less than or equal to ${MAX_LIMIT}.`,
      },
      { status: 400 },
    );
  }

  try {
    const rows = await getMonthlyTimeline(prisma, {
      limit: parsedLimit ?? undefined,
    });

    return NextResponse.json({ rows });
  } catch (_error) {
    return NextResponse.json(
      {
        error: "MONTHLY_REVIEW_TIMELINE_FETCH_FAILED",
        message: "Could not load monthly review timeline data.",
      },
      { status: 500 },
    );
  }
}
