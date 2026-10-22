import { createFileRoute } from "@tanstack/react-router";
import { getDashboardAnalytics } from "@/lib/dashboard/analytics";
import { parseIsoDate } from "@/lib/iso-date";
import { prisma } from "@/lib/prisma";

function parseDateParam(value: string | null): Date | null {
  return value ? parseIsoDate(value) : null;
}

export const Route = createFileRoute("/api/dashboard/analytics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const accountId = url.searchParams.get("accountId")?.trim() ?? "";
        const startDateParam = url.searchParams.get("startDate");
        const endDateParam = url.searchParams.get("endDate");

        const startDate = parseDateParam(startDateParam);
        const endDate = parseDateParam(endDateParam);

        if (startDateParam && !startDate) {
          return Response.json(
            {
              error: "INVALID_START_DATE",
              message: "startDate må ha formatet ÅÅÅÅ-MM-DD.",
            },
            { status: 400 },
          );
        }

        if (endDateParam && !endDate) {
          return Response.json(
            {
              error: "INVALID_END_DATE",
              message: "endDate må ha formatet ÅÅÅÅ-MM-DD.",
            },
            { status: 400 },
          );
        }

        if (startDate && endDate && startDate > endDate) {
          return Response.json(
            {
              error: "INVALID_DATE_RANGE",
              message: "startDate kan ikke være etter endDate.",
            },
            { status: 400 },
          );
        }

        const analytics = await getDashboardAnalytics(prisma, {
          accountId: accountId || undefined,
          startDate: startDate ?? undefined,
          endDate: endDate ?? undefined,
        });

        return Response.json(analytics);
      },
    },
  },
});
