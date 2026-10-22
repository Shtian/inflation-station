import { createFileRoute } from "@tanstack/react-router";
import { getCategoryMerchantHistory } from "@/lib/categorization/category-merchants";
import { prisma } from "@/lib/prisma";

export const Route = createFileRoute("/api/categories/$categoryId/merchants")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const history = await getCategoryMerchantHistory(
          prisma,
          params.categoryId,
        );

        if (history === null) {
          return Response.json(
            { error: "CATEGORY_NOT_FOUND" },
            { status: 404 },
          );
        }

        return Response.json({ history });
      },
    },
  },
});
