import { CategoryKind } from "@prisma/client";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createCategorySchema = z.object({
  name: z.string().trim().min(1),
  kind: z.nativeEnum(CategoryKind).default(CategoryKind.EXPENSE),
  classifierHint: z.string().trim().optional().nullable(),
});

export const Route = createFileRoute("/api/categories")({
  server: {
    handlers: {
      GET: async () => {
        const categories = await prisma.category.findMany({
          select: {
            id: true,
            name: true,
            kind: true,
            classifierHint: true,
          },
          orderBy: [{ name: "asc" }, { id: "asc" }],
        });

        return Response.json({ categories });
      },
      POST: async ({ request }) => {
        const payload = await request.json().catch(() => null);
        const parsed = createCategorySchema.safeParse(payload);

        if (!parsed.success) {
          return Response.json(
            {
              error: "INVALID_CATEGORY_PAYLOAD",
              details: parsed.error.flatten(),
            },
            { status: 400 },
          );
        }

        const classifierHint = parsed.data.classifierHint?.length
          ? parsed.data.classifierHint
          : null;

        try {
          const category = await prisma.category.create({
            data: {
              name: parsed.data.name,
              kind: parsed.data.kind,
              classifierHint,
            },
          });

          return Response.json({ category }, { status: 201 });
        } catch (error) {
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
    },
  },
});
