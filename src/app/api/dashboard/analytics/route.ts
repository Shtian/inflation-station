import { NextResponse } from "next/server";
import { getDashboardAnalytics } from "@/lib/dashboard/analytics";
import { parseIsoDate } from "@/lib/iso-date";
import { prisma } from "@/lib/prisma";

function parseDateParam(value: string | null): Date | null {
  return value ? parseIsoDate(value) : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId")?.trim() ?? "";
  const startDateParam = url.searchParams.get("startDate");
  const endDateParam = url.searchParams.get("endDate");

  const startDate = parseDateParam(startDateParam);
  const endDate = parseDateParam(endDateParam);

  if (startDateParam && !startDate) {
    return NextResponse.json(
      {
        error: "INVALID_START_DATE",
        message: "Expected startDate in YYYY-MM-DD format.",
      },
      { status: 400 },
    );
  }

  if (endDateParam && !endDate) {
    return NextResponse.json(
      {
        error: "INVALID_END_DATE",
        message: "Expected endDate in YYYY-MM-DD format.",
      },
      { status: 400 },
    );
  }

  if (startDate && endDate && startDate > endDate) {
    return NextResponse.json(
      {
        error: "INVALID_DATE_RANGE",
        message: "startDate must be less than or equal to endDate.",
      },
      { status: 400 },
    );
  }

  const analytics = await getDashboardAnalytics(prisma, {
    accountId: accountId || undefined,
    startDate: startDate ?? undefined,
    endDate: endDate ?? undefined,
  });

  return NextResponse.json(analytics);
}
