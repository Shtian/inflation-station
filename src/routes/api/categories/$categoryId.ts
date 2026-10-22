import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateCategorySchema = z.object({
  name: z.string().trim().min(1),
  classifierHint: z.string().trim().optional().nullable(),
});

export const Route = createFileRoute("/api/categories/$categoryId")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const { categoryId } = params;
        const payload = await request.json().catch(() => null);
        const parsed = updateCategorySchema.safeParse(payload);

        if (!parsed.success) {
          return Response.json(
            {
              error: "INVALID_CATEGORY_PAYLOAD",
              details: parsed.error.flatten(),
            },
            { status: 400 },
          );
        }

        const classifierHint =
          parsed.data.classifierHint === undefined
            ? undefined
            : parsed.data.classifierHint?.length
              ? parsed.data.classifierHint
              : null;

        try {
          const category = await prisma.category.update({
            where: { id: categoryId },
            data: {
              name: parsed.data.name,
              classifierHint,
            },
          });

          return Response.json({ category });
        } catch (error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "P2025"
          ) {
            return Response.json(
              { error: "CATEGORY_NOT_FOUND" },
              { status: 404 },
            );
          }

          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "P2002"
          ) {
            return Response.json(
              { error: "CATEGORY_NAME_MUST_BE_UNIQUE" },
              { status: 409 },
            );
          }

          throw error;
        }
      },
      DELETE: async ({ params }) => {
        const { categoryId } = params;

        try {
          await prisma.category.delete({
            where: { id: categoryId },
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
              { error: "CATEGORY_NOT_FOUND" },
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
