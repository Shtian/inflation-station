import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateAccountSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    institution: z.string().trim().min(1).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.institution !== undefined ||
      value.isActive !== undefined,
    {
      message: "Minst ett felt må fylles ut",
    },
  );

export const Route = createFileRoute("/api/accounts/$accountId")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const { accountId } = params;
        const payload = await request.json().catch(() => null);
        const parsed = updateAccountSchema.safeParse(payload);

        if (!parsed.success) {
          return Response.json(
            {
              error: "INVALID_ACCOUNT_UPDATE_PAYLOAD",
              details: parsed.error.flatten(),
            },
            { status: 400 },
          );
        }

        try {
          const account = await prisma.account.update({
            where: { id: accountId },
            data: {
              ...(parsed.data.name !== undefined
                ? { name: parsed.data.name }
                : {}),
              ...(parsed.data.institution !== undefined
                ? { institution: parsed.data.institution?.trim() || null }
                : {}),
              ...(parsed.data.isActive !== undefined
                ? { isActive: parsed.data.isActive }
                : {}),
            },
          });

          return Response.json({ account });
        } catch (error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "P2025"
          ) {
            return Response.json(
              { error: "ACCOUNT_NOT_FOUND" },
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
              { error: "ACCOUNT_NAME_MUST_BE_UNIQUE" },
              { status: 409 },
            );
          }

          throw error;
        }
      },
      DELETE: async ({ params }) => {
        const { accountId } = params;

        const account = await prisma.account.findUnique({
          where: { id: accountId },
          select: {
            _count: {
              select: {
                transactions: true,
              },
            },
          },
        });

        if (!account) {
          return Response.json({ error: "ACCOUNT_NOT_FOUND" }, { status: 404 });
        }

        if (account._count.transactions > 0) {
          return Response.json(
            {
              error: "ACCOUNT_HAS_TRANSACTIONS",
              message:
                "Kan ikke slette kontoen så lenge transaksjoner er knyttet til den.",
            },
            { status: 409 },
          );
        }

        try {
          await prisma.account.delete({
            where: { id: accountId },
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
              { error: "ACCOUNT_NOT_FOUND" },
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
