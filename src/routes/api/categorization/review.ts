import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/api/categorization/review")({
  server: {
    handlers: {
      GET: async () => {
        const pending = await listPendingCategorizationReviews(prisma);
        return Response.json({
          items: pending,
          count: pending.length,
        });
      },
      POST: async ({ request }) => {
        const payload = await request.json().catch(() => null);
        const parsed = submitReviewSchema.safeParse(payload);

        if (!parsed.success) {
          return Response.json(
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

          return Response.json(result);
        } catch (error) {
          if (error instanceof CategoryNotFoundError) {
            return Response.json(
              {
                error: "CATEGORY_NOT_FOUND",
                missingCategoryIds: error.missingCategoryIds,
              },
              { status: 400 },
            );
          }

          throw error;
        }
      },
      ANY: async () => new Response(null, { status: 405 }),
    },
  },
});
