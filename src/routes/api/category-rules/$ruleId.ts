import { createFileRoute } from "@tanstack/react-router";
import { prisma } from "@/lib/prisma";

export const Route = createFileRoute("/api/category-rules/$ruleId")({
  server: {
    handlers: {
      DELETE: async ({ params }) => {
        const { ruleId } = params;

        try {
          await prisma.categoryRule.delete({
            where: { id: ruleId },
          });

          return new Response(null, { status: 204 });
        } catch (error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "P2025"
          ) {
            return Response.json(
              { error: "CATEGORY_RULE_NOT_FOUND" },
              { status: 404 },
            );
          }

          throw error;
        }
      },
      ANY: async () => new Response(null, { status: 405 }),
    },
  },
});
