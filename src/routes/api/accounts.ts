import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createAccountSchema = z.object({
  name: z.string().trim().min(1),
  institution: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const Route = createFileRoute("/api/accounts")({
  server: {
    handlers: {
      GET: async () => {
        const accounts = await prisma.account.findMany({
          orderBy: {
            createdAt: "asc",
          },
        });

        return Response.json({ accounts });
      },
      POST: async ({ request }) => {
        const payload = await request.json().catch(() => null);
        const parsed = createAccountSchema.safeParse(payload);

        if (!parsed.success) {
          return Response.json(
            {
              error: "INVALID_ACCOUNT_PAYLOAD",
              details: parsed.error.flatten(),
            },
            { status: 400 },
          );
        }

        try {
          const account = await prisma.account.create({
            data: {
              name: parsed.data.name,
              institution: parsed.data.institution,
              isActive: parsed.data.isActive ?? true,
            },
          });

          return Response.json({ account }, { status: 201 });
        } catch (error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "P2002"
          ) {
            return Response.json(
              { error: "ACCOUNT_NAME_MUST_BE_UNIQUE" },
              { status: 409 },
            );
          }

          throw error;
        }
      },
      ANY: async () => new Response(null, { status: 405 }),
    },
  },
});
