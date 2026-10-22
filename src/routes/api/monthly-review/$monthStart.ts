import { createFileRoute } from "@tanstack/react-router";
import { getMonthInReviewWithReview } from "@/lib/monthly-review/month-in-review";
import { prisma } from "@/lib/prisma";

export const Route = createFileRoute("/api/monthly-review/$monthStart")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { monthStart } = params;

        try {
          const review = await getMonthInReviewWithReview(prisma, {
            monthStart,
          });
          return Response.json({ review });
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "MONTH_START_INVALID"
          ) {
            return Response.json(
              {
                error: "INVALID_MONTH_START",
                message: "monthStart må ha formatet YYYY-MM-01.",
              },
              { status: 400 },
            );
          }

          return Response.json(
            {
              error: "MONTH_IN_REVIEW_FETCH_FAILED",
              message: "Kunne ikke laste inn data for måneden som gikk.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
