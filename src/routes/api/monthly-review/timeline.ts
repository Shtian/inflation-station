import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/api/monthly-review/timeline")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const limitParam = url.searchParams.get("limit");
        const parsedLimit =
          limitParam === null ? null : parsePositiveInteger(limitParam);

        if (limitParam !== null && parsedLimit === null) {
          return Response.json(
            {
              error: "INVALID_TIMELINE_LIMIT",
              message: "limit må være et positivt heltall.",
            },
            { status: 400 },
          );
        }

        if (parsedLimit !== null && parsedLimit > MAX_LIMIT) {
          return Response.json(
            {
              error: "INVALID_TIMELINE_LIMIT",
              message: `limit kan ikke være større enn ${MAX_LIMIT}.`,
            },
            { status: 400 },
          );
        }

        try {
          const rows = await getMonthlyTimeline(prisma, {
            limit: parsedLimit ?? undefined,
          });

          return Response.json({ rows });
        } catch (_error) {
          return Response.json(
            {
              error: "MONTHLY_REVIEW_TIMELINE_FETCH_FAILED",
              message:
                "Kunne ikke laste inn tidslinjedata for månedsoppsummering.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
