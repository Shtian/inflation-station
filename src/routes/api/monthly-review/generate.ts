import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/api/monthly-review/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = parsePayload(await request.json().catch(() => null));

        if (!payload) {
          return Response.json(
            {
              error: "INVALID_MONTHLY_REVIEW_GENERATE_PAYLOAD",
              message: "Forespørselen må inneholde monthStart (YYYY-MM-01).",
            },
            { status: 400 },
          );
        }

        try {
          const result = await generateMonthlyReview(prisma, payload);
          return Response.json(result);
        } catch (error) {
          if (error instanceof MonthlyReviewMonthStartValidationError) {
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
              error: "MONTHLY_REVIEW_GENERATION_FAILED",
              message: "Kunne ikke generere månedsoppsummering.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
